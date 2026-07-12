/**
 * Firebase Cloud Messaging (FCM) — Server-side push notification sender.
 *
 * Uses the official Firebase Admin SDK (firebase-admin v13+).
 * Initialised once from a single environment variable containing the
 * complete service-account JSON blob.
 *
 * Required env var:
 *   FIREBASE_SERVICE_ACCOUNT – full service account JSON string
 *                              (copy the entire downloaded .json file content)
 *
 * Optional (graceful degradation):
 *   If the env var is absent or invalid, FCM is silently disabled and
 *   Socket.IO real-time updates continue to work normally.
 *
 * Public API (unchanged for all callers):
 *   sendFcmToMany(tokens, payload)          – visible notification to multiple devices
 *   sendFcmDataOnly(tokens, data)           – silent data-only message (no notification tray)
 *   FcmPayload                              – payload type
 */

import { db } from "@workspace/db";
import { fcmTokens } from "@workspace/db/schema";
import { inArray } from "drizzle-orm";
import { logger } from "./logger.js";

// ─── Firebase Admin singleton ─────────────────────────────────────────────────

import type { App } from "firebase-admin/app";
import type { MulticastMessage } from "firebase-admin/messaging";

const FCM_MAX_BATCH = 500; // Firebase hard limit per sendEachForMulticast call

let _app: App | null = null;
let _initAttempted = false;

function getAdminApp(): App | null {
  if (_initAttempted) return _app;
  _initAttempted = true;

  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!raw) {
    logger.warn("[FCM] FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled");
    return null;
  }

  try {
    const serviceAccount = JSON.parse(raw);
    // firebase-admin ships CommonJS; require() is the reliable cross-boundary call
    const admin = require("firebase-admin") as typeof import("firebase-admin");

    // Guard against double-init on hot-reload in dev
    const existing = admin.apps.find((a) => a?.name === "[DEFAULT]");
    if (existing) {
      _app = existing;
      logger.info("[FCM] Reusing existing Firebase Admin app");
      return _app;
    }

    _app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    logger.info("[FCM] Firebase Admin SDK initialised successfully");
    return _app;
  } catch (err) {
    logger.error({ err }, "[FCM] Failed to initialise Firebase Admin SDK — check FIREBASE_SERVICE_ACCOUNT");
    return null;
  }
}

// ─── Stale-token cleanup ──────────────────────────────────────────────────────

/** Error codes Firebase returns for dead/unregistered tokens */
const STALE_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",         // sometimes returned for bad tokens
]);

function isStaleCode(code: string): boolean {
  return STALE_CODES.has(code) || code.includes("UNREGISTERED");
}

/**
 * Remove permanently-invalid FCM tokens from the database.
 * Called after sendEachForMulticast when Firebase flags individual failures.
 */
