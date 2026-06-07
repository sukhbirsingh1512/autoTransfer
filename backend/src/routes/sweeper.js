import { Router } from 'express';
import {
  getSweeperStatus,
  setupApproval,
  listApprovals,
  markRevoked,
} from '../controllers/sweeperController.js';
import { logAdminAction } from '../middleware/activityLog.js';

const router = Router();
router.get('/status', getSweeperStatus);
router.get('/approvals', listApprovals);
router.post('/approvals', logAdminAction('sweeper', 'SETUP_APPROVAL'), setupApproval);
router.post('/approvals/:id/revoke', logAdminAction('sweeper', 'REVOKE_APPROVAL'), markRevoked);
export default router;
