/**
 * useFCM — Firebase Cloud Messaging lifecycle hook (Android-only).
 *
 * Responsibilities:
 *  1. Request POST_NOTIFICATIONS permission once (persisted in AsyncStorage).
 *  2. Retrieve the FCM device token and register it with the backend (upsert).
 *  3. Listen for token refreshes and re-register automatically.
 *  4. Foreground messages:
 *     - Data-only (silent) messages → dispatch to onSilentMessage callback.
 *     - Visible messages → show the in-app banner via onForegroundMessage.
 *       NOTE: FCM does NOT auto-display system notifications when the app is
 *       in the foreground — the in-app banner IS the foreground notification.
 *  5. Background/quit notification taps → navigate to the correct screen.
 *  6. On logout → unregister the token from the backend immediately.
 *
 * All listeners are unsubscribed when the component unmounts → no memory leaks.
 *
 * Background (quit-state) handler is registered in index.js via:
 *   messaging().setBackgroundMessageHandler(...)
 *
 * IMPORTANT — single initialization:
 *   Callbacks (onForegroundMessage, onSilentMessage, navigate) are stored in
 *   refs so that the main effect only runs when `enabled` changes (i.e. on
 *   login / logout). Inline arrow functions passed by the parent will NOT
 *   retrigger the effect — which was the root cause of the repeated
 *   "Initialising FCM listeners / Cleaning up FCM listeners" loop.
 *
 * Usage:
 *   const { unregisterToken } = useFCM({ onForegroundMessage, onSilentMessage, navigate });
 */

