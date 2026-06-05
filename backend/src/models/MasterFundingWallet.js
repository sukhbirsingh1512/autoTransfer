import mongoose from 'mongoose';

const masterFundingWalletSchema = new mongoose.Schema(
  {
    walletName: { type: String, required: true, trim: true },
    walletAddress: { type: String, required: true, unique: true, lowercase: true, trim: true },
    encryptedPrivateKey: { type: String, required: true, select: false },
    supportedToken: { type: String, default: 'USDT_BEP20' },
    usdtContractAddress: { type: String, required: true, lowercase: true, trim: true },
    priority: { type: Number, default: 100 },
    minimumUsdtBalanceAlert: { type: String, default: '100' },
    minimumBnbBalanceAlert: { type: String, default: '0.01' },
    status: { type: String, enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE' },
    notes: String,
  },
  { timestamps: true }
);

masterFundingWalletSchema.index({ status: 1, priority: 1 });

export const MasterFundingWallet = mongoose.model('MasterFundingWallet', masterFundingWalletSchema);
