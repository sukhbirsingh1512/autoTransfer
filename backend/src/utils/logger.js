import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.logLevel,
  transport:
    config.env === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
  redact: {
    paths: ['privateKey', 'encryptedPrivateKey', '*.privateKey', '*.encryptedPrivateKey', 'password', 'passwordHash'],
    censor: '[REDACTED]',
  },
});
