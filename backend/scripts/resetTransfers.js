import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from '../src/config/db.js';
import { Transfer } from '../src/models/Transfer.js';

await connectDb();
const res = await Transfer.deleteMany({});
console.log(`Deleted ${res.deletedCount} transfer record(s)`);
await mongoose.disconnect();
