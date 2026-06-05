import { Router } from 'express';
import { listFundings, getFunding, retryFunding } from '../controllers/fundingController.js';
import { logAdminAction } from '../middleware/activityLog.js';

const router = Router();
router.get('/', listFundings);
router.get('/:id', getFunding);
router.post('/:id/retry', logAdminAction('fundings', 'RETRY_FUNDING'), retryFunding);
export default router;
