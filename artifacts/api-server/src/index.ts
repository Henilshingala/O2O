import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { seedSuperAdmin } from "./lib/seed-admin";

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Seed super admin before starting server
seedSuperAdmin().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    logger.info(`Admin Panel: http://localhost:${port}/`);
    logger.info(`API: http://localhost:${port}/api/`);
  });
}).catch((err) => {
  logger.error({ err }, "Failed during startup");
  process.exit(1);
});
