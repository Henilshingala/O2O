import { Router } from "express";
import { db } from "@workspace/db";
import { notifications, fcmTokens, users } from "@workspace/db/schema";
import { eq, desc, and, lt, count, ne } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { parseCursorPagination, sendListResponse, buildOffsetMeta, parseOffsetPagination } from "../lib/pagination";
import { sendFcmToMany, sendFcmDataOnly, type FcmPayload } from "../lib/fcm";
import { logger } from "../lib/logger.js";

const router = Router();
router.use(requireAuth);

const genId = (prefix: string) => `${prefix}_${randomUUID()}`;

// ─── FCM token helpers ────────────────────────────────────────────────────────

/**
 * Fetch all FCM tokens for a recipient.
 * The sender exclusion is implicit: we only query the RECIPIENT's tokens.
 * The recipient and sender are always different users, so no additional filter
 * is needed. The senderId is kept in the signature for future audit logging.
 */
async function getFcmTokensForRecipient(
  recipientId: string,
  _excludeSenderId?: string,  // reserved — recipient ≠ sender by design
): Promise<string[]> {
  try {
    const rows = await db
      .select({ token: fcmTokens.token })
      .from(fcmTokens)
      .where(eq(fcmTokens.userId, recipientId));
    return [...new Set(rows.map((r) => r.token).filter(Boolean))];
  } catch {
    return [];
  }
}

/**
 * Fetch the sender's avatar URL for rich notification large-icon.
 * Returns undefined if not found (graceful degradation).
 */
async function getSenderAvatar(senderId?: string): Promise<string | undefined> {
  if (!senderId) return undefined;
  try {
    const rows = await db
      .select({ avatar: users.avatar })
      .from(users)
      .where(eq(users.id, senderId))
      .limit(1);
    return rows[0]?.avatar ?? undefined;
  } catch {
    return undefined;
  }
}

// ─── Core notification creator ────────────────────────────────────────────────

export interface NotificationOptions {
  /** Deep-link screen name, e.g. "chat/[id]" */
  screen?: string;
  /** Additional deep-link params merged into the FCM data payload */
  params?: Record<string, string>;
  /** Sender's avatar URL — shown as rich notification large icon */
  imageUrl?: string;
  /** FCM notification channel id — must match a channel in MainApplication.java */
  channelId?: string;
  /**
   * ID of the user who triggered this action.
   * Used for logging/audit; sender's devices are already excluded because we
   * query the RECIPIENT's tokens only.
   */
  senderId?: string;
  /** Unique message/entity ID — included in FCM data for deep-link */
  messageId?: string;
  /** Chat ID — included in FCM data for deep-link */
  chatId?: string;
  /** Group ID — included in FCM data for deep-link */
  groupId?: string;
  /**
   * Collapse key for FCM — notifications with the same key replace each other
   * in the tray (prevents flooding). Use the chatId, groupId, bidId etc.
   */
  collapseKey?: string;
  /**
   * Time-to-live in seconds. Use lower values for time-sensitive events.
   * Defaults to 28 days if omitted.
   */
  ttlSeconds?: number;
}

/**
 * Canonical notification creation flow:
 *   1. INSERT notification row (PostgreSQL)  ← commit happens here
 *   2. Emit Socket.IO event to online clients
 *   3. Send Firebase push to offline/background devices
 *
 * Push is never sent before the DB write succeeds.
 * The sender's own devices are excluded from push.
 */
