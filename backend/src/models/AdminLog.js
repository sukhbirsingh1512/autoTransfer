import mongoose from 'mongoose';

const adminLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', index: true },
    action: { type: String, required: true },
    module: { type: String, required: true, index: true },
    details: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AdminLog = mongoose.model('AdminLog', adminLogSchema);
