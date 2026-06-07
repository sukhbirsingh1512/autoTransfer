import mongoose from 'mongoose';

export const APPROVAL_STATUS = [
  'PENDING',          // approve tx broadcast, not yet mined
  'CONFIRMED',        // ready to use for gasless sweeps
  'FAILED',           // approve tx reverted
  'REVOKED',          // we (or somebody) revoked the allowance
];

const sweeperApprovalSchema = new mongoose.Schema(
  {
    monitoringWallet: { type: mongoose.Schema.Types.ObjectId, ref: 'MonitoringWallet', required: true, index: true },
    monitoringWalletAddress: { type: String, lowercase: true, required: true },
    tokenContract: { type: mongoose.Schema.Types.ObjectId, ref: 'Token' },
    tokenContractAddress: { type: String, lowercase: true, required: true, index: true },
    sweeperContractAddress: { type: String, lowercase: true, required: true },
    approvalTxHash: String,
    // Top-up tx hash (we send a tiny bit of BNB to the monitoring wallet so it can pay
    // for its single approve() call). One-time.
    gasTopUpTxHash: String,
    status: { type: String, enum: APPROVAL_STATUS, default: 'PENDING' },
    errorMessage: String,
  },
  { timestamps: true }
);

sweeperApprovalSchema.index(
  { monitoringWalletAddress: 1, tokenContractAddress: 1, sweeperContractAddress: 1 },
  { unique: true }
);

export const SweeperApproval = mongoose.model('SweeperApproval', sweeperApprovalSchema);
