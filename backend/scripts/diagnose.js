import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from '../src/config/db.js';
import { MonitoringWallet } from '../src/models/MonitoringWallet.js';
import { Token } from '../src/models/Token.js';
import { Transfer } from '../src/models/Transfer.js';
import { GasTopUp } from '../src/models/GasTopUp.js';
import { MasterGasWallet } from '../src/models/MasterGasWallet.js';
import { balanceOf } from '../src/services/blockchain/token.js';
import { getBnbBalance, formatBnb } from '../src/services/blockchain/gas.js';
import { ethers } from 'ethers';
import { Queue } from 'bullmq';
import { createRedisConnection } from '../src/config/redis.js';

await connectDb();
const conn = createRedisConnection();

const wallets = await MonitoringWallet.find().lean();
const tokens = await Token.find().lean();
const gasWallets = await MasterGasWallet.find().lean();

console.log('\n=== Monitoring Wallets ===');
for (const w of wallets) {
  console.log(`  ${w.walletName}`);
  console.log(`    addr     : ${w.walletAddress}`);
  console.log(`    status   : ${w.status}`);
  console.log(`    mode     : ${w.walletMode}`);
  console.log(`    secure   : ${w.secureReceivingWallet}`);
  console.log(`    min/topup: ${w.minimumGasBalance} / ${w.topUpAmount} BNB`);
  const bnb = await getBnbBalance(w.walletAddress);
  console.log(`    BNB now  : ${formatBnb(bnb)}`);
  for (const t of tokens) {
    const bal = await balanceOf(t.contractAddress, w.walletAddress);
    if (bal > 0n) {
      console.log(`    ${t.tokenSymbol.padEnd(8)}: ${ethers.formatUnits(bal, t.decimals)} (raw ${bal.toString()})`);
    } else {
      console.log(`    ${t.tokenSymbol.padEnd(8)}: 0`);
    }
  }
}

console.log('\n=== Tokens ===');
for (const t of tokens) {
  console.log(`  ${t.tokenSymbol}  ${t.contractAddress}  decimals=${t.decimals}  status=${t.status}  minSweep=${t.minimumSweepAmount}`);
}

console.log('\n=== Master Gas Wallets ===');
for (const g of gasWallets) {
  const bnb = await getBnbBalance(g.walletAddress);
  console.log(`  ${g.walletName}  ${g.walletAddress}  status=${g.status}  BNB=${formatBnb(bnb)}`);
}

console.log('\n=== Recent transfers (last 10) ===');
const recent = await Transfer.find().sort({ createdAt: -1 }).limit(10).lean();
for (const t of recent) {
  console.log(`  [${t.createdAt.toISOString()}] ${t.status.padEnd(20)} ${t.tokenSymbol} ${t.amount}  in=${t.incomingTxHash?.slice(0,12) || '-'} out=${t.outgoingTxHash?.slice(0,12) || '-'} err=${t.errorMessage || '-'}`);
}

console.log('\n=== Recent gas top-ups (last 10) ===');
const gtu = await GasTopUp.find().sort({ createdAt: -1 }).limit(10).lean();
for (const g of gtu) {
  console.log(`  [${g.createdAt.toISOString()}] ${g.status.padEnd(15)} to=${g.receiverWalletAddress?.slice(0,12)} ${g.bnbAmount} BNB  err=${g.errorMessage || '-'}`);
}

console.log('\n=== BullMQ token-sweep queue ===');
const q = new Queue('token-sweep', { connection: conn });
const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
console.log(' ', counts);
const waiting = await q.getWaiting(0, 5);
const failed = await q.getFailed(0, 5);
console.log('  waiting jobs:', waiting.map(j => ({ id: j.id, name: j.name, data: j.data })));
console.log('  failed jobs:', failed.map(j => ({ id: j.id, attempts: j.attemptsMade, failedReason: j.failedReason })));
await q.close();

await mongoose.disconnect();
await conn.quit();
