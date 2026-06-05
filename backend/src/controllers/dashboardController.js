import { MonitoringWallet } from '../models/MonitoringWallet.js';
import { Token } from '../models/Token.js';
import { MasterGasWallet } from '../models/MasterGasWallet.js';
import { MasterFundingWallet } from '../models/MasterFundingWallet.js';
import { Transfer } from '../models/Transfer.js';
import { GasTopUp } from '../models/GasTopUp.js';
import { Funding } from '../models/Funding.js';
import { StakingRequest, STAKING_TERMINAL_STATUSES } from '../models/StakingRequest.js';
import { asyncHandler } from '../utils/errors.js';
import { pingProviders } from '../services/blockchain/provider.js';

export const getDashboard = asyncHandler(async (_req, res) => {
  const [
    walletsByMode,
    tokensCount,
    gasWalletsCount,
    fundingWalletsCount,
    transferStats,
    gasTopUpCount,
    fundingCount,
    stakingByStatus,
    recentTransfers,
    recentFundings,
    recentStakings,
    recentGasTopUps,
  ] = await Promise.all([
    MonitoringWallet.aggregate([{ $group: { _id: '$walletMode', count: { $sum: 1 } } }]),
    Token.countDocuments(),
    MasterGasWallet.countDocuments(),
    MasterFundingWallet.countDocuments(),
    Transfer.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    GasTopUp.countDocuments(),
    Funding.countDocuments(),
    StakingRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Transfer.find().sort({ createdAt: -1 }).limit(10).lean(),
    Funding.find().sort({ createdAt: -1 }).limit(10).lean(),
    StakingRequest.find().sort({ createdAt: -1 }).limit(10).lean(),
    GasTopUp.find().sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  const byMode = Object.fromEntries(walletsByMode.map((w) => [w._id, w.count]));
  const byTransferStatus = Object.fromEntries(transferStats.map((s) => [s._id, s.count]));
  const byStakingStatus = Object.fromEntries(stakingByStatus.map((s) => [s._id, s.count]));

  const totalWallets = walletsByMode.reduce((sum, w) => sum + w.count, 0);
  const pendingStakings = stakingByStatus
    .filter((s) => !STAKING_TERMINAL_STATUSES.includes(s._id))
    .reduce((sum, s) => sum + s.count, 0);

  res.json({
    wallets: {
      total: totalWallets,
      active: byMode.ACTIVE_MONITORING || 0,
      paused:
        (byMode.PAUSED_FOR_STAKING || 0) +
        (byMode.FUNDING_IN_PROGRESS || 0) +
        (byMode.STAKING_IN_PROGRESS || 0),
      inactive: byMode.INACTIVE || 0,
      byMode,
    },
    tokens: tokensCount,
    gasWallets: gasWalletsCount,
    fundingWallets: fundingWalletsCount,
    transfers: {
      total: Object.values(byTransferStatus).reduce((a, b) => a + b, 0),
      successful: byTransferStatus.CONFIRMED || 0,
      failed: byTransferStatus.FAILED || 0,
      pending:
        (byTransferStatus.DETECTED || 0) +
        (byTransferStatus.GAS_TOP_UP_PENDING || 0) +
        (byTransferStatus.GAS_READY || 0) +
        (byTransferStatus.BROADCAST || 0),
      byStatus: byTransferStatus,
    },
    gasTopUps: gasTopUpCount,
    fundings: fundingCount,
    staking: {
      total: Object.values(byStakingStatus).reduce((a, b) => a + b, 0),
      success: byStakingStatus.STAKING_SUCCESS || 0,
      failed: byStakingStatus.STAKING_FAILED || 0,
      pending: pendingStakings,
      byStatus: byStakingStatus,
    },
    recent: {
      transfers: recentTransfers,
      fundings: recentFundings,
      stakings: recentStakings,
      gasTopUps: recentGasTopUps,
    },
  });
});

export const getRpcHealth = asyncHandler(async (_req, res) => {
  const rpcs = await pingProviders();
  res.json({ rpcs });
});
