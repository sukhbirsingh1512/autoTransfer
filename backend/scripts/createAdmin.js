import 'dotenv/config';
import readline from 'readline';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from '../src/config/db.js';
import { Admin } from '../src/models/Admin.js';

function ask(question, { hidden = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise((resolve) => {
    if (hidden) {
      process.stdout.write(question);
      process.stdin.setRawMode?.(true);
      let buf = '';
      const onData = (chunk) => {
        const ch = chunk.toString('utf8');
        if (ch === '\n' || ch === '\r' || ch === '') {
          process.stdin.setRawMode?.(false);
          process.stdin.removeListener('data', onData);
          rl.close();
          process.stdout.write('\n');
          resolve(buf);
        } else if (ch === '') {
          process.exit(0);
        } else if (ch === '' || ch === '\b') {
          buf = buf.slice(0, -1);
        } else {
          buf += ch;
        }
      };
      process.stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

async function main() {
  await connectDb();
  const name = (await ask('Admin name: ')).trim();
  const email = (await ask('Admin email: ')).trim().toLowerCase();
  const password = await ask('Admin password (min 8 chars): ', { hidden: true });
  const password2 = await ask('Confirm password: ', { hidden: true });

  if (!name || !email || password.length < 8) {
    console.error('Invalid input');
    process.exit(1);
  }
  if (password !== password2) {
    console.error('Passwords do not match');
    process.exit(1);
  }

  const existing = await Admin.findOne({ email });
  if (existing) {
    console.error(`Admin with email ${email} already exists`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await Admin.create({ name, email, passwordHash });
  console.log(`Created admin ${admin.email} (id=${admin._id})`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
