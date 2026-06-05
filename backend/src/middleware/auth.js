import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { unauthorized } from '../utils/errors.js';
import { Admin } from '../models/Admin.js';

export async function requireAdmin(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw unauthorized();
    const payload = jwt.verify(token, config.auth.jwtSecret);
    const admin = await Admin.findById(payload.sub).lean();
    if (!admin || admin.status !== 'ACTIVE') throw unauthorized('Admin not active');
    req.admin = { id: admin._id.toString(), email: admin.email, name: admin.name };
    next();
  } catch (err) {
    if (err.statusCode) return next(err);
    next(unauthorized('Invalid or expired token'));
  }
}

export function signAdminToken(admin) {
  return jwt.sign({ sub: admin._id.toString(), email: admin.email }, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiresIn,
  });
}
