import { Router } from 'express';
import {
  listStakingRequests,
  getStakingRequest,
  createStakingRequest,
  cancelStakingRequest,
  retryStakingRequest,
} from '../controllers/stakingController.js';
import { logAdminAction } from '../middleware/activityLog.js';

const router = Router();
router.get('/', listStakingRequests);
router.get('/:id', getStakingRequest);
router.post('/', logAdminAction('staking', 'CREATE_STAKING'), createStakingRequest);
router.post('/:id/cancel', logAdminAction('staking', 'CANCEL_STAKING'), cancelStakingRequest);
router.post('/:id/retry', logAdminAction('staking', 'RETRY_STAKING'), retryStakingRequest);
export default router;
