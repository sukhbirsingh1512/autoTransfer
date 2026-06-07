import { ethers } from 'ethers';
import { getHttpProvider, walletFromKey } from './provider.js';
import { withNonce } from './nonceManager.js';
import { config } from '../../config/index.js';

// We only need the calls our backend invokes. Full ABI lives in
// backend/contracts/Sweeper.json after `npm run sweeper:build`.
export const SWEEPER_MIN_ABI = [
  'function owner() view returns (address)',
  'function drain(address token, address from, address to) returns (uint256)',
  'function drainAmount(address token, address from, address to, uint256 amount)',
  'event Drained(address indexed token, address indexed from, address indexed to, uint256 amount)',
];

export function sweeperReader() {
  if (!config.protocol.sweeperAddress) return null;
  return new ethers.Contract(config.protocol.sweeperAddress, SWEEPER_MIN_ABI, getHttpProvider());
}

export async function getSweeperOwner() {
  const c = sweeperReader();
  if (!c) return null;
  return await c.owner();
}

/**
 * Call Sweeper.drain(token, from, to) signed by the relay wallet (=the contract owner).
 * One tx — pulls the full balance of `token` from `from` to `to`. No BNB ever
 * needs to be in `from`.
 */
export async function sweeperDrain({ relayPrivateKey, tokenAddress, from, to, gasPriceWei }) {
  if (!config.protocol.sweeperAddress) {
    throw new Error('SWEEPER_CONTRACT_ADDRESS is not set');
  }
  const wallet = walletFromKey(relayPrivateKey);
  const contract = new ethers.Contract(config.protocol.sweeperAddress, SWEEPER_MIN_ABI, wallet);
  return await withNonce(wallet.address, async (nonce) => {
    const overrides = { nonce };
    if (gasPriceWei) overrides.gasPrice = gasPriceWei;
    const tx = await contract.drain(tokenAddress, from, to, overrides);
    return { hash: tx.hash, wait: () => tx.wait() };
  });
}
