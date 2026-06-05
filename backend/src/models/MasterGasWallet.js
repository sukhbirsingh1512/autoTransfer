import mongoose from 'mongoose';

const masterGasWalletSchema = new mongoose.Schema(
  {
    walletName: { type: String, required: true, trim: true },
    walletAddress: { type: String, required: true, unique: true, lowercase: true, trim: true },
    encryptedPrivateKey: { type: String, required: true, select: false },
    priority: { type: Number, default: 100 }, // lower = higher priority
    minimumBalanceAlert: { type: String, default: '0.1' }, // BNB
    status: { type: String, enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE' },
    notes: String,
  },
  { timestamps: true }
);

masterGasWalletSchema.index({ status: 1, priority: 1 });

export const MasterGasWallet = mongoose.model('MasterGasWallet', masterGasWalletSchema);
