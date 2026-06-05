import { Router } from 'express';
import {
  listTokens,
  getToken,
  fetchTokenInfo,
  createToken,
  updateToken,
  deleteToken,
} from '../controllers/tokenController.js';
import { logAdminAction } from '../middleware/activityLog.js';

const router = Router();
router.get('/', listTokens);
router.post('/fetch-info', fetchTokenInfo);
router.get('/:id', getToken);
router.post('/', logAdminAction('tokens', 'CREATE_TOKEN'), createToken);
router.put('/:id', logAdminAction('tokens', 'UPDATE_TOKEN'), updateToken);
router.delete('/:id', logAdminAction('tokens', 'DELETE_TOKEN'), deleteToken);
export default router;
