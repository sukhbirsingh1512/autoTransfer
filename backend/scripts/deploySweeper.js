// Deploy contracts/Sweeper.json using a Master Gas Wallet as the deployer / owner.
//
// Usage:
//   npm run sweeper:build       # if you haven't compiled
//   node scripts/deploySweeper.js [gasWalletAddress]
//
// If no gasWalletAddress is given, uses the highest-priority ACTIVE Master Gas Wallet.
// On success, prints the deployed contract address. Save it in backend/.env as
// SWEEPER_CONTRACT_ADDRESS=0x...  and restart workers.
//
import 'dotenv/config';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import mongoose from 'mongoose';
import { connectDb } from '../src/config/db.js';
import { MasterGasWallet } from '../src/models/MasterGasWallet.js';
import { decrypt } from '../src/utils/crypto.js';
import { getHttpProvider } from '../src/services/blockchain/provider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACT_PATH = path.resolve(__dirname, '..', 'contracts', 'Sweeper.json');

async function pickDeployer(addressOverride) {
  if (addressOverride) {
    const w = await MasterGasWallet.findOne({ walletAddress: addressOverride.toLowerCase() })
      .select('+encryptedPrivateKey');
    if (!w) throw new Error(`Gas wallet ${addressOverride} not found in DB`);
    return w;
  }
  const w = await MasterGasWallet.findOne({ status: 'ACTIVE' })
    .select('+encryptedPrivateKey')
    .sort({ priority: 1, createdAt: 1 });
  if (!w) throw new Error('No active Master Gas Wallet found. Add one in the admin panel first.');
  return w;
}

async function main() {
  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'));
  await connectDb();
  const deployerDoc = await pickDeployer(process.argv[2]);
  const provider = getHttpProvider();
  const wallet = new ethers.Wallet(decrypt(deployerDoc.encryptedPrivateKey), provider);

  const bal = await provider.getBalance(wallet.address);
  console.log(`Deployer: ${wallet.address}  (${ethers.formatEther(bal)} BNB)`);
  if (bal === 0n) throw new Error('Deployer has 0 BNB — fund it before deploying');

  console.log('Deploying Sweeper…');
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  // Pass the deployer address as the initial owner explicitly so it's auditable.
  const contract = await factory.deploy(wallet.address);
  const tx = contract.deploymentTransaction();
  console.log(`  tx hash: ${tx.hash}`);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();

  // Sanity: read owner back.
  const sweeper = new ethers.Contract(addr, artifact.abi, provider);
  const owner = await sweeper.owner();

  console.log('\nDeployed.');
  console.log(`  Sweeper address : ${addr}`);
  console.log(`  Owner           : ${owner}`);
  console.log(`  Block explorer  : (open the tx hash above in your network's BscScan)`);
  console.log(`\nNext steps:`);
  console.log(`  1. Add to backend/.env:   SWEEPER_CONTRACT_ADDRESS=${addr}`);
  console.log(`  2. Restart workers:       npm run workers  (or pm2 restart fundsTransfer-workers)`);
  console.log(`  3. From the admin panel, run "Set up Sweeper" on each monitoring wallet+token pair you want gasless sweeps for.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
