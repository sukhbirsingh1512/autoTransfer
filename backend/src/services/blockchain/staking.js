import { ethers } from 'ethers';
import { STAKING_ABI } from './abi.js';
import { walletFromKey } from './provider.js';
import { withNonce } from './nonceManager.js';
import { config } from '../../config/index.js';

export async function stake({ privateKey, rawAmount, referrerAddress, stakingContract = config.protocol.stakingAddress }) {
  const wallet = walletFromKey(privateKey);
  const contract = new ethers.Contract(stakingContract, STAKING_ABI, wallet);
  return await withNonce(wallet.address, async (nonce) => {
    const tx = await contract.stake(rawAmount, referrerAddress, { nonce });
    return { hash: tx.hash, wait: () => tx.wait() };
  });
}
