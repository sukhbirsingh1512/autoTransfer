import { ethers } from 'ethers';
import { MasterGasWallet } from '../models/MasterGasWallet.js';
import { GasTopUp } from '../models/GasTopUp.js';
import { decrypt } from '../utils/crypto.js';
import { getBnbBalance, sendBnb, parseBnb, formatBnb } from './blockchain/gas.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * Pick the highest-priority active gas wallet with enough BNB to cover `requiredWei`.
 * Returns the wallet doc (including encryptedPrivateKey) or throws.
 */
export async function pickGasWalletWei(requiredWei) {
  const wallets = await MasterGasWallet.find({ status: 'ACTIVE' })
    .select('+encryptedPrivateKey')
    .sort({ priority: 1, createdAt: 1 });

  for (const w of wallets) {
    const bal = await getBnbBalance(w.walletAddress);
    if (bal >= requiredWei) return w;
  }
  throw new AppError(
    `No Master Gas Wallet has sufficient BNB to send ${formatBnb(requiredWei)}`,
    503,
    'GAS_WALLET_UNAVAILABLE'
  );
}

// Back-compat wrapper used elsewhere.
export async function pickGasWallet(requiredBnb) {
  return pickGasWalletWei(parseBnb(requiredBnb));
}

/**
 * Send `sendWei` BNB from a Master Gas Wallet to `targetAddress`, with a GasTopUp record.
 */
async function performTopUp({ targetAddress, targetWalletId, targetWalletType, sendWei }) {
  const gasWallet = await pickGasWalletWei(sendWei);
  const record = await GasTopUp.create({
    masterGasWallet: gasWallet._id,
    masterGasWalletAddress: gasWallet.walletAddress,
    receiverWallet: targetWalletId,
    receiverWalletAddress: targetAddress,
    receiverWalletType: targetWalletType,
    bnbAmount: formatBnb(sendWei),
    rawBnbAmount: sendWei.toString(),
    status: 'PENDING',
  });

  try {
    const privateKey = decrypt(gasWallet.encryptedPrivateKey);
    const { hash, wait } = await sendBnb({
      privateKey,
      to: targetAddress,
      rawAmountWei: sendWei,
    });
    record.transactionHash = hash;
    record.status = 'BROADCAST';
    await record.save();
    const receipt = await wait();
    record.status = receipt.status === 1 ? 'CONFIRMED' : 'FAILED';
    await record.save();
    if (record.status === 'FAILED') {
      throw new AppError('Gas top-up transaction reverted', 502, 'GAS_TOPUP_REVERT');
    }
    return { topped: true, txHash: hash, gasTopUpId: record._id.toString() };
  } catch (err) {
    record.status = 'FAILED';
    record.errorMessage = err?.message || String(err);
    await record.save();
    logger.error({ err, targetAddress }, 'Gas top-up failed');
    throw err;
  }
}

/**
 * Legacy / fixed-amount mode.
 * Ensure the target wallet has at least `minBnb` BNB. If not, send `topUpBnb` from a Master Gas Wallet.
 */
export async function ensureBnbBalance({
  targetAddress,
  targetWalletId,
  targetWalletType,
  minBnb,
  topUpBnb,
}) {
  const current = await getBnbBalance(targetAddress);
  const minWei = parseBnb(minBnb);
  if (current >= minWei) return { topped: false };

  return performTopUp({
    targetAddress,
    targetWalletId,
    targetWalletType,
    sendWei: parseBnb(topUpBnb),
  });
}

/**
 * Estimated-amount mode.
 * Caller supplies the exact wei needed for the upcoming tx (already includes safety
 * buffer). We compare against the current balance and top up only the deficit.
 *
 *   needed = requiredWei (already includes buffer)
 *   sent   = max(needed - current, minTopUpWei)   // floor avoids dust top-ups
 *
 * When the wallet already has enough, no top-up is sent.
 */
export async function ensureBnbExact({
  targetAddress,
  targetWalletId,
  targetWalletType,
  requiredWei,
  minTopUpWei = parseBnb('0.0001'),
}) {
  const current = await getBnbBalance(targetAddress);
  if (current >= requiredWei) return { topped: false };

  let sendWei = requiredWei - current;
  if (sendWei < minTopUpWei) sendWei = minTopUpWei;

  return performTopUp({
    targetAddress,
    targetWalletId,
    targetWalletType,
    sendWei,
  });
}

/**
 * Convenience wrapper used by workers.
 *   mode='fixed'     → uses minBnb / topUpBnb (legacy)
 *   mode='estimated' → uses requiredWei + minTopUpWei (deficit-only)
 */
export async function ensureBnbForTx({
  wallet,
  walletType,
  minBnb,
  topUpBnb,
  requiredWei,
  minTopUpWei,
  mode = 'fixed',
}) {
  if (mode === 'estimated' && requiredWei) {
    return ensureBnbExact({
      targetAddress: wallet.walletAddress,
      targetWalletId: wallet._id,
      targetWalletType: walletType,
      requiredWei,
      minTopUpWei,
    });
  }
  return ensureBnbBalance({
    targetAddress: wallet.walletAddress,
    targetWalletId: wallet._id,
    targetWalletType: walletType,
    minBnb,
    topUpBnb,
  });
}

export function bnbHex(amount) {
  return ethers.toBeHex(parseBnb(amount));
}

/**
 * Resolve a wallet's effective gas mode. Per-wallet setting wins; falls back to
 * env GAS_MODE so existing wallets created before the field existed still work.
 */
export function resolveGasMode(wallet, envMode) {
  const m = (wallet?.gasMode || envMode || 'fixed').toLowerCase();
  return m === 'estimated' ? 'estimated' : 'fixed';
}
