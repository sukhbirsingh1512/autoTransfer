import { AdminLog } from '../models/AdminLog.js';
import { asyncHandler } from '../utils/errors.js';

export const listLogs = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);
  const filter = {};
  if (req.query.module) filter.module = req.query.module;
  if (req.query.action) filter.action = req.query.action;
  const [items, total] = await Promise.all([
    AdminLog.find(filter)
      .populate('adminId', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AdminLog.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit });
});
