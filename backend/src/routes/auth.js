import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, changePassword, me } from '../controllers/authController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, login);
router.post('/logout', requireAdmin, logout);
router.post('/change-password', requireAdmin, changePassword);
router.get('/me', requireAdmin, me);

export default router;
