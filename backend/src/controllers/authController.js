import bcrypt from 'bcryptjs';
import Joi from 'joi';
import { Admin } from '../models/Admin.js';
import { signAdminToken } from '../middleware/auth.js';
import { AdminLog } from '../models/AdminLog.js';
import { asyncHandler, badRequest, unauthorized } from '../utils/errors.js';

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

export const login = asyncHandler(async (req, res) => {
  const { value, error } = loginSchema.validate(req.body);
  if (error) throw badRequest(error.message);
  const admin = await Admin.findOne({ email: value.email.toLowerCase() }).select('+passwordHash');
  if (!admin) throw unauthorized('Invalid credentials');
  if (admin.status !== 'ACTIVE') throw unauthorized('Account disabled');
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    throw unauthorized('Account temporarily locked');
  }
  const ok = await bcrypt.compare(value.password, admin.passwordHash);
  if (!ok) {
    admin.failedLoginAttempts = (admin.failedLoginAttempts || 0) + 1;
    if (admin.failedLoginAttempts >= 5) {
      admin.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      admin.failedLoginAttempts = 0;
    }
    await admin.save();
    throw unauthorized('Invalid credentials');
  }
  admin.failedLoginAttempts = 0;
  admin.lockedUntil = undefined;
  admin.lastLoginAt = new Date();
  await admin.save();
  const token = signAdminToken(admin);
  await AdminLog.create({
    adminId: admin._id,
    action: 'LOGIN',
    module: 'auth',
    details: {},
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || '',
  });
  res.json({
    token,
    admin: { id: admin._id, name: admin.name, email: admin.email },
  });
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});

export const changePassword = asyncHandler(async (req, res) => {
  const { value, error } = changePasswordSchema.validate(req.body);
  if (error) throw badRequest(error.message);
  const admin = await Admin.findById(req.admin.id).select('+passwordHash');
  if (!admin) throw unauthorized();
  const ok = await bcrypt.compare(value.currentPassword, admin.passwordHash);
  if (!ok) throw unauthorized('Current password incorrect');
  admin.passwordHash = await bcrypt.hash(value.newPassword, 12);
  await admin.save();
  res.json({ ok: true });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ admin: req.admin });
});

export const logout = asyncHandler(async (req, res) => {
  await AdminLog.create({
    adminId: req.admin.id,
    action: 'LOGOUT',
    module: 'auth',
    details: {},
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || '',
  });
  res.json({ ok: true });
});
