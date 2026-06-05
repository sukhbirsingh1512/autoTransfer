import { AdminLog } from '../models/AdminLog.js';
import { logger } from '../utils/logger.js';

export function logAdminAction(module, action) {
  return async (req, _res, next) => {
    try {
      if (req.admin) {
        await AdminLog.create({
          adminId: req.admin.id,
          action,
          module,
          details: {
            method: req.method,
            path: req.originalUrl,
            params: req.params,
            bodyKeys: Object.keys(req.body || {}),
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || '',
        });
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to write admin log');
    }
    next();
  };
}