import { useEffect, useCallback, useRef } from "react";
import { Platform, PermissionsAndroid } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getMessaging,
  getToken,
  onTokenRefresh,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification
} from "@react-native-firebase/messaging";
import type { FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import { customFetch } from "@workspace/api-client-react";

const DEVICE_ID_KEY          = "@o2o_device_id";
const FCM_TOKEN_KEY          = "@o2o_fcm_token";
const NOTIF_PERMISSION_ASKED = "@o2o_notif_permission_asked"; // persisted to ask only once

// ─── Device ID ───────────────────────────────────────────────────────────────

/** Stable, persistent pseudo-device-identifier stored in AsyncStorage. */
async function getOrCreateDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `android_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    console.log("[FCM] Created new device ID:", id);
  }
  return id;
}

// ─── Permission helper ────────────────────────────────────────────────────────

/**
 * Request POST_NOTIFICATIONS permission on Android 13+ (API 33+).
 * The request is only shown ONCE — subsequent calls return the stored result.
 * Returns true if notifications are allowed.
 */
async function ensureNotificationPermission(): Promise<boolean> {
  console.log(`[FCM] Checking notification permission — OS=${Platform.OS} API=${Platform.Version}`);

  // Android < 13: no runtime permission required
  if (Platform.OS !== "android") {
    console.log("[FCM] Non-Android platform — permission skipped");
    return true;
  }
  if (Number(Platform.Version) < 33) {
    console.log(`[FCM] Android API ${Platform.Version} < 33 — POST_NOTIFICATIONS not required`);
    return true;
  }

  const alreadyAsked = await AsyncStorage.getItem(NOTIF_PERMISSION_ASKED);
  console.log("[FCM] Stored permission state:", alreadyAsked ?? "not asked yet");

  if (alreadyAsked === "granted") {
    console.log("[FCM] POST_NOTIFICATIONS already granted");
    return true;
  }
  if (alreadyAsked === "denied") {
    console.warn("[FCM] POST_NOTIFICATIONS previously denied — will not ask again");
    return false;
  }

  // First time — show the system dialog
  console.log("[FCM] Requesting POST_NOTIFICATIONS permission from user...");
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS ?? ("android.permission.POST_NOTIFICATIONS" as any),
    );
    const granted = result === PermissionsAndroid.RESULTS.GRANTED;
    await AsyncStorage.setItem(NOTIF_PERMISSION_ASKED, granted ? "granted" : "denied");
    console.log(`[FCM] Permission dialog result: ${result} — granted=${granted}`);
    if (!granted) {
      console.warn("[FCM] POST_NOTIFICATIONS permission denied by user — push notifications will not work");
    }
    return granted;
  } catch (err) {
    console.warn("[FCM] Permission request threw:", err);
    return false;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ForegroundMessage {
  title: string;
  body:  string;
  data?: Record<string, string>;
}

export interface UseFCMOptions {
  /** Called when a visible notification arrives while the app is in the foreground. */
  onForegroundMessage?: (msg: ForegroundMessage) => void;
  /**
   * Called for silent (data-only) FCM messages — edits, deletes, reactions,
   * typing indicators, read receipts. Must NOT show any notification banner.
   */
  onSilentMessage?: (data: Record<string, string>) => void;
  /** Called when the user taps a notification (background or quit state). */
  navigate?: (screen: string, params?: Record<string, string>) => void;
  /** When false, the hook does nothing (use before the user is logged in). */
  enabled?: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFCM({
  onForegroundMessage,
  onSilentMessage,
  navigate,
  enabled = true,
}: UseFCMOptions = {}) {
  /**
   * Store callbacks in refs so that changes to the callback references do NOT
   * retrigger the main useEffect. Listeners call these refs at invocation time,
   * which means they always use the latest callback without ever causing a
   * re-initialization cycle.
   *
   * Pattern: assign in render body (not in an effect) so the ref is always
   * synchronised before any listener could fire.
   */
  const onForegroundMessageRef = useRef(onForegroundMessage);
  onForegroundMessageRef.current = onForegroundMessage;

  const onSilentMessageRef = useRef(onSilentMessage);
  onSilentMessageRef.current = onSilentMessage;

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  /**
   * All listener unsubscribe functions collected here and called on unmount.
   * This guarantees zero memory leaks from Firebase listeners.
   */
  const unsubscribers   = useRef<Array<() => void>>([]);
  const registeredToken = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    unsubscribers.current.forEach((u) => {
      try { u(); } catch { /* ignore unsubscribe errors */ }
    });
    unsubscribers.current = [];
  }, []);

  // ── Token registration ─────────────────────────────────────────────────────

  const registerToken = useCallback(async (token: string) => {
    if (!token) {
      console.warn("[FCM] registerToken called with empty token — skipping");
      return;
    }
    // Skip network call if the token hasn't changed since last registration
    if (token === registeredToken.current) {
      console.log("[FCM] Token unchanged — skipping re-registration");
      return;
    }
    registeredToken.current = token;

    // Persist locally so AuthContext logout can read it even if the hook unmounts first
    await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
    console.log("[FCM] Token obtained (last 10 chars):", token.slice(-10));

    try {
      const deviceId = await getOrCreateDeviceId();
      console.log("[FCM] Registering token with backend — deviceId:", deviceId);
      const response = await customFetch("/api/notifications/fcm-token", {
        method: "POST",
        body:   JSON.stringify({ token, deviceId }),
      });
      console.log("[FCM] Token registered with backend — status:", (response as any)?.status ?? "ok");
    } catch (err) {
      // Non-fatal — token will be registered on next app launch
      console.warn("[FCM] Failed to register token with backend:", err);
    }
  }, []);

  // ── Token removal (logout) ─────────────────────────────────────────────────

  const unregisterToken = useCallback(async () => {
    const token    = registeredToken.current ?? (await AsyncStorage.getItem(FCM_TOKEN_KEY));
    const deviceId = await getOrCreateDeviceId();

    // Clear local state immediately so no further pushes are attributed here
    registeredToken.current = null;
    await AsyncStorage.removeItem(FCM_TOKEN_KEY);

    console.log("[FCM] Unregistering token on logout — deviceId:", deviceId);

    if (token) {
      try {
        await customFetch("/api/notifications/fcm-token", {
          method: "DELETE",
          body:   JSON.stringify({ token, deviceId }),
        });
        console.log("[FCM] Token unregistered successfully");
      } catch (err) {
        console.warn("[FCM] Failed to unregister token (non-fatal):", err);
        /* Logout must never be blocked by a network error */
      }
    } else {
      console.log("[FCM] No token to unregister (already cleared)");
    }
  }, []);

  // ── Deep-link navigation ───────────────────────────────────────────────────

  const handleNavigation = useCallback(
    (data?: Record<string, string>) => {
      if (!data) {
        console.log("[FCM] Navigation target: none (no data)");
        return;
      }
      if (!data.screen) {
        console.warn("[FCM] Navigation target: unknown — no screen in data. Keys:", Object.keys(data));
        return;
      }
      console.log(`[FCM] Navigation target: screen="${data.screen}" params:`, JSON.stringify(data));
      const { screen, ...params } = data;
      navigateRef.current?.(screen, params);
    },
    [], // stable — uses ref internally
  );

  // ── Main effect ────────────────────────────────────────────────────────────
  //
  // IMPORTANT: This effect only depends on `enabled`.
  // Callbacks (onForegroundMessage, onSilentMessage, navigate) are accessed via
  // refs so that changing the callback reference (e.g. a parent re-render passing
  // a new inline arrow function) does NOT cause cleanup + re-initialization.
  // This fixes the "Initialising FCM listeners / Cleaning up FCM listeners" loop.

  useEffect(() => {
    if (!enabled) {
      console.log("[FCM] Hook disabled (user not logged in) — no listeners registered");
      return;
    }
    if (Platform.OS !== "android") {
      console.log("[FCM] Non-Android platform — hook inactive");
      return;
    }

    console.log("[FCM] Initialising FCM listeners...");

    // mounted flag prevents state updates after unmount
    let mounted = true;

    async function init() {
      try {
        // ── Step 1: Request POST_NOTIFICATIONS permission ──────────────────
        console.log("[FCM] Step 1/6 — Requesting notification permission");
        const allowed = await ensureNotificationPermission();
        if (!allowed) {
          console.warn("[FCM] Step 1/6 — Permission denied; FCM inactive");
          return;
        }
        if (!mounted) return;
        console.log("[FCM] Step 1/6 — Permission granted");

        // ── Step 2: Get and register the current FCM token ─────────────────
        console.log("[FCM] Step 2/6 — Retrieving FCM token from Firebase");
        const messagingInst = getMessaging();
        let token: string;
        try {
          token = await getToken(messagingInst);
          console.log("[FCM] Step 2/6 — Token retrieved successfully");
        } catch (tokenErr) {
          console.error("[FCM] Step 2/6 — Failed to get FCM token:", tokenErr);
          console.error("[FCM] DIAGNOSIS: If you see 'SERVICE_NOT_AVAILABLE', check:");
          console.error("  1. google-services.json is present in android/app/");
          console.error("  2. Device/emulator has Google Play Services");
          console.error("  3. Firebase project is configured for this app's package (com.o2o.app)");
          return;
        }
        if (mounted) await registerToken(token);

        // ── Step 3: Token refresh listener ─────────────────────────────────
        console.log("[FCM] Step 3/6 — Registering token refresh listener");
        const unsubRefresh = onTokenRefresh(messagingInst, async (newToken) => {
          console.log("[FCM] Token refresh — new token (last 10):", newToken.slice(-10));
          if (mounted) await registerToken(newToken);
        });
        unsubscribers.current.push(unsubRefresh);

        // ── Step 4: Foreground message handler ─────────────────────────────
        // IMPORTANT: FCM does NOT auto-display system notifications in foreground.
        // We show an in-app banner (via onForegroundMessage) instead — same as WhatsApp.
        // Background/terminated notifications are handled automatically by the SDK.
        console.log("[FCM] Step 4/6 — Registering foreground message listener");
        const unsubForeground = onMessage(
          messagingInst,
          async (msg: FirebaseMessagingTypes.RemoteMessage) => {
            if (!mounted) return;

            const hasNotif = !!msg.notification;
            const type     = msg.data?.["type"] ?? "unknown";
            console.log(
              `[FCM] Foreground message received — type=${type} hasNotification=${hasNotif}` +
              ` messageId=${msg.messageId ?? "none"}`,
            );

            if (!hasNotif && msg.data) {
              // Silent data-only push (edit, delete, reaction, typing, read-receipt)
              console.log("[FCM] Foreground SILENT message — dispatching to onSilentMessage");
              onSilentMessageRef.current?.(msg.data as Record<string, string>);
              return;
            }

            if (msg.notification) {
              // Visible notification received while foregrounded — show in-app banner.
              // The system tray notification is NOT shown in foreground (FCM limitation).
              console.log(
                `[FCM] Foreground VISIBLE message — showing in-app banner. title="${msg.notification.title}"`,
              );
              onForegroundMessageRef.current?.({
                title: msg.notification.title ?? "O2O",
                body:  msg.notification.body  ?? "",
                data:  msg.data as Record<string, string> | undefined,
              });
            }
          },
        );
        unsubscribers.current.push(unsubForeground);

        // ── Step 5: Background tap handler ─────────────────────────────────
        // App was backgrounded, user tapped the notification in the system tray.
        // onNewIntent() in MainActivity.java ensures the intent data is forwarded.
        console.log("[FCM] Step 5/6 — Registering background-tap listener (onNotificationOpenedApp)");
        const unsubBgTap = onNotificationOpenedApp(messagingInst, (msg) => {
          const screen = (msg.data as any)?.screen ?? "none";
          console.log(`[FCM] Notification opened (background) — screen=${screen} data:`, JSON.stringify(msg.data));
          if (mounted) handleNavigation(msg.data as Record<string, string> | undefined);
        });
        unsubscribers.current.push(unsubBgTap);

        // ── Step 6: Quit-state tap handler ─────────────────────────────────
        // App was fully closed, user tapped the notification.
        // getInitialNotification() returns the notification that launched the app.
        console.log("[FCM] Step 6/6 — Checking getInitialNotification (quit-state tap)");
        const initial = await getInitialNotification(messagingInst);
        if (initial) {
          const screen = (initial.data as any)?.screen ?? "none";
          console.log(
            `[FCM] Notification opened (quit-state) — screen=${screen}` +
            ` messageId=${initial.messageId ?? "none"} data:`,
            JSON.stringify(initial.data),
          );
          if (mounted) {
            // Delay ensures React Navigation is mounted and ready before navigating
            setTimeout(
              () => handleNavigation(initial.data as Record<string, string> | undefined),
              600,
            );
          }
        } else {
          console.log("[FCM] No initial notification (normal launch, not from tapped notification)");
        }

        console.log("[FCM] All 6 FCM lifecycle steps complete — notifications fully active");
      } catch (err) {
        console.warn("[FCM] Initialisation error:", err);
      }
    }

    init();

    // Cleanup: unsubscribe all listeners when enabled changes (login/logout only)
    return () => {
      console.log("[FCM] Cleaning up FCM listeners");
      mounted = false;
      cleanup();
    };

  // IMPORTANT: Do NOT add onForegroundMessage, onSilentMessage, or navigate here.
  // They are accessed via refs — adding them would cause cleanup+reinit on every
  // parent re-render that passes a new inline arrow function (the original bug).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { unregisterToken };
}
