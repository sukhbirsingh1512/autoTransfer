import { ethers } from 'ethers';
import Joi from 'joi';
import { MonitoringWallet } from '../models/MonitoringWallet.js';
import { Token } from '../models/Token.js';
import { SweeperApproval } from '../models/SweeperApproval.js';
import { decrypt } from '../utils/crypto.js';
import { allowanceOf, approveToken } from '../services/blockchain/token.js';
import { getSweeperOwner } from '../services/blockchain/sweeper.js';
import {
  ensureBnbBalance,
  ensureBnbExact,
} from '../services/gasTopUpService.js';
import {
  estimateTransferGasWei, // not used here but keeps import surface consistent
  parseBnb,
} from '../services/blockchain/gas.js';
import { ERC20_ABI } from '../services/blockchain/abi.js';
import { getHttpProvider } from '../services/blockchain/provider.js';
import { asyncHandler, badRequest, notFound } from '../utils/errors.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const MAX_UINT256 = (1n << 256n) - 1n;

export const getSweeperStatus = asyncHandler(async (_req, res) => {
  const addr = config.protocol.sweeperAddress || null;
  let owner = null;
  let error = null;
  if (addr) {
    try {
      owner = await getSweeperOwner();
    } catch (err) {
      error = err.message;
    }
  }
  res.json({ sweeperContract: addr, owner, error });
});

/**
 * Set up the sweeper allowance for one (monitoringWallet, token) pair.
 *
 * Flow:
 *   1. Ensure the monitoring wallet has just enough BNB to pay for one approve()
 *      tx (we top it up from a Master Gas Wallet, using estimated mode). This is
 *      the only time we ever need to send BNB to this wallet for the sweeper path.
 *   2. Sign + broadcast token.approve(sweeper, MAX_UINT256) from the monitoring
 *      wallet.
 *   3. Save the SweeperApproval record.
 *
 * Returns the SweeperApproval doc.
 */
const setupSchema = Joi.object({
  monitoringWalletId: Joi.string().required(),
  tokenId: Joi.string().required(),
});

export const setupApproval = asyncHandler(async (req, res) => {
  const { value, error } = setupSchema.validate(req.body);
  if (error) throw badRequest(error.message);
  if (!config.protocol.sweeperAddress) {
    throw badRequest('SWEEPER_CONTRACT_ADDRESS is not configured on the server.');
  }

  const [wallet, token] = await Promise.all([
    MonitoringWallet.findById(value.monitoringWalletId).select('+encryptedPrivateKey'),
    Token.findById(value.tokenId),
  ]);
  if (!wallet) throw notFound('Monitoring wallet not found');
  if (!token) throw notFound('Token not found');

  const sweeperAddr = config.protocol.sweeperAddress;

  // If we already have a CONFIRMED approval that still holds on-chain, short-circuit.
  const existing = await SweeperApproval.findOne({
    monitoringWalletAddress: wallet.walletAddress,
    tokenContractAddress: token.contractAddress,
    sweeperContractAddress: sweeperAddr,
  });
  if (existing && existing.status === 'CONFIRMED') {
    const live = await allowanceOf(token.contractAddress, wallet.walletAddress, sweeperAddr);
    if (live >= MAX_UINT256 / 2n) {
      return res.json({ approval: existing.toObject(), reused: true });
    }
    // On-chain allowance vanished (revoked); fall through and re-approve.
  }

  // Estimate the BNB needed for one approve() call: 21000 base + ~46000 erc20 = ~67000 gas.
  // We use the live gas price + 25% buffer via parseBnb on a small fixed cap to keep this
  // simple — it's a one-time op so the precision doesn't matter much.
  const provider = getHttpProvider();
  const iface = new ethers.Interface(ERC20_ABI);
  const data = iface.encodeFunctionData('approve', [sweeperAddr, MAX_UINT256]);

  // Estimate gas with a fallback (some tokens revert estimateGas if balance is 0).
  let gasLimit = 70000n;
  try {
    gasLimit = await provider.estimateGas({ from: wallet.walletAddress, to: token.contractAddress, data });
  } catch {
    /* keep fallback */
  }
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? ethers.parseUnits('5', 'gwei');
  const requiredWei = (gasLimit * gasPrice * 125n) / 100n; // +25% buffer

  // Top up so the wallet can pay the approve fee.
  const approval = await SweeperApproval.findOneAndUpdate(
    {
      monitoringWalletAddress: wallet.walletAddress,
      tokenContractAddress: token.contractAddress,
      sweeperContractAddress: sweeperAddr,
    },
    {
      $set: {
        monitoringWallet: wallet._id,
        tokenContract: token._id,
        status: 'PENDING',
        errorMessage: undefined,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  try {
    const topUp = await ensureBnbExact({
      targetAddress: wallet.walletAddress,
      targetWalletId: wallet._id,
      targetWalletType: 'MonitoringWallet',
      requiredWei,
      minTopUpWei: parseBnb('0.00001'),
    });
    if (topUp.txHash) {
      approval.gasTopUpTxHash = topUp.txHash;
      await approval.save();
    }

    const pk = decrypt(wallet.encryptedPrivateKey);
    const { hash, wait } = await approveToken({
      privateKey: pk,
      contractAddress: token.contractAddress,
      spender: sweeperAddr,
      rawAmount: MAX_UINT256,
    });
    approval.approvalTxHash = hash;
    await approval.save();

    const receipt = await wait();
    approval.status = receipt.status === 1 ? 'CONFIRMED' : 'FAILED';
    if (approval.status === 'FAILED') {
      approval.errorMessage = 'approve() reverted on-chain';
    }
    await approval.save();

    if (approval.status !== 'CONFIRMED') {
      throw new Error(approval.errorMessage || 'Approval failed');
    }
    res.status(201).json({ approval: approval.toObject() });
  } catch (err) {
    approval.status = 'FAILED';
    approval.errorMessage = err?.message || String(err);
    await approval.save();
    logger.error({ err, wallet: wallet.walletAddress, token: token.contractAddress }, 'Sweeper approval setup failed');
    throw badRequest(approval.errorMessage);
  }
});

/**
 * List all sweeper approvals.
 *
 * Optional filter: ?wallet=<address>
 */
export const listApprovals = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.wallet) filter.monitoringWalletAddress = String(req.query.wallet).toLowerCase();
  const items = await SweeperApproval.find(filter).sort({ createdAt: -1 }).lean();
  res.json({ items, sweeperContract: config.protocol.sweeperAddress || null });
});

/**
 * Mark an approval as REVOKED (admin action; does not call the chain).
 * Useful when you've revoked from the wallet manually.
 */
export const markRevoked = asyncHandler(async (req, res) => {
  const a = await SweeperApproval.findById(req.params.id);
  if (!a) throw notFound('Approval not found');
  a.status = 'REVOKED';
  await a.save();
  res.json({ approval: a.toObject() });
});
