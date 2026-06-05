import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema(
  {
    tokenName: { type: String, required: true, trim: true },
    tokenSymbol: { type: String, required: true, trim: true, uppercase: true },
    contractAddress: { type: String, required: true, unique: true, lowercase: true, trim: true },
    decimals: { type: Number, required: true, min: 0, max: 36 },
    minimumSweepAmount: { type: String, default: '0' }, // human-readable
    status: { type: String, enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE' },
    notes: String,
  },
  { timestamps: true }
);

tokenSchema.index({ status: 1 });

export const Token = mongoose.model('Token', tokenSchema);
