/**
 * Firebase Cloud Messaging (FCM) — Server-side push notification sender.
 *
 * Uses the official Firebase Admin SDK (firebase-admin).
 * The app is initialised once (lazy singleton) from environment variables.
 *
 * Required env vars:
 *   FIREBASE_PROJECT_ID      – project id  (from google-services.json)
 *   FIREBASE_CLIENT_EMAIL    – service account client_email
 *   FIREBASE_PRIVATE_KEY     – service account private_key (PEM; use \n for newlines in Render)
 *
 * The public API (FcmPayload, sendFcmToToken, sendFcmToMany) is unchanged so
 * all callers in notifications.ts continue to work without modification.
 */

import { logger } from "./logger.js";

// ─── Lazy Admin SDK initialisation ───────────────────────────────────────────

import type { App } from "firebase-admin/app";
import type { Message, MulticastMessage } from "firebase-admin/messaging";

let _app: App | null = null;

function getAdminApp(): App | null {
  if (_app) return _app;

  const projectId   = process.env["FIREBASE_PROJECT_ID"];
  const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"];
  const privateKey  = process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    logger.warn("[FCM] Missing FIREBASE_* env vars — push notifications disabled");
    return null;
  }

  try {
    // Dynamic import keeps the ESM/CJS boundary clean with esbuild
    // (firebase-admin ships CJS; we call it synchronously after the first await)
    const admin = require("firebase-admin") as typeof import("firebase-admin");

    // Avoid "already exists" error on hot-reload in dev
    const existing = admin.apps.find((a) => a?.name === "[DEFAULT]");
    if (existing) {
      _app = existing;
      return _app;
    }

    _app = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });

    logger.info("[FCM] Firebase Admin SDK initialised");
    return _app;
  } catch (err) {
    logger.error({ err }, "[FCM] Failed to initialise Firebase Admin SDK");
    return null;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FcmPayload {
  title: string;
  body: string;
  /** Android notification channel id (must match the channel created in the app) */
  channelId?: string;
  /** Deep-link data — forwarded to the app as key/value string pairs */
  data?: Record<string, string>;
  /** URL of a large image shown in the notification drawer */
  imageUrl?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildMessage(token: string, payload: FcmPayload): Message {
  return {
    token,
    notification: {
      title: payload.title,
      body:  payload.body,
      ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    },
    android: {
      priority: "high",
      notification: {
        channelId:           payload.channelId ?? "o2o_default",
        sound:               "default",
        vibrateTimingsMillis: [0, 250, 250, 250],
        priority:            "high",
        visibility:          "public",
        defaultSound:        true,
        defaultVibrateTimings: true,
        clickAction:         "FLUTTER_NOTIFICATION_CLICK",
      },
    },
    data: {
      click_action: "FLUTTER_NOTIFICATION_CLICK",
      ...payload.data,
    },
  };
}

function buildMulticastMessage(tokens: string[], payload: FcmPayload): MulticastMessage {
  return {
    tokens,
    notification: {
      title: payload.title,
      body:  payload.body,
      ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    },
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
      },
    },
    data: {
      click_action: "FLUTTER_NOTIFICATION_CLICK",
      ...payload.data,
    },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a push notification to a single FCM token.
 * Returns true on success, false on any failure (stale token, network, etc.).
 */
export async function sendFcmToToken(
  token: string,
  payload: FcmPayload,
): Promise<boolean> {
  const app = getAdminApp();
  if (!app) return false;

  try {
    const admin = require("firebase-admin") as typeof import("firebase-admin");
    const message = buildMessage(token, payload);
    await admin.messaging(app).send(message);
    return true;
  } catch (err: any) {
    // UNREGISTERED / NOT_FOUND = stale token; log at info, not error
    const code: string = err?.errorInfo?.code ?? err?.code ?? "";
    if (
      code.includes("UNREGISTERED") ||
      code.includes("registration-token-not-registered") ||
      code.includes("NOT_FOUND")
    ) {
      logger.info({ token: token.slice(-8) }, "[FCM] Stale token");
    } else {
      logger.warn({ code, msg: err?.message }, "[FCM] sendFcmToToken failed");
    }
    return false;
  }
}

/**
 * Send a push notification to multiple FCM tokens in a single batch call.
 * Uses sendEachForMulticast() which processes up to 500 tokens per call.
 * Returns the count of successfully delivered messages.
 */
export async function sendFcmToMany(
  tokens: string[],
  payload: FcmPayload,
): Promise<number> {
  if (tokens.length === 0) return 0;

  const app = getAdminApp();
  if (!app) return 0;

  try {
    const admin    = require("firebase-admin") as typeof import("firebase-admin");
    const message  = buildMulticastMessage(tokens, payload);
    const response = await admin.messaging(app).sendEachForMulticast(message);

    // Log individual failures (stale tokens etc.) without throwing
    response.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.errorInfo?.code ?? r.error?.code ?? "unknown";
        if (
          code.includes("UNREGISTERED") ||
          code.includes("registration-token-not-registered") ||
          code.includes("NOT_FOUND")
        ) {
          logger.info({ token: tokens[i]?.slice(-8) }, "[FCM] Stale token in batch");
        } else {
          logger.warn({ code, token: tokens[i]?.slice(-8) }, "[FCM] Batch send failure");
        }
      }
    });

    logger.info(
      { success: response.successCount, failure: response.failureCount },
      "[FCM] sendEachForMulticast completed",
    );

    return response.successCount;
  } catch (err) {
    logger.error({ err }, "[FCM] sendFcmToMany threw");
    return 0;
  }
}
