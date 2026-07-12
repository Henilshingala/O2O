/**
 * Firebase Cloud Messaging (FCM) — Server-side push notification sender.
 *
 * Uses the Firebase Admin SDK HTTP v1 API via raw fetch to avoid bundler issues.
 * Credentials come from environment variables (never committed to repo).
 *
 * Required env vars:
 *   FIREBASE_PROJECT_ID      – project id from google-services.json
 *   FIREBASE_CLIENT_EMAIL    – service account email
 *   FIREBASE_PRIVATE_KEY     – service account private key (PEM, newlines as \n)
 */

import { logger } from "./logger.js";

// ─── Lazy-loaded google-auth-library ────────────────────────────────────────
// We use dynamic import so the build doesn't fail if the optional package is absent.
type GoogleAuthClient = {
  getAccessToken(): Promise<{ token: string | null | undefined }>;
};

let _auth: GoogleAuthClient | null = null;

async function getAuthClient(): Promise<GoogleAuthClient | null> {
  if (_auth) return _auth;
  try {
    const projectId = process.env["FIREBASE_PROJECT_ID"];
    const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"];
    const privateKey = process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      return null;
    }

    // Dynamic import — works with ESM and esbuild bundle
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    });
    _auth = await auth.getClient() as unknown as GoogleAuthClient;
    return _auth;
  } catch (err) {
    logger.warn({ err }, "[FCM] google-auth-library not available — push disabled");
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
  /** URL of a large image to show in the notification */
  imageUrl?: string;
}

// ─── Core sender ─────────────────────────────────────────────────────────────

export async function sendFcmToToken(
  token: string,
  payload: FcmPayload,
): Promise<boolean> {
  const client = await getAuthClient();
  if (!client) return false;

  const projectId = process.env["FIREBASE_PROJECT_ID"];
  if (!projectId) return false;

  try {
    const { token: accessToken } = await client.getAccessToken();
    if (!accessToken) return false;

    const message: Record<string, unknown> = {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
      },
      android: {
        priority: "high",
        notification: {
          channel_id: payload.channelId ?? "o2o_default",
          sound: "default",
          vibrate_timings_millis: ["0", "250", "250", "250"],
          notification_priority: "PRIORITY_HIGH",
          visibility: "PUBLIC",
          default_sound: true,
          default_vibrate_timings: true,
          // Large icon is set client-side via the channel
        },
      },
      data: {
        click_action: "FLUTTER_NOTIFICATION_CLICK",
        ...payload.data,
      },
    };

    const resp = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      },
    );

    if (!resp.ok) {
      const text = await resp.text();
      // If token is stale/invalid, log at info level (not error — expected)
      if (resp.status === 404 || text.includes("UNREGISTERED")) {
        logger.info({ token: token.slice(-8) }, "[FCM] Stale token — should be removed");
      } else {
        logger.warn({ status: resp.status, body: text }, "[FCM] Failed to send");
      }
      return false;
    }

    return true;
  } catch (err) {
    logger.error({ err }, "[FCM] sendFcmToToken threw");
    return false;
  }
}

/** Send to multiple tokens; returns count of successes */
export async function sendFcmToMany(
  tokens: string[],
  payload: FcmPayload,
): Promise<number> {
  if (tokens.length === 0) return 0;
  const results = await Promise.allSettled(
    tokens.map((t) => sendFcmToToken(t, payload)),
  );
  return results.filter(
    (r) => r.status === "fulfilled" && r.value === true,
  ).length;
}
