import { Router } from 'express';
import authRoutes from './auth.js';
import dashboardRoutes from './dashboard.js';
import walletRoutes from './wallets.js';
import tokenRoutes from './tokens.js';
import gasWalletRoutes from './gasWallets.js';
import fundingWalletRoutes from './fundingWallets.js';
import transferRoutes from './transfers.js';
import fundingRoutes from './fundings.js';
import stakingRoutes from './staking.js';
import sweeperRoutes from './sweeper.js';
import logRoutes from './logs.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use('/auth', authRoutes);

// All routes below require admin auth
router.use('/dashboard', requireAdmin, dashboardRoutes);
router.use('/wallets', requireAdmin, walletRoutes);
router.use('/tokens', requireAdmin, tokenRoutes);
router.use('/gas-wallets', requireAdmin, gasWalletRoutes);
router.use('/funding-wallets', requireAdmin, fundingWalletRoutes);
router.use('/transfers', requireAdmin, transferRoutes);
router.use('/fundings', requireAdmin, fundingRoutes);
router.use('/staking', requireAdmin, stakingRoutes);
router.use('/sweeper', requireAdmin, sweeperRoutes);
router.use('/logs', requireAdmin, logRoutes);

export default router;
