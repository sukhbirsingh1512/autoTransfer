import { ethers } from 'ethers';
import { badRequest } from './errors.js';

export function assertAddress(value, field = 'address') {
  if (!ethers.isAddress(value)) throw badRequest(`Invalid BSC address: ${field}`);
  return ethers.getAddress(value);
}

export function assertPrivateKey(pk, expectedAddress) {
  try {
    const wallet = new ethers.Wallet(pk.startsWith('0x') ? pk : `0x${pk}`);
    if (expectedAddress && wallet.address.toLowerCase() !== expectedAddress.toLowerCase()) {
      throw badRequest('Private key does not match the wallet address');
    }
    return wallet;
  } catch (err) {
    if (err.statusCode) throw err;
    throw badRequest('Invalid private key');
  }
}
