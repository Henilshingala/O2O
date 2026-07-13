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
import * as admin from "firebase-admin";

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

  logger.info("[FCM] Initialising Firebase Admin SDK...");

  try {
    // JSON.parse handles both real \n (from a proper JSON string) and the
    // literal two-char sequence \\n that some secret managers produce.
    // We normalise the private_key field explicitly as a safety net.
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.private_key === "string") {
      parsed.private_key = (parsed.private_key as string).replace(/\\n/g, "\n");
    }

    logger.info(
      { project_id: parsed.project_id, client_email: parsed.client_email },
      "[FCM] Parsed service account — project_id and client_email verified",
    );

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
    logger.info({ count: stale.length }, "[FCM] Invalid Token Removed");
  } catch (err) {
    logger.warn({ err }, "[FCM] Failed to purge stale tokens");
  }
}

// ─── Message builders ─────────────────────────────────────────────────────────

/**
 * Build the multicast message for a visible push notification.
 *
 * IMPORTANT — clickAction / click_action:
 *   Do NOT set clickAction in the Android notification block.
 *   @react-native-firebase/messaging automatically resolves the launch activity
 *   (MainActivity) without needing a click_action. Setting "FLUTTER_NOTIFICATION_CLICK"
 *   (a Flutter-only value) causes Android to fail resolving the intent, which silently
 *   prevents the notification from appearing or the tap from working in React Native apps.
 *
 * IMPORTANT — sound / vibration:
 *   Do NOT combine defaultSound/defaultVibrateTimings with explicit sound/vibrateTimingsMillis.
 *   When a custom value is provided, omit the "default" fallback flag to avoid SDK conflicts.
 */
