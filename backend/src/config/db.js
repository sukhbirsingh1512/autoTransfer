import mongoose from 'mongoose';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

export async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri);
  logger.info('MongoDB connected');
  return mongoose.connection;
}
