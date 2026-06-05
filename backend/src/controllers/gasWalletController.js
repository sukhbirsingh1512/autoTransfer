import Joi from 'joi';
import { MasterGasWallet } from '../models/MasterGasWallet.js';
import { encrypt } from '../utils/crypto.js';
import { asyncHandler, badRequest, conflict, notFound } from '../utils/errors.js';
import { assertAddress, assertPrivateKey } from '../utils/validators.js';
import { getBnbBalance, formatBnb } from '../services/blockchain/gas.js';

const createSchema = Joi.object({
  walletName: Joi.string().required(),
  walletAddress: Joi.string().required(),
  privateKey: Joi.string().required(),
  priority: Joi.number().integer().default(100),
  minimumBalanceAlert: Joi.string().default('0.1'),
  notes: Joi.string().allow('').optional(),
});

const updateSchema = Joi.object({
  walletName: Joi.string(),
  privateKey: Joi.string(),
  priority: Joi.number().integer(),
  minimumBalanceAlert: Joi.string(),
  notes: Joi.string().allow(''),
  status: Joi.string().valid('ACTIVE', 'DISABLED'),
}).min(1);

export const listGasWallets = asyncHandler(async (_req, res) => {
  const wallets = await MasterGasWallet.find().sort({ priority: 1, createdAt: -1 }).lean();
  res.json({ wallets });
});

export const createGasWallet = asyncHandler(async (req, res) => {
  const { value, error } = createSchema.validate(req.body);
  if (error) throw badRequest(error.message);
  const walletAddress = assertAddress(value.walletAddress, 'walletAddress').toLowerCase();
  assertPrivateKey(value.privateKey, walletAddress);
  if (await MasterGasWallet.findOne({ walletAddress })) throw conflict('Wallet already exists');
  const doc = await MasterGasWallet.create({
    walletName: value.walletName,
    walletAddress,
    encryptedPrivateKey: encrypt(value.privateKey),
    priority: value.priority,
    minimumBalanceAlert: value.minimumBalanceAlert,
    notes: value.notes || '',
  });
  res.status(201).json({ wallet: doc.toObject() });
});

export const updateGasWallet = asyncHandler(async (req, res) => {
  const { value, error } = updateSchema.validate(req.body);
  if (error) throw badRequest(error.message);
  const wallet = await MasterGasWallet.findById(req.params.id);
  if (!wallet) throw notFound('Wallet not found');
  if (value.privateKey) {
    assertPrivateKey(value.privateKey, wallet.walletAddress);
    wallet.encryptedPrivateKey = encrypt(value.privateKey);
  }
  for (const k of ['walletName', 'priority', 'minimumBalanceAlert', 'notes', 'status']) {
    if (value[k] !== undefined) wallet[k] = value[k];
  }
  await wallet.save();
  res.json({ wallet: wallet.toObject() });
});

export const deleteGasWallet = asyncHandler(async (req, res) => {
  const wallet = await MasterGasWallet.findById(req.params.id);
  if (!wallet) throw notFound('Wallet not found');
  await wallet.deleteOne();
  res.json({ ok: true });
});

export const getGasWalletBalance = asyncHandler(async (req, res) => {
  const wallet = await MasterGasWallet.findById(req.params.id).lean();
  if (!wallet) throw notFound('Wallet not found');
  const bal = await getBnbBalance(wallet.walletAddress);
  res.json({ address: wallet.walletAddress, bnb: formatBnb(bal), raw: bal.toString() });
});
