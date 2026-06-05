import { ethers } from 'ethers';
import { getHttpProvider, walletFromKey } from './provider.js';
import { withNonce } from './nonceManager.js';

export async function getBnbBalance(address) {
  return await getHttpProvider().getBalance(address);
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
