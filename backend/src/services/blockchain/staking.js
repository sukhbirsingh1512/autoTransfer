import { ethers } from 'ethers';
import { STAKING_ABI } from './abi.js';
import { getHttpProvider, walletFromKey } from './provider.js';
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

/**
 * Read the staking contract's `users(address)` mapping for a wallet.
 * Returns a normalized object; `isExist=false` means the wallet has never joined.
 */
export async function getStakingUser(walletAddress, stakingContract = config.protocol.stakingAddress) {
  const contract = new ethers.Contract(stakingContract, STAKING_ABI, getHttpProvider());
  const r = await contract.users(walletAddress);
  return {
    isExist: Boolean(r.isExist ?? r[0]),
    userId: (r.userId ?? r[1]).toString(),
    referrer: (r.referrer ?? r[2]),
    joiningTime: Number(r.joiningTime ?? r[3]),
    boosterLastClaim: Number(r.boosterLastClaim ?? r[4]),
    swapWallet: (r.swapWallet ?? r[5]).toString(),
    selfInvestment: (r.selfInvestment ?? r[6]).toString(),
    booster: Boolean(r.booster ?? r[7]),
  };
}
