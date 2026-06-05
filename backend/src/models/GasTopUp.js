import mongoose from 'mongoose';

export const GAS_TOPUP_STATUS = ['PENDING', 'BROADCAST', 'CONFIRMED', 'FAILED'];

const gasTopUpSchema = new mongoose.Schema(
  {
    masterGasWallet: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterGasWallet' },
    masterGasWalletAddress: { type: String, lowercase: true },
    receiverWallet: { type: mongoose.Schema.Types.ObjectId, refPath: 'receiverWalletType' },
    receiverWalletAddress: { type: String, lowercase: true, index: true },
    receiverWalletType: { type: String, enum: ['MonitoringWallet', 'MasterFundingWallet'] },
    bnbAmount: String, // human-readable
    rawBnbAmount: String, // wei
    transactionHash: { type: String, index: true, sparse: true },
    status: { type: String, enum: GAS_TOPUP_STATUS, default: 'PENDING' },
    errorMessage: String,
    retryCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const GasTopUp = mongoose.model('GasTopUp', gasTopUpSchema);
