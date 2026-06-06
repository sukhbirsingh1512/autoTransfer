import Joi from 'joi';
import { ethers } from 'ethers';
import { MasterFundingWallet } from '../models/MasterFundingWallet.js';
import { encrypt } from '../utils/crypto.js';
import { asyncHandler, badRequest, conflict, notFound } from '../utils/errors.js';
import { assertAddress, assertPrivateKey } from '../utils/validators.js';
import { getBnbBalance, formatBnb } from '../services/blockchain/gas.js';
import { balanceOf, fetchTokenMetadata } from '../services/blockchain/token.js';
import { config } from '../config/index.js';

const createSchema = Joi.object({
  walletName: Joi.string().required(),
  walletAddress: Joi.string().required(),
  privateKey: Joi.string().required(),
  usdtContractAddress: Joi.string().default(config.protocol.usdtAddress),
  priority: Joi.number().integer().default(100),
  minimumUsdtBalanceAlert: Joi.string().default('100'),
  minimumBnbBalanceAlert: Joi.string().default('0.01'),
  gasMode: Joi.string().valid('FIXED', 'ESTIMATED').default('ESTIMATED'),
  notes: Joi.string().allow('').optional(),
});

const updateSchema = Joi.object({
  walletName: Joi.string(),
  privateKey: Joi.string(),
  priority: Joi.number().integer(),
  minimumUsdtBalanceAlert: Joi.string(),
  minimumBnbBalanceAlert: Joi.string(),
  gasMode: Joi.string().valid('FIXED', 'ESTIMATED'),
  notes: Joi.string().allow(''),
  status: Joi.string().valid('ACTIVE', 'DISABLED'),
}).min(1);

export const listFundingWallets = asyncHandler(async (_req, res) => {
  const wallets = await MasterFundingWallet.find().sort({ priority: 1, createdAt: -1 }).lean();
  res.json({ wallets });
});

export const createFundingWallet = asyncHandler(async (req, res) => {
  const { value, error } = createSchema.validate(req.body);
  if (error) throw badRequest(error.message);
  const walletAddress = assertAddress(value.walletAddress, 'walletAddress').toLowerCase();
  const usdt = assertAddress(value.usdtContractAddress, 'usdtContractAddress').toLowerCase();
  assertPrivateKey(value.privateKey, walletAddress);
  if (await MasterFundingWallet.findOne({ walletAddress })) throw conflict('Wallet already exists');
  const doc = await MasterFundingWallet.create({
    walletName: value.walletName,
    walletAddress,
    encryptedPrivateKey: encrypt(value.privateKey),
    usdtContractAddress: usdt,
    priority: value.priority,
    minimumUsdtBalanceAlert: value.minimumUsdtBalanceAlert,
    minimumBnbBalanceAlert: value.minimumBnbBalanceAlert,
    gasMode: value.gasMode,
    notes: value.notes || '',
  });
  res.status(201).json({ wallet: doc.toObject() });
});

export const updateFundingWallet = asyncHandler(async (req, res) => {
  const { value, error } = updateSchema.validate(req.body);
  if (error) throw badRequest(error.message);
  const wallet = await MasterFundingWallet.findById(req.params.id);
  if (!wallet) throw notFound('Wallet not found');
  if (value.privateKey) {
    assertPrivateKey(value.privateKey, wallet.walletAddress);
    wallet.encryptedPrivateKey = encrypt(value.privateKey);
  }
  for (const k of [
    'walletName',
    'priority',
    'minimumUsdtBalanceAlert',
    'minimumBnbBalanceAlert',
    'gasMode',
    'notes',
    'status',
  ]) {
    if (value[k] !== undefined) wallet[k] = value[k];
  }
  await wallet.save();
  res.json({ wallet: wallet.toObject() });
});

export const deleteFundingWallet = asyncHandler(async (req, res) => {
  const wallet = await MasterFundingWallet.findById(req.params.id);
  if (!wallet) throw notFound('Wallet not found');
  await wallet.deleteOne();
  res.json({ ok: true });
});

export const getFundingWalletBalances = asyncHandler(async (req, res) => {
  const wallet = await MasterFundingWallet.findById(req.params.id).lean();
  if (!wallet) throw notFound('Wallet not found');
  const [bnb, usdtRaw, meta] = await Promise.all([
    getBnbBalance(wallet.walletAddress),
    balanceOf(wallet.usdtContractAddress, wallet.walletAddress),
    fetchTokenMetadata(wallet.usdtContractAddress),
  ]);
  res.json({
    address: wallet.walletAddress,
    bnb: formatBnb(bnb),
    bnbRaw: bnb.toString(),
    usdt: ethers.formatUnits(usdtRaw, meta.decimals ?? 18),
    usdtRaw: usdtRaw.toString(),
    usdtDecimals: meta.decimals,
  });
});
