import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from '../src/config/db.js';
import { Admin } from '../src/models/Admin.js';

// Non-interactive seed: reads SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME from env.
// Useful for quick demos. For real use, prefer scripts/createAdmin.js.
const email = (process.env.SEED_ADMIN_EMAIL || 'admin@example.com').toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD || 'password123';
const name = process.env.SEED_ADMIN_NAME || 'Admin';

async function main() {
  await connectDb();
  const existing = await Admin.findOne({ email });
  if (existing) {
    console.log(`Admin ${email} already exists (id=${existing._id})`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await Admin.create({ name, email, passwordHash });
    console.log(`Created admin ${admin.email} (id=${admin._id})`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
