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
// firebase-admin v13+ modular API — do NOT use `import * as admin` because
// admin.apps / admin.initializeApp / admin.credential / admin.messaging are
// undefined in the ESM bundle (they live on the compat namespace, not the
// default export). Use the sub-package entry points instead.
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging }                  from "firebase-admin/messaging";

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

import type { App }              from "firebase-admin/app";
import type { MulticastMessage } from "firebase-admin/messaging";

const FCM_MAX_BATCH       = 500;     // Firebase hard limit per sendEachForMulticast call
const DEFAULT_TTL_SECONDS = 2419200; // 28 days

let _app: App | null = null;
let _initAttempted   = false; // guarantees exactly-once init even under concurrent calls
let _initFailReason  = "not attempted yet"; // human-readable reason for the last failure

function parseFirebaseServiceAccount(raw: string): Record<string, unknown> {
  let rawStr = raw.trim();

  // Strip wrapping single or double quotes if present
  if ((rawStr.startsWith('"') && rawStr.endsWith('"')) || (rawStr.startsWith("'") && rawStr.endsWith("'"))) {
    rawStr = rawStr.slice(1, -1).trim();
  }

  // If base64 encoded (doesn't start with '{'), decode base64 first
  if (!rawStr.startsWith("{") && !rawStr.startsWith("[")) {
    try {
      const cleaned = rawStr.replace(/[\r\n\s]+/g, "");
      const decoded = Buffer.from(cleaned, "base64").toString("utf-8").trim();
      if (decoded.startsWith("{")) {
        rawStr = decoded;
      }
    } catch {}
  }

  // 1. Direct JSON parse attempt
  try {
    return JSON.parse(rawStr) as Record<string, unknown>;
  } catch (err1) {
    // 2. Normalize raw unescaped newlines into escaped \n inside strings
    try {
      const fixedNewlines = rawStr.replace(/\r?\n/g, "\\n");
      return JSON.parse(fixedNewlines) as Record<string, unknown>;
    } catch (err2) {
      // 3. Normalize double-escaped characters
      try {
        const sanitized = rawStr
          .replace(/\\\\n/g, "\\n")
          .replace(/\\\\"/g, '"');
        return JSON.parse(sanitized) as Record<string, unknown>;
      } catch (err3) {
        throw err1;
      }
    }
  }
}

function getAdminApp(): App | null {
  // Fast path — already attempted (success or failure)
  if (_initAttempted) {
    if (!_app) {
      logger.warn(
        { reason: _initFailReason },
        "[FCM] Firebase Admin not initialised — push skipped (init failed at startup)",
      );
    }
    return _app;
  }
  _initAttempted = true;

  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!raw) {
    _initFailReason = "FIREBASE_SERVICE_ACCOUNT env var is not set";
    logger.warn("[FCM] FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled");
    return null;
  }

  logger.info("[FCM] Initialising Firebase Admin SDK...");

  try {
    let parsed: Record<string, unknown>;
    try {
      parsed = parseFirebaseServiceAccount(raw);
    } catch (parseErr: unknown) {
      const e = parseErr as Error;
      _initFailReason = `JSON.parse failed: ${e.message}`;
      logger.error(
        { errMessage: e.message, rawLength: raw.length, rawPrefix: raw.slice(0, 30) },
        "[FCM] Firebase Admin SDK FAILED TO INITIALIZE — FIREBASE_SERVICE_ACCOUNT is not valid JSON. Parse error: " + e.message,
      );
      return null;
    }

    if (typeof parsed.private_key === "string") {
      parsed.private_key = (parsed.private_key as string).replace(/\\n/g, "\n");
    }

    // Validate required fields before calling initializeApp
    const requiredFields = ["type", "project_id", "private_key_id", "private_key", "client_email"];
    const missingFields  = requiredFields.filter((f) => !parsed[f]);
    if (missingFields.length > 0) {
      _initFailReason = `Service account JSON missing required fields: ${missingFields.join(", ")}`;
      logger.error(
        { missingFields, presentFields: Object.keys(parsed) },
        "[FCM] Firebase Admin SDK FAILED TO INITIALIZE — service account JSON missing required fields: " + missingFields.join(", "),
      );
      return null;
    }

    logger.info(
      {
        project_id:   parsed.project_id,
        client_email: parsed.client_email,
        type:         parsed.type,
      },
      "[FCM] Parsed service account — project_id and client_email verified",
    );

    // Guard against double-init (hot-reload in dev, or module cache edge cases)
    const existing = getApps().find((a) => a?.name === "[DEFAULT]");
    if (existing) {
      _app = existing;
      logger.info("[FCM] Admin initialized (reusing existing app instance)");
      return _app;
    }

    _app = initializeApp({
      credential: cert(parsed as Parameters<typeof cert>[0]),
    });

    logger.info(
      { appsLength: getApps().length },
      "[FCM] Admin initialized",
    );
    return _app;
  } catch (err: unknown) {
    const e = err as Error & { errorInfo?: unknown; code?: string };
    _initFailReason = `admin.initializeApp() threw: ${e.message ?? String(err)}`;
    logger.error(
      {
        code:       e.code,
        message:    e.message,
      },
      "[FCM] Firebase Admin SDK FAILED TO INITIALIZE — admin.initializeApp() threw an exception: " + e.message,
    );
    return null;
  }
}

