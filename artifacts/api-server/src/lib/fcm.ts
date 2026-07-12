/**
 * Firebase Cloud Messaging (FCM) — Server-side push notification sender.
 *
 * Uses the official Firebase Admin SDK (firebase-admin v13+).
 * Initialised exactly ONCE from a single environment variable.
 *
 * Required env var:
 *   FIREBASE_SERVICE_ACCOUNT – the complete service-account JSON as a string.
 *                              Paste the entire contents of the downloaded .json file.
 *
 * Graceful degradation:
 *   If the env var is absent or the JSON is malformed, FCM is silently disabled.
 *   Socket.IO real-time delivery continues to work normally.
 *
 * Public API:
 *   sendFcmToMany(tokens, payload)   – visible notification push
 *   sendFcmDataOnly(tokens, data)    – silent data-only push (no tray entry)
 *   FcmPayload                       – payload type
 */

import { db } from "@workspace/db";
import { fcmTokens } from "@workspace/db/schema";
import { inArray } from "drizzle-orm";
import { logger } from "./logger.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FcmPayload {
  title: string;
  body: string;
  /** Android notification channel id — must match a channel in MainApplication.java */
  channelId?: string;
  /**
   * Deep-link + context data forwarded as string key/value pairs.
   * Must include: type, screen, notificationId, senderId, receiverId.
   * May include: chatId, messageId, groupId, bidId, orderId.
   */
  data?: Record<string, string>;
  /** Large image URL shown as notification large-icon (sender avatar, product image) */
  imageUrl?: string;
  /**
   * Collapse key: notifications with the same key replace each other in the tray.
   * Use the chatId, groupId, bidId etc. to prevent tray flooding.
   */
  collapseKey?: string;
  /**
   * Time-to-live in seconds (default: 4 weeks / 2419200 s).
   * Set lower for time-sensitive events like bid expiry.
   */
  ttlSeconds?: number;
}

// ─── Firebase Admin singleton ─────────────────────────────────────────────────

import type { App } from "firebase-admin/app";
import type { MulticastMessage } from "firebase-admin/messaging";

const FCM_MAX_BATCH       = 500;     // Firebase hard limit per sendEachForMulticast call
const DEFAULT_TTL_SECONDS = 2419200; // 28 days

let _app: App | null = null;
let _initAttempted   = false; // guarantees exactly-once init even under concurrent calls

function getAdminApp(): App | null {
  // Fast path — already attempted (success or failure)
  if (_initAttempted) return _app;
  _initAttempted = true;

  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!raw) {
    logger.warn("[FCM] FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled");
    return null;
  }

  try {
    // JSON.parse handles both real \n (from a proper JSON string) and the
    // literal two-char sequence \\n that some secret managers produce.
    // We normalise the private_key field explicitly as a safety net.
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.private_key === "string") {
      parsed.private_key = (parsed.private_key as string).replace(/\\n/g, "\n");
    }

    const admin = require("firebase-admin") as typeof import("firebase-admin");

    // Guard against double-init (hot-reload in dev, or module cache edge cases)
    const existing = admin.apps.find((a) => a?.name === "[DEFAULT]");
    if (existing) {
      _app = existing;
      logger.info("[FCM] Reusing existing Firebase Admin app");
      return _app;
    }

    _app = admin.initializeApp({
      credential: admin.credential.cert(parsed as Parameters<typeof admin.credential.cert>[0]),
    });

    logger.info("[FCM] Firebase Admin SDK initialised successfully");
    return _app;
  } catch (err) {
    logger.error({ err }, "[FCM] Failed to initialise — check FIREBASE_SERVICE_ACCOUNT JSON format");
    return null;
  }
}

// ─── Stale-token detection and cleanup ───────────────────────────────────────

/**
 * Error codes that definitively mean the token is dead and must be removed.
 * We deliberately exclude "messaging/invalid-argument" because it can also
 * indicate a malformed request (not a stale token) and would incorrectly
 * purge valid tokens.
 */
const STALE_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

function isStaleCode(code: string): boolean {
  return (
    STALE_CODES.has(code) ||
    code === "messaging/UNREGISTERED" ||
    code.toUpperCase().includes("UNREGISTERED")
  );
}

