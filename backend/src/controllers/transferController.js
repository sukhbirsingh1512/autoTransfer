import { Transfer } from '../models/Transfer.js';
import { GasTopUp } from '../models/GasTopUp.js';
import { asyncHandler, notFound } from '../utils/errors.js';
import { enqueueTokenSweepRetry } from '../queues/index.js';

function parseQuery(req) {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '25', 10), 1), 200);
  return { page, limit, skip: (page - 1) * limit };
}

export const listTransfers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parseQuery(req);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.wallet) filter.monitoringWalletAddress = req.query.wallet.toLowerCase();
  if (req.query.token) filter.tokenContractAddress = req.query.token.toLowerCase();
  const [items, total] = await Promise.all([
    Transfer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Transfer.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit });
});

export const listFailedTransfers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parseQuery(req);
  const [items, total] = await Promise.all([
    Transfer.find({ status: 'FAILED' }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Transfer.countDocuments({ status: 'FAILED' }),
  ]);
  res.json({ items, total, page, limit });
});

export const getTransfer = asyncHandler(async (req, res) => {
  const item = await Transfer.findById(req.params.id).lean();
  if (!item) throw notFound('Transfer not found');
  res.json({ transfer: item });
});

export const retryTransfer = asyncHandler(async (req, res) => {
  const item = await Transfer.findById(req.params.id);
  if (!item) throw notFound('Transfer not found');
  item.status = 'DETECTED';
  item.errorMessage = undefined;
  await item.save();
  await enqueueTokenSweepRetry({ transferId: item._id.toString() });
  res.json({ ok: true });
});

export const listGasTopUps = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parseQuery(req);
  const [items, total] = await Promise.all([
    GasTopUp.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    GasTopUp.countDocuments(),
  ]);
  res.json({ items, total, page, limit });
});
