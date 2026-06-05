import { ethers } from 'ethers';
import { MasterGasWallet } from '../models/MasterGasWallet.js';
import { GasTopUp } from '../models/GasTopUp.js';
import { decrypt } from '../utils/crypto.js';
import { getBnbBalance, sendBnb, parseBnb } from './blockchain/gas.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * Pick the highest-priority active gas wallet with enough BNB to cover `requiredBnb`.
 * Returns the wallet doc (including encryptedPrivateKey) or throws.
 */
export async function pickGasWallet(requiredBnb) {
  const wallets = await MasterGasWallet.find({ status: 'ACTIVE' })
    .select('+encryptedPrivateKey')
    .sort({ priority: 1, createdAt: 1 });

  const requiredWei = parseBnb(requiredBnb);
  for (const w of wallets) {
    const bal = await getBnbBalance(w.walletAddress);
    if (bal >= requiredWei) return w;
  }
  throw new AppError(
    `No Master Gas Wallet has sufficient BNB to send ${requiredBnb}`,
    503,
    'GAS_WALLET_UNAVAILABLE'
  );
}

/**
 * Ensure the target wallet has at least `minBnb` BNB. If not, send `topUpBnb` from a Master Gas Wallet.
 * Returns { topped: boolean, txHash?: string, gasTopUpId?: string }.
 */
export async function ensureBnbBalance({
  targetAddress,
  targetWalletId,
  targetWalletType, // 'MonitoringWallet' | 'MasterFundingWallet'
  minBnb,
  topUpBnb,
}) {
  const current = await getBnbBalance(targetAddress);
  const minWei = parseBnb(minBnb);
  if (current >= minWei) return { topped: false };

  const gasWallet = await pickGasWallet(topUpBnb);
  const record = await GasTopUp.create({
    masterGasWallet: gasWallet._id,
    masterGasWalletAddress: gasWallet.walletAddress,
    receiverWallet: targetWalletId,
    receiverWalletAddress: targetAddress,
    receiverWalletType: targetWalletType,
    bnbAmount: String(topUpBnb),
    rawBnbAmount: parseBnb(topUpBnb).toString(),
    status: 'PENDING',
  });

  try {
    const privateKey = decrypt(gasWallet.encryptedPrivateKey);
    const { hash, wait } = await sendBnb({
      privateKey,
      to: targetAddress,
      rawAmountWei: parseBnb(topUpBnb),
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
 * Convenience: ensure the wallet has gas, returning early when balance is already sufficient.
 */
export async function ensureBnbForTx({ wallet, walletType, minBnb, topUpBnb }) {
  return ensureBnbBalance({
    targetAddress: wallet.walletAddress,
    targetWalletId: wallet._id,
    targetWalletType: walletType,
    minBnb,
    topUpBnb,
  });
}

export function bnbHex(amount) {
  // BigNumberish helper if needed
  return ethers.toBeHex(parseBnb(amount));
}