/** Remove permanently-invalid tokens from the DB (fire-and-forget). */
async function purgeStaleTokens(stale: string[]): Promise<void> {
  if (stale.length === 0) return;
  try {
    await db.delete(fcmTokens).where(inArray(fcmTokens.token, stale));
    logger.info({ count: stale.length }, "[FCM] Purged stale tokens from DB");
  } catch (err) {
    logger.warn({ err }, "[FCM] Failed to purge stale tokens");
  }
}

// ─── Message builders ─────────────────────────────────────────────────────────

function buildMulticastMessage(
  tokens: string[],
  payload: FcmPayload,
): MulticastMessage {
  const ttl = payload.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  return {
    tokens,

    // ── Visible notification shown in the system tray ─────────────────────────
    notification: {
      title: payload.title,
      body:  payload.body,
      ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    },

    // ── Android-specific overrides ────────────────────────────────────────────
    android: {
      priority:    "high",
      ttl:         `${ttl}s`,
      ...(payload.collapseKey ? { collapseKey: payload.collapseKey } : {}),
      notification: {
        channelId:            payload.channelId ?? "o2o_default",
        sound:                "default",
        vibrateTimingsMillis: [0, 250, 250, 250],
        priority:             "high",
        visibility:           "public",
        defaultSound:         true,
        defaultVibrateTimings: true,
        clickAction:          "FLUTTER_NOTIFICATION_CLICK",
        // imageUrl → large icon on Android 12+
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
      },
    },

    // ── Data payload for deep-linking (always present) ────────────────────────
    data: {
      click_action: "FLUTTER_NOTIFICATION_CLICK",
      ...(payload.data ?? {}),
    },
  };
}

function buildDataOnlyMulticastMessage(
  tokens: string[],
  data: Record<string, string>,
  collapseKey?: string,
): MulticastMessage {
  return {
    tokens,
    // No `notification` block → silent; never appears in notification tray
    android: {
      priority: "high",
      ttl:      "60s", // data-only messages are short-lived (typing, read receipts)
      ...(collapseKey ? { collapseKey } : {}),
    },
    data,
  };
}

// ─── Core batch sender ────────────────────────────────────────────────────────

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
    const code: string = r.error?.errorInfo?.code ?? (r.error as any)?.code ?? "unknown";
    if (isStaleCode(code)) {
      stale.push(batchTokens[i]!);
      logger.info({ token: batchTokens[i]?.slice(-8) }, "[FCM] Stale token flagged for removal");
    } else {
      logger.warn({ code, token: batchTokens[i]?.slice(-8) }, "[FCM] Delivery failure (non-stale)");
    }
  });

  if (stale.length > 0) {
    purgeStaleTokens(stale).catch(() => {});
  }

  logger.info(
    { sent: batchTokens.length, success: response.successCount, failure: response.failureCount },
    "[FCM] Batch completed",
  );

  return response.successCount;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a visible push notification to one or more devices.
 *
 * Guarantees:
 *   • Tokens are de-duplicated before sending.
 *   • Batches are capped at 500 (Firebase hard limit).
 *   • Stale/invalid tokens are removed from the DB automatically.
 *   • collapseKey prevents tray flooding per-conversation.
 *   • ttl ensures old notifications are not delivered stale.
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

  const unique = [...new Set(tokens.filter(Boolean))]; // de-dup + remove empty
  if (unique.length === 0) return 0;

  const admin = require("firebase-admin") as typeof import("firebase-admin");

  let total = 0;
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
 * Send a silent data-only push — no system tray entry.
 * Use for: message edits, deletes, reactions, typing indicators, read receipts.
 *
 * Returns the total count of successful deliveries.
 */
export async function sendFcmDataOnly(
  tokens: string[],
  data: Record<string, string>,
  collapseKey?: string,
): Promise<number> {
  if (tokens.length === 0) return 0;

  const app = getAdminApp();
  if (!app) return 0;

  const unique = [...new Set(tokens.filter(Boolean))];
  if (unique.length === 0) return 0;

  const admin = require("firebase-admin") as typeof import("firebase-admin");

  let total = 0;
  for (let i = 0; i < unique.length; i += FCM_MAX_BATCH) {
    const chunk   = unique.slice(i, i + FCM_MAX_BATCH);
    const message = buildDataOnlyMulticastMessage(chunk, data, collapseKey);
    try {
      total += await sendBatch(admin, app, message, chunk);
    } catch (err) {
      logger.error({ err }, "[FCM] sendFcmDataOnly batch threw");
    }
  }

  return total;
}
