import "dotenv/config";
import http from "http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { seedSuperAdmin } from "./lib/seed-admin.js";
import { initSocket, emitToBid } from "./socket/index.js";
import { db } from "@workspace/db";
import { bids } from "@workspace/db/schema";
import { eq, and, lt, sql } from "drizzle-orm";

const rawPort = process.env["PORT"] || "3001";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function closeExpiredBids() {
  try {
    const expired = await db
      .select({ id: bids.id })
      .from(bids)
      .where(and(eq(bids.status, "active"), lt(bids.endTime, new Date())));

    if (expired.length === 0) return;

    await db
      .update(bids)
      .set({ status: "ended" })
      .where(and(eq(bids.status, "active"), lt(bids.endTime, new Date())));

    for (const { id } of expired) {
      emitToBid(id, "bid:ended", { bidId: id });
    }
  } catch (err) {
    logger.error({ err }, "Failed to close expired bids");
  }
}

async function ensureTablesExist() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS file_uploads (
        id text PRIMARY KEY,
        url text NOT NULL,
        uploader_id text NOT NULL REFERENCES users(id),
        size integer NOT NULL,
        type text NOT NULL,
        timestamp timestamp without time zone DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS fcm_tokens (
        id text PRIMARY KEY,
        user_id text NOT NULL REFERENCES users(id),
        token text NOT NULL,
        device_id text NOT NULL,
        platform text NOT NULL DEFAULT 'android',
        updated_at timestamp without time zone DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON fcm_tokens(user_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_fcm_tokens_device_id ON fcm_tokens(device_id)
    `);

    logger.info("Database tables verified successfully");
  } catch (err) {
    logger.error({ err }, "Failed to verify database tables");
  }
}

async function startup() {
  await ensureTablesExist();
  await seedSuperAdmin();

  const httpServer = http.createServer(app);
  initSocket(httpServer);

  setInterval(closeExpiredBids, 60 * 1000);
  closeExpiredBids();

  httpServer.listen(port, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    const host = process.env.HOST || `http://localhost:${port}`;
    logger.info({ port }, "Server listening");
    logger.info(`Admin Panel: ${host}/admin/`);
    logger.info(`API: ${host}/api/`);
    logger.info(`Socket.IO: ${host}`);
  });
}

startup().catch((err) => {
  logger.error({ err }, "Failed during startup");
  process.exit(1);
});
