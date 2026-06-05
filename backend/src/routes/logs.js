import { Router } from 'express';
import { listLogs } from '../controllers/logController.js';

const router = Router();
router.get('/', listLogs);
export default router;
