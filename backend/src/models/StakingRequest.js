import mongoose from 'mongoose';

export const STAKING_STATUS = [
  'CREATED',
  'CHECKING_FUNDING_WALLET',
  'FUNDING_WALLET_GAS_REQUIRED',
  'FUNDING_WALLET_GAS_TOP_UP_PENDING',
  'TRANSFERRING_USDT_TO_MONITORING_WALLET',
  'USDT_TRANSFERRED_TO_MONITORING_WALLET',
  'CHECKING_MONITORING_WALLET_GAS',
  'MONITORING_WALLET_GAS_REQUIRED',
  'MONITORING_WALLET_GAS_TOP_UP_PENDING',
  'APPROVING_ALLOWANCE',
  'ALLOWANCE_APPROVED',
  'STAKING_IN_PROGRESS',
  'STAKING_SUCCESS',
  'STAKING_FAILED',
  'CANCELLED',
];

export const STAKING_TERMINAL_STATUSES = ['STAKING_SUCCESS', 'STAKING_FAILED', 'CANCELLED'];

const stakingRequestSchema = new mongoose.Schema(
  {
    monitoringWalletId: { type: mongoose.Schema.Types.ObjectId, ref: 'MonitoringWallet', required: true, index: true },
    monitoringWalletAddress: { type: String, lowercase: true, required: true },
    masterFundingWalletId: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterFundingWallet' },
    masterFundingWalletAddress: { type: String, lowercase: true },
    usdtContractAddress: { type: String, lowercase: true, required: true },
    stakingContractAddress: { type: String, lowercase: true, required: true },
    stakingAmount: { type: String, required: true },
    stakingAmountRaw: { type: String, required: true },
    usdtDecimals: { type: Number, required: true },
    referrerAddress: { type: String, lowercase: true, required: true },
    fundingTxHash: String,
    fundingWalletGasTopUpTxHash: String,
    monitoringWalletGasTopUpTxHash: String,
    allowanceTxHash: String,
    stakingTxHash: String,
    status: { type: String, enum: STAKING_STATUS, default: 'CREATED', index: true },
    errorMessage: String,
    retryCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

export const StakingRequest = mongoose.model('StakingRequest', stakingRequestSchema);
