import { Worker } from 'bullmq';
import { QUEUE_NAMES, sharedConnection, queues } from '../queues/index.js';
import { StakingRequest, STAKING_TERMINAL_STATUSES } from '../models/StakingRequest.js';
import { MonitoringWallet } from '../models/MonitoringWallet.js';
import { MasterFundingWallet } from '../models/MasterFundingWallet.js';
import { Funding } from '../models/Funding.js';
import { decrypt } from '../utils/crypto.js';
import { allowanceOf, approveToken, balanceOf, transferToken } from '../services/blockchain/token.js';
import {
  estimateTransferGasWei,
  estimateApproveAndStakeGasWei,
  parseBnb,
} from '../services/blockchain/gas.js';
import { stake } from '../services/blockchain/staking.js';
import { ensureBnbForTx, resolveGasMode } from '../services/gasTopUpService.js';
import { pickFundingWallet } from '../services/fundingWalletService.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

async function enqueueNext(stakingRequestId, delay = 1000) {
  await queues.STAKING.add('process', { stakingRequestId }, { delay });
}

async function setStatus(request, status, extra = {}) {
  request.status = status;
  Object.assign(request, extra);
  await request.save();
}

async function processStaking(job) {
  const { stakingRequestId } = job.data;
  const request = await StakingRequest.findById(stakingRequestId);
  if (!request) {
    logger.warn({ stakingRequestId }, 'Staking request not found');
    return { skipped: true };
  }
  if (STAKING_TERMINAL_STATUSES.includes(request.status)) {
    return { terminal: request.status };
  }

  const wallet = await MonitoringWallet.findById(request.monitoringWalletId).select('+encryptedPrivateKey');
  if (!wallet) {
    await setStatus(request, 'STAKING_FAILED', { errorMessage: 'Monitoring wallet missing' });
    return { error: 'WALLET_MISSING' };
  }

  try {
    switch (request.status) {
      case 'CREATED':
      case 'CHECKING_FUNDING_WALLET': {
        await setStatus(request, 'CHECKING_FUNDING_WALLET');
        const fundingWallet = await pickFundingWallet({
          usdtContractAddress: request.usdtContractAddress,
          rawAmountRequired: request.stakingAmountRaw,
        });
        request.masterFundingWalletId = fundingWallet._id;
        request.masterFundingWalletAddress = fundingWallet.walletAddress;
        await request.save();
        await setStatus(request, 'FUNDING_WALLET_GAS_REQUIRED');
        return enqueueNext(stakingRequestId);
      }

      case 'FUNDING_WALLET_GAS_REQUIRED':
      case 'FUNDING_WALLET_GAS_TOP_UP_PENDING': {
        const fundingWallet = await MasterFundingWallet.findById(request.masterFundingWalletId).select('+encryptedPrivateKey');
        if (!fundingWallet) throw new Error('Funding wallet missing');
        await setStatus(request, 'FUNDING_WALLET_GAS_TOP_UP_PENDING');

        // Estimate the BNB needed to transfer USDT from funding wallet to monitoring wallet.
        let topUpArgs = {
          wallet: fundingWallet,
          walletType: 'MasterFundingWallet',
          mode: 'fixed',
          minBnb: fundingWallet.minimumBnbBalanceAlert,
          topUpBnb: fundingWallet.minimumBnbBalanceAlert,
        };
        if (resolveGasMode(fundingWallet, config.workers.gasMode) === 'estimated') {
          try {
            const requiredWei = await estimateTransferGasWei({
              from: fundingWallet.walletAddress,
              contractAddress: request.usdtContractAddress,
              to: wallet.walletAddress,
              rawAmount: BigInt(request.stakingAmountRaw),
              bufferPct: config.workers.gasEstimateBufferPct,
            });
            topUpArgs = {
              wallet: fundingWallet,
              walletType: 'MasterFundingWallet',
              mode: 'estimated',
              requiredWei,
              minTopUpWei: parseBnb(config.workers.gasEstimateMinTopUpBnb),
            };
          } catch (estErr) {
            logger.warn({ err: estErr.message }, 'Funding-wallet gas estimation failed; using fixed');
          }
        }

        const gasResult = await ensureBnbForTx(topUpArgs);
        if (gasResult.txHash) request.fundingWalletGasTopUpTxHash = gasResult.txHash;
        await request.save();
        await setStatus(request, 'TRANSFERRING_USDT_TO_MONITORING_WALLET');
        return enqueueNext(stakingRequestId);
      }

      case 'TRANSFERRING_USDT_TO_MONITORING_WALLET': {
        // Duplicate guard
        if (request.fundingTxHash) {
          await setStatus(request, 'USDT_TRANSFERRED_TO_MONITORING_WALLET');
          return enqueueNext(stakingRequestId);
        }
        const fundingWallet = await MasterFundingWallet.findById(request.masterFundingWalletId).select('+encryptedPrivateKey');
        if (!fundingWallet) throw new Error('Funding wallet missing');

        wallet.walletMode = 'FUNDING_IN_PROGRESS';
        await wallet.save();

        const funding = await Funding.create({
          stakingRequestId: request._id,
          masterFundingWallet: fundingWallet._id,
          masterFundingWalletAddress: fundingWallet.walletAddress,
          monitoringWallet: wallet._id,
          monitoringWalletAddress: wallet.walletAddress,
          usdtContractAddress: request.usdtContractAddress,
          amount: request.stakingAmount,
          rawAmount: request.stakingAmountRaw,
          usdtDecimals: request.usdtDecimals,
          gasTopUpTxHash: request.fundingWalletGasTopUpTxHash,
          status: 'PENDING',
        });

        try {
          const pk = decrypt(fundingWallet.encryptedPrivateKey);
          const { hash, wait } = await transferToken({
            privateKey: pk,
            contractAddress: request.usdtContractAddress,
            to: wallet.walletAddress,
            rawAmount: BigInt(request.stakingAmountRaw),
          });
          funding.fundingTxHash = hash;
          funding.status = 'BROADCAST';
          await funding.save();
          request.fundingTxHash = hash;
          await request.save();
          const receipt = await wait();
          funding.status = receipt.status === 1 ? 'CONFIRMED' : 'FAILED';
          await funding.save();
          if (funding.status !== 'CONFIRMED') {
            throw new Error('USDT funding transaction reverted');
          }
        } catch (err) {
          funding.status = 'FAILED';
          funding.errorMessage = err.message;
          await funding.save();
          throw err;
        }

        await setStatus(request, 'USDT_TRANSFERRED_TO_MONITORING_WALLET');
        return enqueueNext(stakingRequestId);
      }

      case 'USDT_TRANSFERRED_TO_MONITORING_WALLET':
      case 'CHECKING_MONITORING_WALLET_GAS':
      case 'MONITORING_WALLET_GAS_REQUIRED':
      case 'MONITORING_WALLET_GAS_TOP_UP_PENDING': {
        await setStatus(request, 'MONITORING_WALLET_GAS_TOP_UP_PENDING');

        // Monitoring wallet runs both approve() and stake() — estimate the combined gas.
        let topUpArgs = {
          wallet,
          walletType: 'MonitoringWallet',
          mode: 'fixed',
          minBnb: wallet.minimumGasBalance,
          topUpBnb: wallet.topUpAmount,
        };
        if (resolveGasMode(wallet, config.workers.gasMode) === 'estimated') {
          try {
            const requiredWei = await estimateApproveAndStakeGasWei({
              from: wallet.walletAddress,
              usdtContract: request.usdtContractAddress,
              stakingContract: request.stakingContractAddress,
              rawAmount: BigInt(request.stakingAmountRaw),
              bufferPct: config.workers.gasEstimateBufferPct,
            });
            topUpArgs = {
              wallet,
              walletType: 'MonitoringWallet',
              mode: 'estimated',
              requiredWei,
              minTopUpWei: parseBnb(config.workers.gasEstimateMinTopUpBnb),
            };
          } catch (estErr) {
            logger.warn({ err: estErr.message }, 'Monitoring-wallet gas estimation failed; using fixed');
          }
        }

        const gasResult = await ensureBnbForTx(topUpArgs);
        if (gasResult.txHash) request.monitoringWalletGasTopUpTxHash = gasResult.txHash;
        await request.save();
        await setStatus(request, 'APPROVING_ALLOWANCE');
        return enqueueNext(stakingRequestId);
      }

      case 'APPROVING_ALLOWANCE': {
        // Idempotent: skip if existing allowance is already sufficient
        const required = BigInt(request.stakingAmountRaw);
        const current = await allowanceOf(
          request.usdtContractAddress,
          wallet.walletAddress,
          request.stakingContractAddress
        );
        if (current >= required && request.allowanceTxHash) {
          await setStatus(request, 'ALLOWANCE_APPROVED');
          return enqueueNext(stakingRequestId);
        }
        if (request.allowanceTxHash) {
          // already broadcast, just move on
          await setStatus(request, 'ALLOWANCE_APPROVED');
          return enqueueNext(stakingRequestId);
        }
        const pk = decrypt(wallet.encryptedPrivateKey);
        const { hash, wait } = await approveToken({
          privateKey: pk,
          contractAddress: request.usdtContractAddress,
          spender: request.stakingContractAddress,
          rawAmount: required,
        });
        request.allowanceTxHash = hash;
        await request.save();
        const receipt = await wait();
        if (receipt.status !== 1) throw new Error('Allowance approval reverted');
        await setStatus(request, 'ALLOWANCE_APPROVED');
        return enqueueNext(stakingRequestId);
      }

      case 'ALLOWANCE_APPROVED':
      case 'STAKING_IN_PROGRESS': {
        if (request.stakingTxHash) {
          // already broadcast; if confirmed, success — otherwise just check
          return { duplicate: true };
        }
        await setStatus(request, 'STAKING_IN_PROGRESS');
        wallet.walletMode = 'STAKING_IN_PROGRESS';
        await wallet.save();

        // Re-check USDT balance
        const bal = await balanceOf(request.usdtContractAddress, wallet.walletAddress);
        if (bal < BigInt(request.stakingAmountRaw)) {
          throw new Error('Monitoring wallet USDT balance is below staking amount');
        }

        const pk = decrypt(wallet.encryptedPrivateKey);
        const { hash, wait } = await stake({
          privateKey: pk,
          rawAmount: BigInt(request.stakingAmountRaw),
          referrerAddress: request.referrerAddress,
          stakingContract: request.stakingContractAddress,
        });
        request.stakingTxHash = hash;
        await request.save();
        const receipt = await wait();
        if (receipt.status !== 1) throw new Error('Staking transaction reverted on-chain');

        await setStatus(request, 'STAKING_SUCCESS');
        wallet.walletMode = 'ACTIVE_MONITORING';
        wallet.activeStakingRequestId = undefined;
        wallet.monitoringPausedReason = undefined;
        await wallet.save();
        return { ok: true, txHash: hash };
      }

      default:
        logger.warn({ status: request.status }, 'Staking worker: unknown status');
        return { unknown: request.status };
    }
  } catch (err) {
    request.errorMessage = err?.message || String(err);
    request.retryCount = (request.retryCount || 0) + 1;
    request.status = 'STAKING_FAILED';
    await request.save();
    // Keep wallet paused so admin can review
    if (wallet.walletMode !== 'PAUSED_FOR_STAKING') {
      wallet.walletMode = 'PAUSED_FOR_STAKING';
      wallet.monitoringPausedReason = 'Staking failed - admin review';
      await wallet.save();
    }
    throw err;
  }
}

export function startStakingWorker() {
  const worker = new Worker(QUEUE_NAMES.STAKING, processStaking, {
    connection: sharedConnection,
    concurrency: Math.max(2, Math.floor(config.workers.concurrency / 2)),
  });
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Staking job failed');
  });
  worker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, result }, 'Staking job step completed');
  });
  return worker;
}
