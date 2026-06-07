import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from '../src/config/db.js';
import { Transfer } from '../src/models/Transfer.js';
import { GasTopUp } from '../src/models/GasTopUp.js';
import { getHttpProvider } from '../src/services/blockchain/provider.js';

await connectDb();
const provider = getHttpProvider();

console.log('Checking for stuck transfers and gas top-ups...');

// 1. Repair stuck GasTopUps
const stuckGasTopUps = await GasTopUp.find({ status: 'BROADCAST' });
for (const g of stuckGasTopUps) {
  if (g.transactionHash) {
    try {
      const receipt = await provider.getTransactionReceipt(g.transactionHash);
      if (receipt) {
        g.status = receipt.status === 1 ? 'CONFIRMED' : 'FAILED';
        await g.save();
        console.log(`Updated GasTopUp ${g._id} (${g.transactionHash}) to ${g.status}`);
      } else {
        // Not mined, check if old
        const ageMin = (Date.now() - g.createdAt.getTime()) / 60000;
        if (ageMin > 15) {
          g.status = 'FAILED';
          g.errorMessage = 'Stuck in BROADCAST for too long';
          await g.save();
          console.log(`Failed stuck GasTopUp ${g._id} (age: ${ageMin.toFixed(1)}m)`);
        }
      }
    } catch (err) {
      console.error(`Error checking GasTopUp ${g._id}:`, err.message);
    }
  }
}

// 2. Repair stuck Transfers (older than 5 minutes in pending states)
const stuckStates = ['DETECTED', 'GAS_TOP_UP_PENDING', 'GAS_READY'];
const stuckTransfers = await Transfer.find({
  status: { $in: stuckStates },
  createdAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) }
});

for (const t of stuckTransfers) {
  t.status = 'FAILED';
  t.errorMessage = 'Interrupted or stuck in pending state for too long';
  await t.save();
  console.log(`Marked stuck Transfer ${t._id} (USDT ${t.amount}) as FAILED`);
}

await mongoose.disconnect();
console.log('Repair complete.');
