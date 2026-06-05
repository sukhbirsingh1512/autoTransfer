import { MasterFundingWallet } from '../models/MasterFundingWallet.js';
import { balanceOf } from './blockchain/token.js';
import { AppError } from '../utils/errors.js';

/**
 * Pick the highest-priority active Master Funding Wallet with sufficient USDT to cover rawAmount.
 * BNB sufficiency is handled separately via ensureBnbBalance().
 */
export async function pickFundingWallet({ usdtContractAddress, rawAmountRequired }) {
  const wallets = await MasterFundingWallet.find({
    status: 'ACTIVE',
    usdtContractAddress: usdtContractAddress.toLowerCase(),
  })
    .select('+encryptedPrivateKey')
    .sort({ priority: 1, createdAt: 1 });

  for (const w of wallets) {
    const usdtBal = await balanceOf(usdtContractAddress, w.walletAddress);
    if (usdtBal >= BigInt(rawAmountRequired)) return w;
  }
  throw new AppError(
    'No Master Funding Wallet has sufficient USDT balance',
    503,
    'FUNDING_WALLET_UNAVAILABLE'
  );
}
