import Joi from 'joi';
import { MonitoringWallet } from '../models/MonitoringWallet.js';
import { encrypt } from '../utils/crypto.js';
import { asyncHandler, badRequest, conflict, notFound } from '../utils/errors.js';
import { assertAddress, assertPrivateKey } from '../utils/validators.js';

const baseSchema = {
  walletName: Joi.string().min(1).max(100).required(),
  walletAddress: Joi.string().required(),
  privateKey: Joi.string().required(),
  secureReceivingWallet: Joi.string().required(),
  minimumGasBalance: Joi.string().default('0.001'),
  topUpAmount: Joi.string().default('0.002'),
  gasMode: Joi.string().valid('FIXED', 'ESTIMATED').default('ESTIMATED'),
  notes: Joi.string().allow('').optional(),
};

const createSchema = Joi.object(baseSchema);
const updateSchema = Joi.object({
  walletName: Joi.string().min(1).max(100),
  privateKey: Joi.string(),
  secureReceivingWallet: Joi.string(),
  minimumGasBalance: Joi.string(),
  topUpAmount: Joi.string(),
  gasMode: Joi.string().valid('FIXED', 'ESTIMATED'),
  notes: Joi.string().allow(''),
  status: Joi.string().valid('ACTIVE', 'DISABLED'),
}).min(1);

export const listWallets = asyncHandler(async (req, res) => {
  const wallets = await MonitoringWallet.find().sort({ createdAt: -1 }).lean();
  res.json({ wallets });
});

export const getWallet = asyncHandler(async (req, res) => {
  const wallet = await MonitoringWallet.findById(req.params.id).lean();
  if (!wallet) throw notFound('Wallet not found');
  res.json({ wallet });
});

export const createWallet = asyncHandler(async (req, res) => {
  const { value, error } = createSchema.validate(req.body);
  if (error) throw badRequest(error.message);
  const walletAddress = assertAddress(value.walletAddress, 'walletAddress');
  const secureReceivingWallet = assertAddress(value.secureReceivingWallet, 'secureReceivingWallet');
  if (walletAddress.toLowerCase() === secureReceivingWallet.toLowerCase()) {
    throw badRequest('Secure receiving wallet must differ from monitoring wallet');
  }
  assertPrivateKey(value.privateKey, walletAddress);

  const exists = await MonitoringWallet.findOne({ walletAddress: walletAddress.toLowerCase() });
  if (exists) throw conflict('Wallet address already exists');

  const doc = await MonitoringWallet.create({
    walletName: value.walletName,
    walletAddress: walletAddress.toLowerCase(),
    secureReceivingWallet: secureReceivingWallet.toLowerCase(),
    encryptedPrivateKey: encrypt(value.privateKey),
    minimumGasBalance: value.minimumGasBalance,
    topUpAmount: value.topUpAmount,
    gasMode: value.gasMode,
    notes: value.notes || '',
  });
  res.status(201).json({ wallet: doc.toObject() });
});

export const updateWallet = asyncHandler(async (req, res) => {
  const { value, error } = updateSchema.validate(req.body);
  if (error) throw badRequest(error.message);
  const wallet = await MonitoringWallet.findById(req.params.id);
  if (!wallet) throw notFound('Wallet not found');

  if (value.privateKey) {
    assertPrivateKey(value.privateKey, wallet.walletAddress);
    wallet.encryptedPrivateKey = encrypt(value.privateKey);
  }
  if (value.secureReceivingWallet) {
    const sr = assertAddress(value.secureReceivingWallet, 'secureReceivingWallet');
    if (sr.toLowerCase() === wallet.walletAddress) {
      throw badRequest('Secure receiving wallet must differ from monitoring wallet');
    }
    wallet.secureReceivingWallet = sr.toLowerCase();
  }
  for (const k of ['walletName', 'minimumGasBalance', 'topUpAmount', 'gasMode', 'notes', 'status']) {
    if (value[k] !== undefined) wallet[k] = value[k];
  }
  await wallet.save();
  res.json({ wallet: wallet.toObject() });
});

export const deleteWallet = asyncHandler(async (req, res) => {
  const wallet = await MonitoringWallet.findById(req.params.id);
  if (!wallet) throw notFound('Wallet not found');
  await wallet.deleteOne();
  res.json({ ok: true });
});

export const releaseFromStaking = asyncHandler(async (req, res) => {
  const wallet = await MonitoringWallet.findById(req.params.id);
  if (!wallet) throw notFound('Wallet not found');
  wallet.walletMode = 'ACTIVE_MONITORING';
  wallet.activeStakingRequestId = undefined;
  wallet.monitoringPausedReason = undefined;
  await wallet.save();
  res.json({ wallet: wallet.toObject() });
});
