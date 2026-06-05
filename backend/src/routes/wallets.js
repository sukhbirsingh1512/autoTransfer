import { Router } from 'express';
import {
  listWallets,
  getWallet,
  createWallet,
  updateWallet,
  deleteWallet,
  releaseFromStaking,
} from '../controllers/walletController.js';
import { logAdminAction } from '../middleware/activityLog.js';

const router = Router();
router.get('/', listWallets);
router.get('/:id', getWallet);
router.post('/', logAdminAction('wallets', 'CREATE_WALLET'), createWallet);
router.put('/:id', logAdminAction('wallets', 'UPDATE_WALLET'), updateWallet);
router.delete('/:id', logAdminAction('wallets', 'DELETE_WALLET'), deleteWallet);
router.post('/:id/release', logAdminAction('wallets', 'RELEASE_FROM_STAKING'), releaseFromStaking);
export default router;
