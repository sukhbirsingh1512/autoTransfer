import mongoose from 'mongoose';

export const TRANSFER_STATUS = [
  'DETECTED',
  'GAS_TOP_UP_PENDING',
  'GAS_READY',
  'BROADCAST',
  'CONFIRMED',
  'FAILED',
  'SKIPPED',
];

const transferSchema = new mongoose.Schema(
  {
    monitoringWallet: { type: mongoose.Schema.Types.ObjectId, ref: 'MonitoringWallet' },
    monitoringWalletAddress: { type: String, lowercase: true, index: true },
    secureReceivingWallet: { type: String, lowercase: true },
    tokenContract: { type: mongoose.Schema.Types.ObjectId, ref: 'Token' },
    tokenContractAddress: { type: String, lowercase: true, index: true },
    tokenName: String,
    tokenSymbol: String,
    decimals: Number,
    amount: String, // human-readable
    rawAmount: String, // raw blockchain units
    incomingTxHash: { type: String, index: true, sparse: true },
    outgoingTxHash: { type: String, index: true, sparse: true },
    gasTopUpTxHash: String,
    status: { type: String, enum: TRANSFER_STATUS, default: 'DETECTED' },
    errorMessage: String,
    retryCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

transferSchema.index(
  { incomingTxHash: 1, monitoringWalletAddress: 1, tokenContractAddress: 1 },
  { unique: true, partialFilterExpression: { incomingTxHash: { $type: 'string' } } }
);

export const Transfer = mongoose.model('Transfer', transferSchema);
