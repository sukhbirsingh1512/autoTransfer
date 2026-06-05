import { Router } from 'express';
import {
  listFundingWallets,
  createFundingWallet,
  updateFundingWallet,
  deleteFundingWallet,
  getFundingWalletBalances,
} from '../controllers/fundingWalletController.js';
import { logAdminAction } from '../middleware/activityLog.js';

const router = Router();
router.get('/', listFundingWallets);
router.get('/:id/balance', getFundingWalletBalances);
router.post('/', logAdminAction('funding-wallets', 'CREATE_FUNDING_WALLET'), createFundingWallet);
router.put('/:id', logAdminAction('funding-wallets', 'UPDATE_FUNDING_WALLET'), updateFundingWallet);
router.delete('/:id', logAdminAction('funding-wallets', 'DELETE_FUNDING_WALLET'), deleteFundingWallet);
export default router;