async function purgeStaleTokens(stale: string[]): Promise<void> {
  if (stale.length === 0) return;
  try {
    await db.delete(fcmTokens).where(inArray(fcmTokens.token, stale));
    logger.info({ count: stale.length }, "[FCM] Purged stale tokens from DB");
  } catch (err) {
    logger.warn({ err }, "[FCM] Failed to purge stale tokens");
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FcmPayload {
  title: string;
  body: string;
  /** Android notification channel id — must match a channel created in MainApplication.java */
  channelId?: string;
  /**
   * Deep-link + context data forwarded as string key/value pairs.
   * Include: type, screen, notificationId, senderId, receiverId,
   *          chatId, messageId, groupId, etc.
   */
  data?: Record<string, string>;
  /** Large image URL for rich notifications (sender avatar, product image) */
  imageUrl?: string;
}

// ─── Message builders ─────────────────────────────────────────────────────────

function buildMulticastMessage(
  tokens: string[],
  payload: FcmPayload,
): MulticastMessage {
  return {
    tokens,
    // Visible notification shown in the tray
    notification: {
      title: payload.title,
      body:  payload.body,
      ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    },
    // Android-specific config
    android: {
      priority: "high",
      notification: {
        channelId:            payload.channelId ?? "o2o_default",
        sound:                "default",
        vibrateTimingsMillis: [0, 250, 250, 250],
        priority:             "high",
        visibility:           "public",
        defaultSound:         true,
        defaultVibrateTimings: true,
        clickAction:          "FLUTTER_NOTIFICATION_CLICK",
        // Sender avatar is passed via imageUrl → shown as large icon on Android 12+
      },
    },
    // Data payload always accompanies the notification for deep linking
    data: {
      click_action: "FLUTTER_NOTIFICATION_CLICK",
      // Safe stringification — Firebase data values must be strings
      ...(payload.data ?? {}),
    },
  };
}

function buildDataOnlyMulticastMessage(
  tokens: string[],
  data: Record<string, string>,
): MulticastMessage {
  return {
    tokens,
    // No `notification` block → silent; will not appear in tray
    android: {
      priority: "high",
    },
    data,
  };
}

// ─── Core send helper ─────────────────────────────────────────────────────────

/**
 * Send one batch (≤500 tokens) and collect/purge stale tokens.
 * Returns number of successes in this batch.
 */
async function sendBatch(
  admin: typeof import("firebase-admin"),
  app: App,
  message: MulticastMessage,
  batchTokens: string[],
): Promise<number> {
  const response = await admin.messaging(app).sendEachForMulticast(message);

  const stale: string[] = [];
  response.responses.forEach((r, i) => {
    if (r.success) return;
    const code: string = r.error?.errorInfo?.code ?? r.error?.code ?? "unknown";
    if (isStaleCode(code)) {
      stale.push(batchTokens[i]!);
      logger.info({ token: batchTokens[i]?.slice(-8) }, "[FCM] Stale token flagged");
    } else {
      logger.warn(
        { code, token: batchTokens[i]?.slice(-8) },
        "[FCM] Delivery failure",
      );
    }
  });

  // Purge stale tokens from DB asynchronously (don't block the response)
  if (stale.length > 0) {
    purgeStaleTokens(stale).catch(() => {});
  }

  logger.info(
    { success: response.successCount, failure: response.failureCount },
    "[FCM] Batch completed",
  );

  return response.successCount;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a visible push notification to one or more devices.
 *
 * Rules enforced here:
 *  - Tokens are de-duplicated before sending.
 *  - Batches are capped at FCM_MAX_BATCH (500) tokens.
 *  - Invalid/unregistered tokens are removed from the DB automatically.
 *
 * Returns the total count of successful deliveries.
 */
export async function sendFcmToMany(
  tokens: string[],
  payload: FcmPayload,
): Promise<number> {
  if (tokens.length === 0) return 0;

  const app = getAdminApp();
  if (!app) return 0;

  // De-duplicate tokens (a device may appear more than once if re-registered)
  const unique = [...new Set(tokens)];
  const admin  = require("firebase-admin") as typeof import("firebase-admin");

  let total = 0;
  // Split into ≤500-token chunks
  for (let i = 0; i < unique.length; i += FCM_MAX_BATCH) {
    const chunk   = unique.slice(i, i + FCM_MAX_BATCH);
    const message = buildMulticastMessage(chunk, payload);
    try {
      total += await sendBatch(admin, app, message, chunk);
    } catch (err) {
      logger.error({ err }, "[FCM] sendFcmToMany batch threw");
    }
  }

  return total;
}

/**
 * Send a data-only (silent) FCM message — no tray notification.
 * Use for: message edits, deletes, reactions, typing indicators, read receipts.
 *
 * Returns the total count of successful deliveries.
 */
export async function sendFcmDataOnly(
  tokens: string[],
  data: Record<string, string>,
): Promise<number> {
  if (tokens.length === 0) return 0;

  const app = getAdminApp();
  if (!app) return 0;

  const unique = [...new Set(tokens)];
  const admin  = require("firebase-admin") as typeof import("firebase-admin");

  let total = 0;
  for (let i = 0; i < unique.length; i += FCM_MAX_BATCH) {
    const chunk   = unique.slice(i, i + FCM_MAX_BATCH);
    const message = buildDataOnlyMulticastMessage(chunk, data);
    try {
      total += await sendBatch(admin, app, message, chunk);
    } catch (err) {
      logger.error({ err }, "[FCM] sendFcmDataOnly batch threw");
    }
  }

  return total;
}
