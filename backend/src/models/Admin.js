import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    status: { type: String, enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE' },
    lastLoginAt: Date,
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
  },
  { timestamps: true }
);

export const Admin = mongoose.model('Admin', adminSchema);