/**
 * Pre-warm Firebase Admin SDK at server startup.
 *
 * Call this once during app initialization (before serving requests) so that
 * any configuration error surfaces immediately in the startup logs rather than
 * silently on the first push attempt.
 *
 * Safe to call multiple times — the underlying singleton is initialized exactly once.
 */
export function initFirebaseAdmin(): void {
  logger.info("[FCM] === Firebase Admin SDK initialization ===");

  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  logger.info(
    {
      exists:      !!raw,
      length:      raw?.length ?? 0,
      prefix:      raw ? raw.slice(0, 20) : "(not set)",
      nodeEnv:     process.env["NODE_ENV"],
    },
    `[FCM] FIREBASE_SERVICE_ACCOUNT exists: ${!!raw}`,
  );

  if (!raw) {
    logger.error(
      "[FCM] FIREBASE_SERVICE_ACCOUNT is NOT set. " +
      "Go to Render Dashboard → o2o-api → Environment → Add Environment Variable. " +
      "Key: FIREBASE_SERVICE_ACCOUNT  Value: (paste entire service-account JSON)",
    );
    return;
  }

  const app = getAdminApp();

  if (app) {
    logger.info(
      { appsLength: getApps().length },
      "[FCM] Admin initialized",
    );
  } else {
    logger.error(
      { reason: _initFailReason, appsLength: getApps().length },
      "[FCM] Firebase Admin SDK FAILED TO INITIALIZE — " + _initFailReason,
    );
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
  app: App,
  message: MulticastMessage,
  batchTokens: string[],
): Promise<number> {
  const channelId = (message.android?.notification as any)?.channelId ?? "none";
  const title     = message.notification?.title ?? "";

  logger.info(
    {
      tokenCount: batchTokens.length,
      notificationType: message.notification ? "visible" : "data-only",
      channelId,
      collapseKey: message.android?.collapseKey,
      ttl: message.android?.ttl,
    },
    "[FCM] Notification send started",
  );

  let response: Awaited<ReturnType<ReturnType<typeof getMessaging>["sendEachForMulticast"]>>;
  try {
    response = await getMessaging(app).sendEachForMulticast(message);
  } catch (err: any) {
    const safeError = err?.message || String(err);
    logger.error(
      {
        safeError,
        code: err?.errorInfo?.code ?? err?.code ?? err?.name ?? "unknown",
        tokenCount: batchTokens.length,
      },
      "[FCM] Notification send failed",
    );
    throw err;
  }

  const stale: string[] = [];

  response.responses.forEach((r: any, i: number) => {
    const tokenSuffix = batchTokens[i]?.slice(-8) ?? "?";
    if (r.success) {
      logger.info(
        { tokenSuffix, messageId: r.messageId },
        "[FCM] Notification send successful",
      );
      return;
    }

    // Delivery failure for this specific token
    const code: string = r.error?.errorInfo?.code ?? (r.error as any)?.code ?? "unknown";
    const errMsg = r.error?.message ?? "unknown";

    logger.error(
      {
        code,
        tokenSuffix,
        safeError: errMsg,
      },
      "[FCM] Notification send failed",
    );

    if (isStaleCode(code)) {
      stale.push(batchTokens[i]!);
      logger.info(
        { tokenSuffix, code },
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
      total += await sendBatch(app, message, chunk);
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
      total += await sendBatch(app, message, chunk);
    } catch (err) {
      logger.error({ err }, "[FCM] sendFcmDataOnly batch threw");
      throw err;
    }
  }

  return total;
}
