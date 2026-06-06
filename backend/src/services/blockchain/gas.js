import { ethers } from 'ethers';
import { getHttpProvider, walletFromKey } from './provider.js';
import { withNonce } from './nonceManager.js';
import { ERC20_ABI, STAKING_ABI } from './abi.js';

export async function getBnbBalance(address) {
  return await getHttpProvider().getBalance(address);
}

async function feeWei() {
  const fee = await getHttpProvider().getFeeData();
  // BSC is legacy gas (gasPrice). EIP-1559 fields are usually null on BSC.
  return fee.gasPrice ?? fee.maxFeePerGas ?? 0n;
}

function withBufferPct(wei, pct) {
  return (wei * BigInt(100 + pct)) / 100n;
}

/**
 * Estimate the exact BNB (in wei) required for a BEP20 transfer.
 * Returns gasLimit * gasPrice * (1 + bufferPct/100).
 */
export async function estimateTransferGasWei({ from, contractAddress, to, rawAmount, bufferPct = 25 }) {
  const provider = getHttpProvider();
  const iface = new ethers.Interface(ERC20_ABI);
  const data = iface.encodeFunctionData('transfer', [to, rawAmount]);
  const gasLimit = await provider.estimateGas({ from, to: contractAddress, data });
  const gasPrice = await feeWei();
  return withBufferPct(gasLimit * gasPrice, bufferPct);
}

/**
 * Estimate BNB needed to run approve(spender, amount) + stake(amount, referrer)
 * back-to-back. Note: stake() can't be gas-estimated until the allowance is in
 * place, so we use a conservative fixed allowance for that piece.
 */
export async function estimateApproveAndStakeGasWei({
  from,
  usdtContract,
  stakingContract,
  rawAmount,
  bufferPct = 25,
  stakeGasFallback = 250000n,
}) {
  const provider = getHttpProvider();
  const erc20 = new ethers.Interface(ERC20_ABI);
  const approveData = erc20.encodeFunctionData('approve', [stakingContract, rawAmount]);
  const gasPrice = await feeWei();
  const approveGas = await provider.estimateGas({ from, to: usdtContract, data: approveData });
  // Try to estimate stake() as well — if it reverts (no allowance yet), fall back.
  let stakeGas = stakeGasFallback;
  try {
    const stakingIface = new ethers.Interface(STAKING_ABI);
    const stakeData = stakingIface.encodeFunctionData('stake', [rawAmount, ethers.ZeroAddress]);
    stakeGas = await provider.estimateGas({ from, to: stakingContract, data: stakeData });
  } catch {
    /* keep fallback */
  }
  return withBufferPct((approveGas + stakeGas) * gasPrice, bufferPct);
}

export async function sendBnb({ privateKey, to, rawAmountWei }) {
  const wallet = walletFromKey(privateKey);
  return await withNonce(wallet.address, async (nonce) => {
    const tx = await wallet.sendTransaction({ to, value: rawAmountWei, nonce });
    return { hash: tx.hash, wait: () => tx.wait() };
  });
}

export function parseBnb(human) {
  return ethers.parseEther(String(human));
}

export function formatBnb(raw) {
  return ethers.formatEther(raw);
}
