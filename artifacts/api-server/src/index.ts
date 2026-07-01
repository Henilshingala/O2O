import "dotenv/config";
import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { seedSuperAdmin } from "./lib/seed-admin";
import { initSocket } from "./socket/index";
import { db } from "@workspace/db";
import { bids } from "@workspace/db/schema";
import { eq, and, lt } from "drizzle-orm";

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function closeExpiredBids() {
  try {
    await db
      .update(bids)
      .set({ status: "ended" })
      .where(and(eq(bids.status, "active"), lt(bids.endTime, new Date())));
  } catch (err) {
    logger.error({ err }, "Failed to close expired bids");
  }
}

seedSuperAdmin().then(() => {
  const httpServer = http.createServer(app);
  initSocket(httpServer);

  setInterval(closeExpiredBids, 60 * 1000);
  closeExpiredBids();

  httpServer.listen(port, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    logger.info(`Admin Panel: http://localhost:${port}/`);
    logger.info(`API: http://localhost:${port}/api/`);
    logger.info(`Socket.IO: ws://localhost:${port}`);
  });
}).catch((err) => {
  logger.error({ err }, "Failed during startup");
  process.exit(1);
});
