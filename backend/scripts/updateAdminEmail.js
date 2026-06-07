import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from '../src/config/db.js';
import { Admin } from '../src/models/Admin.js';

async function main() {
  await connectDb();
  
  const oldEmail = 'admin@example.com';
  const newEmail = 'royalptk9@gmail.com';
  
  const existingNew = await Admin.findOne({ email: newEmail });
  if (existingNew) {
    console.log(`Admin with email ${newEmail} already exists`);
  } else {
    const admin = await Admin.findOne({ email: oldEmail });
    if (admin) {
      admin.email = newEmail;
      await admin.save();
      console.log(`Updated admin email from ${oldEmail} to ${newEmail}`);
    } else {
      console.log(`No admin found with email ${oldEmail}`);
    }
  }
  
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
