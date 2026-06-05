import { Router } from 'express';
import {
  listTransfers,
  listFailedTransfers,
  getTransfer,
  retryTransfer,
  listGasTopUps,
} from '../controllers/transferController.js';
import { logAdminAction } from '../middleware/activityLog.js';

const router = Router();
router.get('/', listTransfers);
router.get('/failed', listFailedTransfers);
router.get('/gas-top-ups', listGasTopUps);
router.get('/:id', getTransfer);
router.post('/:id/retry', logAdminAction('transfers', 'RETRY_TRANSFER'), retryTransfer);
export default router;
