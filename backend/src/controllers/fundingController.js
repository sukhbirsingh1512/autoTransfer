import { Funding } from '../models/Funding.js';
import { asyncHandler, notFound } from '../utils/errors.js';
import { enqueueUsdtFundingRetry } from '../queues/index.js';

export const listFundings = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '25', 10), 1), 200);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const [items, total] = await Promise.all([
    Funding.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Funding.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit });
});

export const getFunding = asyncHandler(async (req, res) => {
  const item = await Funding.findById(req.params.id).lean();
  if (!item) throw notFound('Funding not found');
  res.json({ funding: item });
});

export const retryFunding = asyncHandler(async (req, res) => {
  const item = await Funding.findById(req.params.id);
  if (!item) throw notFound('Funding not found');
  item.status = 'PENDING';
  item.errorMessage = undefined;
  await item.save();
  await enqueueUsdtFundingRetry({ fundingId: item._id.toString() });
  res.json({ ok: true });
});
