import { Router } from 'express';
import { getDashboard, getRpcHealth } from '../controllers/dashboardController.js';

const router = Router();
router.get('/', getDashboard);
router.get('/rpc', getRpcHealth);
export default router;
