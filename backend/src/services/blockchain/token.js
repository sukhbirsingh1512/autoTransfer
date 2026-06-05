import { ethers } from 'ethers';
import { ERC20_ABI } from './abi.js';
import { getHttpProvider, walletFromKey } from './provider.js';
import { withNonce } from './nonceManager.js';

export function tokenReader(contractAddress) {
  return new ethers.Contract(contractAddress, ERC20_ABI, getHttpProvider());
}

export async function fetchTokenMetadata(contractAddress) {
  const c = tokenReader(contractAddress);
  const [name, symbol, decimals] = await Promise.all([
    c.name().catch(() => null),
    c.symbol().catch(() => null),
    c.decimals().catch(() => null),
  ]);
  return {
    name,
    symbol,
    decimals: decimals !== null ? Number(decimals) : null,
  };
}

export async function balanceOf(contractAddress, owner) {
  return await tokenReader(contractAddress).balanceOf(owner);
}

export async function allowanceOf(contractAddress, owner, spender) {
  return await tokenReader(contractAddress).allowance(owner, spender);
}

export async function transferToken({ privateKey, contractAddress, to, rawAmount }) {
  const wallet = walletFromKey(privateKey);
  const contract = new ethers.Contract(contractAddress, ERC20_ABI, wallet);
  return await withNonce(wallet.address, async (nonce) => {
    const tx = await contract.transfer(to, rawAmount, { nonce });
    return { hash: tx.hash, wait: () => tx.wait() };
  });
}

export async function approveToken({ privateKey, contractAddress, spender, rawAmount }) {
  const wallet = walletFromKey(privateKey);
  const contract = new ethers.Contract(contractAddress, ERC20_ABI, wallet);
  return await withNonce(wallet.address, async (nonce) => {
    const tx = await contract.approve(spender, rawAmount, { nonce });
    return { hash: tx.hash, wait: () => tx.wait() };
  });
}
