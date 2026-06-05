import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

async function main() {
  await connectDb();
  const app = createApp();
  app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, 'API listening');
  });
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start API');
  process.exit(1);
});