export async function createNotification(
  userId: string,
  title: string,
  body: string,
  type: string,
  io?: { to: (room: string) => { emit: (event: string, data: unknown) => void } } | null,
  options?: NotificationOptions,
) {
  // ── [FCM] Message Created ─────────────────────────────────────────────────
  logger.info(
    { userId, type, title, body, channelId: options?.channelId, screen: options?.screen },
    "[FCM] Message Created",
  );

  // ── 1. Persist to PostgreSQL (must succeed before anything else) ──────────
  const id = genId("notif");
  const row = { id, userId, title, body, type, isRead: false };
  await db.insert(notifications).values(row);
  logger.info({ notificationId: id }, "[NOTIF] Notification persisted to DB");

  // ── 2. Socket.IO — real-time delivery to online clients ───────────────────
  if (io) {
    io.to(`user:${userId}`).emit("notification:new", row);
    logger.debug({ userId }, "[NOTIF] Socket.IO event emitted");
  }

  // ── 3. Firebase push — for offline / background devices ───────────────────
  // Log recipient before fetching tokens so we can trace "no tokens" situations
  logger.info(
    { recipientId: userId, senderId: options?.senderId },
    "[FCM] Recipient",
  );

  // Fetch recipient tokens, excluding sender's own devices
  const tokens = await getFcmTokensForRecipient(userId, options?.senderId);
  logger.info(
    { userId, tokenCount: tokens.length, senderId: options?.senderId },
    "[FCM] Tokens Found",
  );

  if (tokens.length === 0) {
    logger.warn(
      { userId },
      "[NOTIF] No FCM tokens found for recipient — push notification will not be sent. " +
      "Ensure the user has logged in on an Android device and the FCM token was registered.",
    );
  } else {
    // Resolve sender avatar for rich notification (if not already provided)
    const imageUrl = options?.imageUrl ?? (await getSenderAvatar(options?.senderId));

    // Build complete data payload covering all deep-link requirements
    const data: Record<string, string> = {
      notificationId: id,
      type,
      receiverId:     userId,
      ...(options?.senderId   ? { senderId:  options.senderId }   : {}),
      ...(options?.screen     ? { screen:    options.screen }     : {}),
      ...(options?.chatId     ? { chatId:    options.chatId }     : {}),
      ...(options?.messageId  ? { messageId: options.messageId }  : {}),
      ...(options?.groupId    ? { groupId:   options.groupId }    : {}),
      // Any extra params (e.g. bidId, orderId)
      ...(options?.params ?? {}),
    };

    const fcmPayload: FcmPayload = {
      title,
      body,
      channelId:  options?.channelId ?? "o2o_default",
      data,
      collapseKey: options?.collapseKey ?? options?.chatId ?? options?.groupId ?? undefined,
      ttlSeconds:  options?.ttlSeconds,
      ...(imageUrl ? { imageUrl } : {}),
    };

    logger.info(
      {
        notificationId: id,
        channelId:      fcmPayload.channelId,
        collapseKey:    fcmPayload.collapseKey,
        title:          fcmPayload.title,
        body:           fcmPayload.body,
        dataKeys:       Object.keys(data),
        screen:         data.screen,
        hasImageUrl:    !!imageUrl,
        ttlSeconds:     fcmPayload.ttlSeconds,
        tokenCount:     tokens.length,
      },
      "[FCM] Sending",
    );

    // Fire-and-forget — never block the API response
    sendFcmToMany(tokens, fcmPayload).catch((err) => {
      logger.error({ err, notificationId: id }, "[NOTIF] sendFcmToMany threw unexpectedly");
    });
  }

  return row;
}

/**
 * Send a silent data-only FCM push to one user's devices.
 * Use for: message edits, deletes, reactions, typing, read-receipts.
 * These must NOT appear as visible notifications.
 */
export async function sendSilentPush(
  recipientId: string,
  senderId: string,
  data: Record<string, string>,
): Promise<void> {
  const tokens = await getFcmTokensForRecipient(recipientId, senderId);
  if (tokens.length === 0) return;
  sendFcmDataOnly(tokens, data).catch(() => {});
}

// ─── FCM token management routes ──────────────────────────────────────────────

/**
 * POST /api/notifications/fcm-token
 *
 * Register or refresh the FCM token for the authenticated user on a specific device.
 *
 * Uniqueness strategy (prevents duplicates):
 *   • Upsert on (userId, deviceId) — updates the token when the device refreshes it.
 *   • If a different user had the same token (device re-used), remove the old row first.
 */
router.post("/fcm-token", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { token, deviceId } = req.body as { token?: string; deviceId?: string };
    if (!token || !deviceId) {
      return res.status(400).json({ error: "token and deviceId required" });
    }

    logger.info({ userId, deviceId, token: token.slice(-10) }, "[FCM] Token registration request");

    // 1. Remove any stale row that has this exact token but a different user
    //    (handles factory-reset / account-switch scenarios)
    await db
      .delete(fcmTokens)
      .where(and(eq(fcmTokens.token, token), ne(fcmTokens.userId, userId)));

    // 2. Upsert: update token for this (userId, deviceId) or insert fresh row
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
      logger.info({ userId, deviceId }, "[FCM] Token updated (existing device)");
    } else {
      await db.insert(fcmTokens).values({
        id:       genId("fcm"),
        userId,
        token,
        deviceId,
        platform: "android",
        updatedAt: new Date(),
      });
      logger.info({ userId, deviceId }, "[FCM] Token inserted (new device)");
    }

    return res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "[FCM] Token registration failed");
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /api/notifications/fcm-token
 * Remove the device token on logout so no more pushes land on this device.
 */
router.delete("/fcm-token", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { token, deviceId } = req.body as { token?: string; deviceId?: string };

    if (token) {
      await db
        .delete(fcmTokens)
        .where(and(eq(fcmTokens.userId, userId), eq(fcmTokens.token, token)));
      logger.info({ userId, token: token.slice(-10) }, "[FCM] Token removed on logout");
    } else if (deviceId) {
      await db
        .delete(fcmTokens)
        .where(and(eq(fcmTokens.userId, userId), eq(fcmTokens.deviceId, deviceId)));
      logger.info({ userId, deviceId }, "[FCM] Device tokens removed on logout");
    } else {
      // No specifics provided → remove ALL tokens for this user (full logout)
      await db.delete(fcmTokens).where(eq(fcmTokens.userId, userId));
      logger.info({ userId }, "[FCM] All tokens removed on full logout");
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Notification CRUD ────────────────────────────────────────────────────────

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
      const hasMore   = rows.length > limit;
      const page      = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;
      return res.json({ data: page, pagination: { limit, nextCursor, hasMore } });
    }

    const { page, limit, offset } = parseOffsetPagination(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });
    const countResult = await db.select({ count: count() }).from(notifications).where(eq(notifications.userId, userId));
    const total = countResult[0]?.count ?? 0;
    const rows  = await db
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
