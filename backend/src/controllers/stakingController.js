import Joi from 'joi';
import { ethers } from 'ethers';
import { MonitoringWallet } from '../models/MonitoringWallet.js';
import { StakingRequest, STAKING_TERMINAL_STATUSES } from '../models/StakingRequest.js';
import { Funding } from '../models/Funding.js';
import { fetchTokenMetadata } from '../services/blockchain/token.js';
import { getStakingUser } from '../services/blockchain/staking.js';
import { asyncHandler, badRequest, conflict, notFound } from '../utils/errors.js';
import { config } from '../config/index.js';
import { enqueueStakingRequest, enqueueStakingRetry } from '../queues/index.js';

// referrerAddress is optional. By default we read it from the on-chain
// `users(walletAddress).referrer` record. Pass it explicitly only if you want to
// override the contract value (rare).
const createSchema = Joi.object({
  monitoringWalletId: Joi.string().required(),
  stakingAmount: Joi.string().pattern(/^\d+(\.\d+)?$/).required(),
  referrerAddress: Joi.string().optional(),
});

export const listStakingRequests = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '25', 10), 1), 200);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.wallet) filter.monitoringWalletAddress = req.query.wallet.toLowerCase();
  const [items, total] = await Promise.all([
    StakingRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    StakingRequest.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit });
});

export const getStakingRequest = asyncHandler(async (req, res) => {
  const item = await StakingRequest.findById(req.params.id).lean();
  if (!item) throw notFound('Staking request not found');
  const funding = await Funding.find({ stakingRequestId: item._id }).sort({ createdAt: -1 }).lean();
  res.json({ request: item, funding });
});

export const createStakingRequest = asyncHandler(async (req, res) => {
  const { value, error } = createSchema.validate(req.body);
  if (error) throw badRequest(error.message);

  const wallet = await MonitoringWallet.findById(value.monitoringWalletId);
  if (!wallet) throw notFound('Monitoring wallet not found');
  if (wallet.status !== 'ACTIVE') throw badRequest('Monitoring wallet is not active');

  // no existing active staking request
  const active = await StakingRequest.findOne({
    monitoringWalletId: wallet._id,
    status: { $nin: STAKING_TERMINAL_STATUSES },
  });
  if (active) throw conflict('Wallet already has an active staking request');

  const usdt = config.protocol.usdtAddress.toLowerCase();
  const stakingContract = config.protocol.stakingAddress.toLowerCase();

  // Resolve the referrer. Default: pull from the on-chain users() record.
  // The wallet must already be registered in the staking contract — this is an
  // admin tool for existing members only.
  let referrer;
  if (value.referrerAddress) {
    if (!ethers.isAddress(value.referrerAddress)) {
      throw badRequest('Invalid referrerAddress');
    }
    referrer = ethers.getAddress(value.referrerAddress).toLowerCase();
  } else {
    let user;
    try {
      user = await getStakingUser(wallet.walletAddress, stakingContract);
    } catch (err) {
      throw badRequest(`Unable to read staking contract: ${err.message}`);
    }
    if (!user.isExist) {
      throw badRequest(
        'Wallet is not registered in the staking contract. Register it on-chain first, then retry.'
      );
    }
    if (!user.referrer || user.referrer === ethers.ZeroAddress) {
      throw badRequest('On-chain referrer is the zero address; cannot proceed.');
    }
    referrer = user.referrer.toLowerCase();
  }

  const meta = await fetchTokenMetadata(usdt);
  const decimals = meta.decimals ?? 18;
  let rawAmount;
  try {
    rawAmount = ethers.parseUnits(value.stakingAmount, decimals);
  } catch {
    throw badRequest('Invalid staking amount');
  }
  if (rawAmount <= 0n) throw badRequest('Staking amount must be greater than zero');

  const request = await StakingRequest.create({
    monitoringWalletId: wallet._id,
    monitoringWalletAddress: wallet.walletAddress,
    usdtContractAddress: usdt,
    stakingContractAddress: stakingContract,
    stakingAmount: value.stakingAmount,
    stakingAmountRaw: rawAmount.toString(),
    usdtDecimals: decimals,
    referrerAddress: referrer,
    status: 'CREATED',
    createdBy: req.admin?.id,
  });

  wallet.walletMode = 'PAUSED_FOR_STAKING';
  wallet.activeStakingRequestId = request._id;
  wallet.monitoringPausedReason = 'Active staking request';
  await wallet.save();

  await enqueueStakingRequest({ stakingRequestId: request._id.toString() });
  res.status(201).json({ request: request.toObject() });
});

export const cancelStakingRequest = asyncHandler(async (req, res) => {
  const request = await StakingRequest.findById(req.params.id);
  if (!request) throw notFound('Staking request not found');
  if (request.stakingTxHash) {
    throw badRequest('Cannot cancel: staking transaction already broadcasted');
  }
  if (STAKING_TERMINAL_STATUSES.includes(request.status)) {
    throw badRequest('Request already terminal');
  }
  request.status = 'CANCELLED';
  await request.save();
  const wallet = await MonitoringWallet.findById(request.monitoringWalletId);
  if (wallet) {
    wallet.walletMode = 'ACTIVE_MONITORING';
    wallet.activeStakingRequestId = undefined;
    wallet.monitoringPausedReason = undefined;
    await wallet.save();
  }
  res.json({ request: request.toObject() });
});

/**
 * Read the staking contract's `users(walletAddress)` record for a monitoring wallet.
 * Used by the UI to pre-fill / confirm the referrer before creating a request.
 */
export const getWalletContractInfo = asyncHandler(async (req, res) => {
  const wallet = await MonitoringWallet.findById(req.params.id).lean();
  if (!wallet) throw notFound('Monitoring wallet not found');
  const stakingContract = config.protocol.stakingAddress.toLowerCase();
  let user;
  try {
    user = await getStakingUser(wallet.walletAddress, stakingContract);
  } catch (err) {
    return res.json({
      walletAddress: wallet.walletAddress,
      stakingContract,
      error: err.message,
    });
  }
  res.json({
    walletAddress: wallet.walletAddress,
    stakingContract,
    user,
  });
});

export const retryStakingRequest = asyncHandler(async (req, res) => {
  const request = await StakingRequest.findById(req.params.id);
  if (!request) throw notFound('Staking request not found');
  if (STAKING_TERMINAL_STATUSES.includes(request.status) && request.status !== 'STAKING_FAILED') {
    throw badRequest('Cannot retry request in terminal state');
  }
  request.errorMessage = undefined;
  await request.save();
  await enqueueStakingRetry({ stakingRequestId: request._id.toString() });
  res.json({ ok: true });
});
