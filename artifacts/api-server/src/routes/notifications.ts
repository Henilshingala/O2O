import { Router } from "express";
import { db } from "@workspace/db";
import { notifications, fcmTokens } from "@workspace/db/schema";
import { eq, desc, and, lt, count, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { parseCursorPagination, sendListResponse, buildOffsetMeta, parseOffsetPagination } from "../lib/pagination";
import { sendFcmToMany, type FcmPayload } from "../lib/fcm";

const router = Router();
router.use(requireAuth);

// Use UUID to eliminate timestamp-collision risk for concurrent inserts
const genId = (prefix: string) => `${prefix}_${randomUUID()}`;

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Get all FCM tokens for a user (multiple devices) */
async function getFcmTokensForUser(userId: string): Promise<string[]> {
  try {
    const rows = await db
      .select({ token: fcmTokens.token })
      .from(fcmTokens)
      .where(eq(fcmTokens.userId, userId));
    return rows.map((r) => r.token);
  } catch {
    return [];
  }
}

/** Remove stale/invalid FCM tokens */
async function removeFcmToken(token: string): Promise<void> {
  try {
    await db.delete(fcmTokens).where(eq(fcmTokens.token, token));
  } catch { /* ignore */ }
}

// ─── Core notification creator ────────────────────────────────────────────────

export interface NotificationOptions {
  /** Deep-link screen name, e.g. "chat/[id]" */
  screen?: string;
  /** Additional params for the deep-link */
  params?: Record<string, string>;
  /** Large icon URL (sender avatar) */
  imageUrl?: string;
  /** FCM notification channel id */
  channelId?: string;
}

export async function createNotification(
  userId: string,
  title: string,
  body: string,
  type: string,
  io?: { to: (room: string) => { emit: (event: string, data: unknown) => void } } | null,
  options?: NotificationOptions,
) {
  const id = genId("notif");
  const row = { id, userId, title, body, type, isRead: false };
  await db.insert(notifications).values(row);
  if (io) {
    io.to(`user:${userId}`).emit("notification:new", row);
  }

  // ── Firebase push notification ─────────────────────────────────────────────
  // Only push when the user might be offline/background.
  // The app shows an in-app banner when the socket fires "notification:new".
  const tokens = await getFcmTokensForUser(userId);
  if (tokens.length > 0) {
    const data: Record<string, string> = {
      type,
      notificationId: id,
      ...(options?.screen ? { screen: options.screen } : {}),
      ...(options?.params ?? {}),
    };

    const payload: FcmPayload = {
      title,
      body,
      channelId: options?.channelId ?? "o2o_default",
      data,
      ...(options?.imageUrl ? { imageUrl: options.imageUrl } : {}),
    };

    // Fire-and-forget — don't block the API response
    sendFcmToMany(tokens, payload).catch(() => { /* already logged inside */ });
  }

  return row;
}

// ─── FCM token management routes ──────────────────────────────────────────────

/**
 * POST /api/notifications/fcm-token
 * Register or refresh the FCM token for the authenticated user on a device.
 */
router.post("/fcm-token", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { token, deviceId } = req.body as { token?: string; deviceId?: string };
    if (!token || !deviceId) {
      return res.status(400).json({ error: "token and deviceId required" });
    }

    // Upsert: update existing row for (userId, deviceId) or insert a new one.
    const existing = await db
      .select({ id: fcmTokens.id })
      .from(fcmTokens)
      .where(and(eq(fcmTokens.userId, userId), eq(fcmTokens.deviceId, deviceId)))
      .limit(1);

    if (existing[0]) {
      await db
        .update(fcmTokens)
        .set({ token, updatedAt: new Date() })
        .where(eq(fcmTokens.id, existing[0].id));
    } else {
      await db.insert(fcmTokens).values({
        id: genId("fcm"),
        userId,
        token,
        deviceId,
        platform: "android",
        updatedAt: new Date(),
      });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /api/notifications/fcm-token
 * Remove the FCM token for the current device on logout.
 */
router.delete("/fcm-token", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { token, deviceId } = req.body as { token?: string; deviceId?: string };

    if (token) {
      await db
        .delete(fcmTokens)
        .where(and(eq(fcmTokens.userId, userId), eq(fcmTokens.token, token)));
    } else if (deviceId) {
      await db
        .delete(fcmTokens)
        .where(and(eq(fcmTokens.userId, userId), eq(fcmTokens.deviceId, deviceId)));
    } else {
      // Remove ALL tokens for user (full logout)
      await db.delete(fcmTokens).where(eq(fcmTokens.userId, userId));
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Notification CRUD routes ─────────────────────────────────────────────────

router.get("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const cursorMode = typeof req.query.cursor === "string";

    if (cursorMode) {
      const { limit, cursor } = parseCursorPagination(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });
      const whereClause = cursor
        ? and(eq(notifications.userId, userId), lt(notifications.id, cursor))
        : eq(notifications.userId, userId);
      const rows = await db
        .select()
        .from(notifications)
        .where(whereClause)
        .orderBy(desc(notifications.createdAt))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;
      return res.json({ data: page, pagination: { limit, nextCursor, hasMore } });
    }

    const { page, limit, offset } = parseOffsetPagination(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });
    const countResult = await db.select({ count: count() }).from(notifications).where(eq(notifications.userId, userId));
    const total = countResult[0]?.count ?? 0;
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
    return sendListResponse(res, req, rows, buildOffsetMeta(page, limit, total));
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/read", async (req: AuthRequest, res) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, req.params.id as string), eq(notifications.userId, req.user!.userId)));
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/read-all", async (req: AuthRequest, res) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, req.user!.userId));
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
