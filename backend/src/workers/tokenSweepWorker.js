import { ethers } from 'ethers';
import { Worker } from 'bullmq';
import { QUEUE_NAMES, sharedConnection } from '../queues/index.js';
import { MonitoringWallet } from '../models/MonitoringWallet.js';
import { Token } from '../models/Token.js';
import { Transfer } from '../models/Transfer.js';
import { decrypt } from '../utils/crypto.js';
import { balanceOf, transferToken } from '../services/blockchain/token.js';
import { estimateTransferGasWei, parseBnb } from '../services/blockchain/gas.js';
import { ensureBnbForTx, resolveGasMode } from '../services/gasTopUpService.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const PAUSED_MODES = new Set([
  'PAUSED_FOR_STAKING',
  'FUNDING_IN_PROGRESS',
  'STAKING_IN_PROGRESS',
  'INACTIVE',
]);

async function processSweep(job) {
  const { monitoringWalletAddress, tokenContractAddress, incomingTxHash, rawAmount, transferId } = job.data;

  // Retry path: load existing record
  let transfer = transferId ? await Transfer.findById(transferId) : null;
  let wallet, token;

  if (transfer) {
    wallet = await MonitoringWallet.findOne({ walletAddress: transfer.monitoringWalletAddress }).select('+encryptedPrivateKey');
    token = await Token.findOne({ contractAddress: transfer.tokenContractAddress });
  } else {
    wallet = await MonitoringWallet.findOne({ walletAddress: monitoringWalletAddress.toLowerCase() }).select('+encryptedPrivateKey');
    token = await Token.findOne({ contractAddress: tokenContractAddress.toLowerCase() });
  }

  if (!wallet || !token) {
    logger.warn({ data: job.data }, 'Sweep: wallet or token not found, skipping');
    return { skipped: true, reason: 'WALLET_OR_TOKEN_NOT_FOUND' };
  }
  if (wallet.status !== 'ACTIVE' || token.status !== 'ACTIVE') {
    return { skipped: true, reason: 'INACTIVE' };
  }
  if (PAUSED_MODES.has(wallet.walletMode)) {
    return { skipped: true, reason: `WALLET_${wallet.walletMode}` };
  }

  // Duplicate-prevention: skip if we already have an outgoingTxHash for this incoming tx
  if (incomingTxHash) {
    const existing = await Transfer.findOne({
      incomingTxHash,
      monitoringWalletAddress: wallet.walletAddress,
      tokenContractAddress: token.contractAddress,
      outgoingTxHash: { $exists: true, $ne: null },
    });
    if (existing) return { skipped: true, reason: 'ALREADY_SWEPT' };
  }

  // In-flight dedup: if another job is currently sweeping the same wallet+token,
  // skip. Avoids two concurrent jobs racing each other (and racing the gas wallet's
  // nonce for two simultaneous top-ups).
  if (!transferId) {
    const inFlight = await Transfer.findOne({
      monitoringWalletAddress: wallet.walletAddress,
      tokenContractAddress: token.contractAddress,
      status: { $in: ['DETECTED', 'GAS_TOP_UP_PENDING', 'GAS_READY', 'BROADCAST'] },
    });
    if (inFlight) {
      return { skipped: true, reason: 'ALREADY_IN_FLIGHT', existingId: inFlight._id.toString() };
    }
  }

  // Re-check on-chain balance (don't trust event amount alone)
  const liveBalance = await balanceOf(token.contractAddress, wallet.walletAddress);
  if (liveBalance <= 0n) {
    return { skipped: true, reason: 'ZERO_BALANCE' };
  }
  const minSweepRaw = token.minimumSweepAmount && token.minimumSweepAmount !== '0'
    ? ethers.parseUnits(token.minimumSweepAmount, token.decimals)
    : 0n;
  if (liveBalance < minSweepRaw) {
    return { skipped: true, reason: 'BELOW_MINIMUM' };
  }

  // Default: sweep full available balance
  const sweepRaw = liveBalance;
  const sweepHuman = ethers.formatUnits(sweepRaw, token.decimals);

  if (!transfer) {
    const baseDoc = {
      monitoringWallet: wallet._id,
      monitoringWalletAddress: wallet.walletAddress,
      secureReceivingWallet: wallet.secureReceivingWallet,
      tokenContract: token._id,
      tokenContractAddress: token.contractAddress,
      tokenName: token.tokenName,
      tokenSymbol: token.tokenSymbol,
      decimals: token.decimals,
      amount: sweepHuman,
      rawAmount: sweepRaw.toString(),
      status: 'DETECTED',
    };
    if (incomingTxHash) {
      // Event-driven path: dedup by incomingTxHash so the same Transfer event can't
      // produce two sweep records.
      transfer = await Transfer.findOneAndUpdate(
        {
          incomingTxHash,
          monitoringWalletAddress: wallet.walletAddress,
          tokenContractAddress: token.contractAddress,
        },
        { $setOnInsert: { ...baseDoc, incomingTxHash } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else {
      // Polling path: there's no incoming hash to dedup against. Always create a new
      // record — the worker's earlier live-balance check guarantees there's something
      // to sweep right now, and overwriting an old record would erase its on-chain history.
      transfer = await Transfer.create(baseDoc);
    }
  }

  // Ensure gas
  try {
    transfer.status = 'GAS_TOP_UP_PENDING';
    await transfer.save();

    let topUpArgs = {
      wallet,
      walletType: 'MonitoringWallet',
      mode: 'fixed',
      minBnb: wallet.minimumGasBalance,
      topUpBnb: wallet.topUpAmount,
    };

    const effectiveMode = resolveGasMode(wallet, config.workers.gasMode);
    if (effectiveMode === 'estimated') {
      try {
        const requiredWei = await estimateTransferGasWei({
          from: wallet.walletAddress,
          contractAddress: token.contractAddress,
          to: wallet.secureReceivingWallet,
          rawAmount: sweepRaw,
          bufferPct: config.workers.gasEstimateBufferPct,
        });
        topUpArgs = {
          wallet,
          walletType: 'MonitoringWallet',
          mode: 'estimated',
          requiredWei,
          minTopUpWei: parseBnb(config.workers.gasEstimateMinTopUpBnb),
        };
        logger.info(
          { wallet: wallet.walletAddress, requiredWei: requiredWei.toString() },
          'Sweep gas estimated'
        );
      } catch (estErr) {
        // Fall through to fixed-mode top-up if estimation fails.
        logger.warn(
          { err: estErr.message, wallet: wallet.walletAddress },
          'Gas estimation failed, falling back to fixed top-up'
        );
      }
    }

    const gasResult = await ensureBnbForTx(topUpArgs);
    if (gasResult.txHash) transfer.gasTopUpTxHash = gasResult.txHash;
    transfer.status = 'GAS_READY';
    await transfer.save();
  } catch (err) {
    transfer.status = 'FAILED';
    transfer.errorMessage = `Gas top-up failed: ${err.message}`;
    transfer.retryCount = (transfer.retryCount || 0) + 1;
    await transfer.save();
    throw err;
  }

  // Broadcast token transfer
  try {
    const privateKey = decrypt(wallet.encryptedPrivateKey);
    const gasPriceWei = config.workers.sweepGasPriceGwei
      ? ethers.parseUnits(String(config.workers.sweepGasPriceGwei), 'gwei')
      : undefined;
    const { hash, wait } = await transferToken({
      privateKey,
      contractAddress: token.contractAddress,
      to: wallet.secureReceivingWallet,
      rawAmount: sweepRaw,
      gasPriceWei,
    });
    transfer.outgoingTxHash = hash;
    transfer.status = 'BROADCAST';
    await transfer.save();

    if (config.workers.sweepFastMode) {
      // Fast path: don't block the worker on the receipt. The reconciler picks up
      // BROADCAST transfers and updates them to CONFIRMED/FAILED.
      return { ok: true, txHash: hash, fastMode: true };
    }

    const receipt = await wait();
    transfer.status = receipt.status === 1 ? 'CONFIRMED' : 'FAILED';
    if (transfer.status === 'FAILED') {
      transfer.errorMessage = 'Sweep transaction reverted on-chain';
    }
    await transfer.save();
    return { ok: transfer.status === 'CONFIRMED', txHash: hash };
  } catch (err) {
    transfer.status = 'FAILED';
    transfer.errorMessage = err.message;
    transfer.retryCount = (transfer.retryCount || 0) + 1;
    await transfer.save();
    throw err;
  }
}

export function startTokenSweepWorker() {
  const worker = new Worker(QUEUE_NAMES.TOKEN_SWEEP, processSweep, {
    connection: sharedConnection,
    concurrency: config.workers.concurrency,
  });
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Token sweep job failed');
  });
  worker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, result }, 'Token sweep job completed');
  });
  return worker;
}
