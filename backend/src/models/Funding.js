import mongoose from 'mongoose';

export const FUNDING_STATUS = [
  'PENDING',
  'GAS_TOP_UP_PENDING',
  'BROADCAST',
  'CONFIRMED',
  'FAILED',
];

const fundingSchema = new mongoose.Schema(
  {
    stakingRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'StakingRequest', index: true },
    masterFundingWallet: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterFundingWallet' },
    masterFundingWalletAddress: { type: String, lowercase: true },
    monitoringWallet: { type: mongoose.Schema.Types.ObjectId, ref: 'MonitoringWallet' },
    monitoringWalletAddress: { type: String, lowercase: true, index: true },
    usdtContractAddress: { type: String, lowercase: true },
    amount: String,
    rawAmount: String,
    usdtDecimals: Number,
    fundingTxHash: { type: String, index: true, sparse: true },
    gasTopUpTxHash: String,
    status: { type: String, enum: FUNDING_STATUS, default: 'PENDING' },
    errorMessage: String,
    retryCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Funding = mongoose.model('Funding', fundingSchema);
