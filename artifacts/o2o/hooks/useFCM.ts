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
 *  5. Background/quit notification taps → navigate to the correct screen.
 *  6. On logout → unregister the token from the backend immediately.
 *
 * All listeners are unsubscribed when the component unmounts → no memory leaks.
 *
 * Background (quit-state) handler is registered in index.js via:
 *   messaging().setBackgroundMessageHandler(...)
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
  // Android < 13: no runtime permission required
  if (Platform.OS !== "android" || Number(Platform.Version) < 33) return true;

  const alreadyAsked = await AsyncStorage.getItem(NOTIF_PERMISSION_ASKED);

  if (alreadyAsked === "granted") return true;
  if (alreadyAsked === "denied")  return false; // user already declined, don't ask again

  // First time — show the system dialog
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS ?? ("android.permission.POST_NOTIFICATIONS" as any),
    );
    const granted = result === PermissionsAndroid.RESULTS.GRANTED;
    await AsyncStorage.setItem(NOTIF_PERMISSION_ASKED, granted ? "granted" : "denied");
    if (!granted) console.info("[FCM] POST_NOTIFICATIONS permission denied by user");
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
    if (!token) return;
    // Skip network call if the token hasn't changed since last registration
    if (token === registeredToken.current) return;
    registeredToken.current = token;

    // Persist locally so AuthContext logout can read it even if the hook unmounts first
    await AsyncStorage.setItem(FCM_TOKEN_KEY, token);

    try {
      const deviceId = await getOrCreateDeviceId();
      await customFetch("/api/notifications/fcm-token", {
        method: "POST",
        body:   JSON.stringify({ token, deviceId }),
      });
      console.log("[FCM] Token registered:", token.slice(-10));
    } catch (err) {
      // Non-fatal — token will be registered on next app launch
      console.warn("[FCM] Failed to register token:", err);
    }
  }, []);

  // ── Token removal (logout) ─────────────────────────────────────────────────

  const unregisterToken = useCallback(async () => {
    const token    = registeredToken.current ?? (await AsyncStorage.getItem(FCM_TOKEN_KEY));
    const deviceId = await getOrCreateDeviceId();

    // Clear local state immediately so no further pushes are attributed here
    registeredToken.current = null;
    await AsyncStorage.removeItem(FCM_TOKEN_KEY);

    if (token) {
      try {
        await customFetch("/api/notifications/fcm-token", {
          method: "DELETE",
          body:   JSON.stringify({ token, deviceId }),
        });
        console.log("[FCM] Token unregistered on logout");
      } catch {
        /* Logout must never be blocked by a network error */
      }
    }
  }, []);

  // ── Deep-link navigation ───────────────────────────────────────────────────

  const handleNavigation = useCallback(
    (data?: Record<string, string>) => {
      if (!navigate || !data?.screen) return;
      const { screen, ...params } = data;
      navigate(screen, params);
    },
    [navigate],
  );

  // ── Main effect ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled || Platform.OS !== "android") return;

    // mounted flag prevents state updates after unmount
    let mounted = true;

    async function init() {
      try {
        // 1. Permission (requested at most once per install, persisted)
        const allowed = await ensureNotificationPermission();
        if (!allowed || !mounted) return;

        // 2. Get and register the current FCM token
        const messagingInst = getMessaging();
        const token = await getToken(messagingInst);
        if (mounted) await registerToken(token);

        // 3. Token refresh listener — re-register automatically
        const unsubRefresh = onTokenRefresh(messagingInst, async (newToken) => {
          console.log("[FCM] Token refreshed by Firebase");
          if (mounted) await registerToken(newToken);
        });
        unsubscribers.current.push(unsubRefresh);

        // 4. Foreground message handler
        //    - No notification block → silent data-only message → onSilentMessage
        //    - Notification block present → visible message → onForegroundMessage (in-app banner)
        //    NOTE: Socket.IO already delivers the real-time update when the app is foreground.
        //          The FCM foreground handler should show a banner only; do not duplicate data.
        const unsubForeground = onMessage(
          messagingInst,
          async (msg: FirebaseMessagingTypes.RemoteMessage) => {
            if (!mounted) return;

            if (!msg.notification && msg.data) {
              // Silent data-only push (edit, delete, reaction, typing, read receipt)
              onSilentMessage?.(msg.data as Record<string, string>);
              return;
            }

            if (msg.notification) {
              // Visible notification received while foregrounded
              onForegroundMessage?.({
                title: msg.notification.title ?? "O2O",
                body:  msg.notification.body  ?? "",
                data:  msg.data as Record<string, string> | undefined,
              });
            }
          },
        );
        unsubscribers.current.push(unsubForeground);

        // 5. Background tap — app was backgrounded, user tapped the notification
        const unsubBgTap = onNotificationOpenedApp(messagingInst, (msg) => {
          if (mounted) handleNavigation(msg.data as Record<string, string> | undefined);
        });
        unsubscribers.current.push(unsubBgTap);

        // 6. Quit-state tap — app was fully closed, user tapped the notification
        //    getInitialNotification() returns the notification that launched the app.
        const initial = await getInitialNotification(messagingInst);
        if (initial && mounted) {
          // Delay ensures React Navigation is mounted and ready before navigating
          setTimeout(
            () => handleNavigation(initial.data as Record<string, string> | undefined),
            600,
          );
        }
      } catch (err) {
        console.warn("[FCM] Initialisation error:", err);
      }
    }

    init();

    // Cleanup: unsubscribe all listeners when component unmounts or enabled→false
    return () => {
      mounted = false;
      cleanup();
    };
  }, [enabled, registerToken, onForegroundMessage, onSilentMessage, handleNavigation, cleanup]);

  return { unregisterToken };
}