function buildMulticastMessage(
  tokens: string[],
  payload: FcmPayload,
): MulticastMessage {
  const ttl = payload.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  const message: MulticastMessage = {
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
      ttl:         ttl * 1000,
      ...(payload.collapseKey ? { collapseKey: payload.collapseKey } : {}),
      notification: {
        channelId:            payload.channelId ?? "o2o_default",
        sound:                "default",
        // Firebase Admin SDK field: vibrateTimingsMiccllis (NOT vibrationTimingsMillis)
        // Both names exist in older docs — vibrateTimingsMillis is the correct v1 API name.
        vibrateTimingsMillis: [0, 250, 250, 250],
        // notificationPriority: HIGH makes the notification a heads-up banner
        priority: "high",
        // visibility: PUBLIC shows the notification on the lock screen
        visibility:           "public",
        // color: accent colour for the notification icon (overrides channel default)
        color:                "#3B82F6",
        // NOTE: Do NOT set clickAction here — it breaks React Native notification handling.
        //       @react-native-firebase/messaging launches MainActivity automatically.
        //       Setting "FLUTTER_NOTIFICATION_CLICK" (Flutter-only value) causes Android
        //       to fail resolving the activity intent, silently dropping notifications.
        // NOTE: Do NOT combine defaultSound/defaultVibrateTimings with explicit values —
        //       they conflict and produce undefined SDK behaviour.
        ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
      },
    },

    // ── Data payload for deep-linking (always present) ────────────────────────
    // NOTE: Do NOT include click_action here — it's a Flutter concept and is ignored
    //       (or causes harm) in React Native Firebase apps.
    data: {
      ...(payload.data ?? {}),
    },
  };

  return message;
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
      ttl:      60000, // data-only messages are short-lived (typing, read receipts)
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
  const channelId = (message.android?.notification as any)?.channelId ?? "none";
  const title     = message.notification?.title ?? "";

  logger.info(
    {
      payload: message,
      tokenCount: batchTokens.length,
      notificationType: message.notification ? "visible" : "data-only",
      channelId,
      collapseKey: message.android?.collapseKey,
      ttl: message.android?.ttl,
    },
    "[FCM] Sending",
  );

  let response: Awaited<ReturnType<typeof admin.messaging.prototype.sendEachForMulticast>>;
  try {
    response = await admin.messaging(app).sendEachForMulticast(message);
  } catch (err: any) {
    // Top-level failure (e.g. auth error, network) — log with full payload context
    logger.error(
      {
        err,
        code:        err?.errorInfo?.code ?? err?.code ?? err?.name ?? "unknown",
        errMessage:  err?.message,
        stack:       err?.stack,
        validationErrors: err?.errorInfo ?? err?.details ?? "none",
        invalidFields: message,
        channelId,
        title,
        tokenCount:  batchTokens.length,
        // Print last 8 chars of each token for correlation without leaking full tokens
        tokens:      batchTokens.map((t) => t.slice(-8)),
      },
      "[FCM] Firebase Error — sendEachForMulticast threw",
    );
    throw err;
  }

  const stale: string[] = [];

  response.responses.forEach((r: any, i: number) => {
    const tokenSuffix = batchTokens[i]?.slice(-8) ?? "?";
    if (r.success) {
      logger.info(
        { token: tokenSuffix, messageId: r.messageId },
        "[FCM] Firebase Success",
      );
      logger.info(
        { token: tokenSuffix, messageId: r.messageId },
        "[FCM] Message ID",
      );
      return;
    }

    // Delivery failure for this specific token
    const code: string = r.error?.errorInfo?.code ?? (r.error as any)?.code ?? "unknown";
    const errMsg = r.error?.message ?? "unknown";

    logger.error(
      {
        code,
        token:      tokenSuffix,
        errMessage: errMsg,
        stack:      r.error?.stack,
        validationErrors: r.error?.errorInfo ?? r.error ?? "none",
        invalidFields: message,
        // Full payload context so the caller can reproduce the failing request
        channelId,
        title,
        payloadDataKeys: Object.keys(message.data ?? {}),
      },
      "[FCM] Firebase Error",
    );

    if (isStaleCode(code)) {
      stale.push(batchTokens[i]!);
      logger.info(
        { token: tokenSuffix, code },
        "[FCM] Invalid Token Removed — flagged for DB purge",
      );
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
  logger.info(
    {
      tokenCount:   tokens.length,
      title:        payload.title,
      body:         payload.body,
      channelId:    payload.channelId,
      collapseKey:  payload.collapseKey,
      hasImageUrl:  !!payload.imageUrl,
      dataKeys:     payload.data ? Object.keys(payload.data) : [],
      data:         payload.data,
    },
    "[FCM] Payload",
  );

  if (tokens.length === 0) {
    logger.warn("[FCM] Tokens Found: 0 — no push sent");
    return 0;
  }

  const app = getAdminApp();
  if (!app) {
    logger.warn("[FCM] Firebase Admin not initialised — push skipped");
    return 0;
  }

  const unique = [...new Set(tokens.filter(Boolean))]; // de-dup + remove empty
  if (unique.length === 0) {
    logger.warn("[FCM] All tokens were empty/duplicate after dedup — no push sent");
    return 0;
  }

  logger.info({ uniqueTokenCount: unique.length }, "[FCM] Tokens Found");

  let total = 0;
  for (let i = 0; i < unique.length; i += FCM_MAX_BATCH) {
    const chunk   = unique.slice(i, i + FCM_MAX_BATCH);
    const message = buildMulticastMessage(chunk, payload);
    logger.info({ batchIndex: Math.floor(i / FCM_MAX_BATCH), batchSize: chunk.length }, "[FCM] Sending batch");
    try {
      total += await sendBatch(admin, app, message, chunk);
    } catch (err) {
      logger.error({ err }, "[FCM] sendFcmToMany batch threw");
      throw err;
    }
  }

  logger.info({ total, tokenCount: unique.length }, "[FCM] sendFcmToMany complete");
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
  logger.info(
    { tokenCount: tokens.length, dataKeys: Object.keys(data), collapseKey },
    "[FCM] sendFcmDataOnly called",
  );

  if (tokens.length === 0) return 0;

  const app = getAdminApp();
  if (!app) {
    logger.warn("[FCM] Firebase Admin not initialised — silent push skipped");
    return 0;
  }

  const unique = [...new Set(tokens.filter(Boolean))];
  if (unique.length === 0) return 0;

  let total = 0;
  for (let i = 0; i < unique.length; i += FCM_MAX_BATCH) {
    const chunk   = unique.slice(i, i + FCM_MAX_BATCH);
    const message = buildDataOnlyMulticastMessage(chunk, data, collapseKey);
    try {
      total += await sendBatch(admin, app, message, chunk);
    } catch (err) {
      logger.error({ err }, "[FCM] sendFcmDataOnly batch threw");
      throw err;
    }
  }

  return total;
}
