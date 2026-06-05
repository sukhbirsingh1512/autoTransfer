import { Router } from 'express';
import {
  listGasWallets,
  createGasWallet,
  updateGasWallet,
  deleteGasWallet,
  getGasWalletBalance,
} from '../controllers/gasWalletController.js';
import { logAdminAction } from '../middleware/activityLog.js';

const router = Router();
router.get('/', listGasWallets);
router.get('/:id/balance', getGasWalletBalance);
router.post('/', logAdminAction('gas-wallets', 'CREATE_GAS_WALLET'), createGasWallet);
router.put('/:id', logAdminAction('gas-wallets', 'UPDATE_GAS_WALLET'), updateGasWallet);
router.delete('/:id', logAdminAction('gas-wallets', 'DELETE_GAS_WALLET'), deleteGasWallet);
export default router;
