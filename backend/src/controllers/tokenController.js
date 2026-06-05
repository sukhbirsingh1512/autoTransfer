import Joi from 'joi';
import { Token } from '../models/Token.js';
import { asyncHandler, badRequest, conflict, notFound } from '../utils/errors.js';
import { assertAddress } from '../utils/validators.js';
import { fetchTokenMetadata } from '../services/blockchain/token.js';

const createSchema = Joi.object({
  contractAddress: Joi.string().required(),
  tokenName: Joi.string().optional(),
  tokenSymbol: Joi.string().optional(),
  decimals: Joi.number().integer().min(0).max(36).optional(),
  minimumSweepAmount: Joi.string().default('0'),
  notes: Joi.string().allow('').optional(),
});

const updateSchema = Joi.object({
  tokenName: Joi.string(),
  tokenSymbol: Joi.string(),
  decimals: Joi.number().integer().min(0).max(36),
  minimumSweepAmount: Joi.string(),
  notes: Joi.string().allow(''),
  status: Joi.string().valid('ACTIVE', 'DISABLED'),
}).min(1);

export const listTokens = asyncHandler(async (_req, res) => {
  const tokens = await Token.find().sort({ createdAt: -1 }).lean();
  res.json({ tokens });
});

export const getToken = asyncHandler(async (req, res) => {
  const token = await Token.findById(req.params.id).lean();
  if (!token) throw notFound('Token not found');
  res.json({ token });
});

export const fetchTokenInfo = asyncHandler(async (req, res) => {
  const address = assertAddress(req.body.contractAddress, 'contractAddress');
  const meta = await fetchTokenMetadata(address);
  res.json({ contractAddress: address, ...meta });
});

export const createToken = asyncHandler(async (req, res) => {
  const { value, error } = createSchema.validate(req.body);
  if (error) throw badRequest(error.message);
  const contractAddress = assertAddress(value.contractAddress, 'contractAddress').toLowerCase();

  const exists = await Token.findOne({ contractAddress });
  if (exists) throw conflict('Token already exists');

  let { tokenName, tokenSymbol, decimals } = value;
  if (!tokenName || !tokenSymbol || decimals === undefined) {
    const meta = await fetchTokenMetadata(contractAddress);
    tokenName = tokenName || meta.name;
    tokenSymbol = tokenSymbol || meta.symbol;
    decimals = decimals !== undefined ? decimals : meta.decimals;
  }
  if (!tokenName || !tokenSymbol || decimals === null || decimals === undefined) {
    throw badRequest('Could not determine token metadata; please supply manually');
  }

  const doc = await Token.create({
    contractAddress,
    tokenName,
    tokenSymbol,
    decimals,
    minimumSweepAmount: value.minimumSweepAmount,
    notes: value.notes || '',
  });
  res.status(201).json({ token: doc.toObject() });
});

export const updateToken = asyncHandler(async (req, res) => {
  const { value, error } = updateSchema.validate(req.body);
  if (error) throw badRequest(error.message);
  const token = await Token.findByIdAndUpdate(req.params.id, value, { new: true });
  if (!token) throw notFound('Token not found');
  res.json({ token: token.toObject() });
});

export const deleteToken = asyncHandler(async (req, res) => {
  const token = await Token.findById(req.params.id);
  if (!token) throw notFound('Token not found');
  await token.deleteOne();
  res.json({ ok: true });
});
