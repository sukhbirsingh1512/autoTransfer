import mongoose from 'mongoose';

export const WALLET_MODES = [
  'ACTIVE_MONITORING',
  'INACTIVE',
  'PAUSED_FOR_STAKING',
  'FUNDING_IN_PROGRESS',
  'STAKING_IN_PROGRESS',
  'STAKING_COMPLETED',
  'STAKING_FAILED',
];

const monitoringWalletSchema = new mongoose.Schema(
  {
    walletName: { type: String, required: true, trim: true },
    walletAddress: { type: String, required: true, unique: true, lowercase: true, trim: true },
    encryptedPrivateKey: { type: String, required: true, select: false },
    secureReceivingWallet: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE' },
    walletMode: { type: String, enum: WALLET_MODES, default: 'ACTIVE_MONITORING' },
    activeStakingRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'StakingRequest' },
    monitoringPausedReason: String,
    minimumGasBalance: { type: String, default: '0.001' }, // BNB
    topUpAmount: { type: String, default: '0.002' }, // BNB
    // Gas top-up sizing strategy for THIS wallet:
    //   FIXED     — send `topUpAmount` BNB whenever balance falls under minimum.
    //   ESTIMATED — estimate gasLimit*gasPrice for the upcoming tx and top up only
    //               the deficit (with a safety buffer). Saves idle BNB.
    gasMode: { type: String, enum: ['FIXED', 'ESTIMATED'], default: 'ESTIMATED' },
    notes: String,
  },
  { timestamps: true }
);

monitoringWalletSchema.index({ walletMode: 1, status: 1 });

export const MonitoringWallet = mongoose.model('MonitoringWallet', monitoringWalletSchema);
