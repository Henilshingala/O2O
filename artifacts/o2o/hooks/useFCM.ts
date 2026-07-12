/**
 * useFCM — Firebase Cloud Messaging lifecycle hook.
 *
 * Responsibilities:
 *  1. Request POST_NOTIFICATIONS permission (Android 13+).
 *  2. Retrieve the FCM device token and register it with the backend (upsert).
 *  3. Listen for token refreshes and re-register automatically.
 *  4. Foreground messages:
 *     - Silent data-only messages (no `notification` block) → dispatch to silent handler.
 *     - Visible messages → show the in-app banner via `onForegroundMessage`.
 *  5. Background/quit notification taps → navigate to the correct screen via deep-link.
 *  6. On logout → unregister the token from the backend so no more pushes land.
 *
 * Background (quit-state) handler is registered in index.js via:
 *   messaging().setBackgroundMessageHandler(backgroundHandler)
 *
 * Usage:
 *   const { unregisterToken } = useFCM({ onForegroundMessage, onSilentMessage, navigate });
 */

import { useEffect, useCallback, useRef } from "react";
import { Platform, PermissionsAndroid } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import messaging, { FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import { customFetch } from "@workspace/api-client-react";

const DEVICE_ID_KEY = "@o2o_device_id";
const FCM_TOKEN_KEY = "@o2o_fcm_token";

/** Stable, persistent device identifier stored in AsyncStorage */
async function getOrCreateDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `android_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ForegroundMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface UseFCMOptions {
  /** Called when a visible notification arrives while the app is in the foreground */
  onForegroundMessage?: (msg: ForegroundMessage) => void;
  /**
   * Called for silent data-only FCM messages (edits, deletes, reactions, typing, read receipts).
   * These must NOT show any notification banner.
   */
  onSilentMessage?: (data: Record<string, string>) => void;
  /** Called when the user taps a notification (background or quit state) */
  navigate?: (screen: string, params?: Record<string, string>) => void;
  /** Set to false to skip initialising (before login) */
  enabled?: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFCM({
  onForegroundMessage,
  onSilentMessage,
  navigate,
  enabled = true,
}: UseFCMOptions = {}) {
  const unsubscribers   = useRef<Array<() => void>>([]);
  const registeredToken = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    unsubscribers.current.forEach((u) => u());
    unsubscribers.current = [];
  }, []);

  /** Register (or refresh) the FCM token on the backend */
  const registerToken = useCallback(async (token: string) => {
    // Skip if the token hasn't changed — avoids unnecessary network round-trips
    if (token === registeredToken.current) return;
    registeredToken.current = token;
    await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
    try {
      const deviceId = await getOrCreateDeviceId();
      await customFetch("/api/notifications/fcm-token", {
        method: "POST",
        body: JSON.stringify({ token, deviceId }),
      });
      console.log("[FCM] Token registered:", token.slice(-10));
    } catch (err) {
      console.warn("[FCM] Failed to register token:", err);
    }
  }, []);

  /** Remove token from backend on logout */
  const unregisterToken = useCallback(async () => {
    try {
      const token    = registeredToken.current ?? (await AsyncStorage.getItem(FCM_TOKEN_KEY));
      const deviceId = await getOrCreateDeviceId();
      if (token) {
        await customFetch("/api/notifications/fcm-token", {
          method: "DELETE",
          body: JSON.stringify({ token, deviceId }),
        });
        console.log("[FCM] Token unregistered");
      }
    } catch { /* never block logout */ }
    registeredToken.current = null;
    await AsyncStorage.removeItem(FCM_TOKEN_KEY);
  }, []);

  /** Deep-link navigation from notification data payload */
  const handleNavigation = useCallback(
    (data?: Record<string, string>) => {
      if (!navigate || !data?.screen) return;
      const { screen, ...params } = data;
      navigate(screen, params);
    },
    [navigate],
  );

  useEffect(() => {
    if (!enabled || Platform.OS !== "android") return;

    let mounted = true;

    async function init() {
      try {
        // ── 1. Runtime permission (Android 13 / API 33+) ──────────────────────
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.info("[FCM] Notification permission denied by user");
            return;
          }
        }

        // ── 2. Get & register token ───────────────────────────────────────────
        const token = await messaging().getToken();
        if (mounted) await registerToken(token);

        // ── 3. Token refresh listener ─────────────────────────────────────────
        const unsubRefresh = messaging().onTokenRefresh(async (newToken) => {
          console.log("[FCM] Token refreshed");
          if (mounted) await registerToken(newToken);
        });
        unsubscribers.current.push(unsubRefresh);

        // ── 4. Foreground message handler ─────────────────────────────────────
        const unsubForeground = messaging().onMessage(async (msg: FirebaseMessagingTypes.RemoteMessage) => {
          if (!mounted) return;

          // Data-only (silent) message — no notification object present
          if (!msg.notification && msg.data) {
            onSilentMessage?.(msg.data as Record<string, string>);
            return;
          }

          // Visible notification — show in-app banner
          if (msg.notification) {
            onForegroundMessage?.({
              title: msg.notification.title ?? "O2O",
              body:  msg.notification.body  ?? "",
              data:  msg.data as Record<string, string> | undefined,
            });
          }
        });
        unsubscribers.current.push(unsubForeground);

        // ── 5. Background tap (app was backgrounded, user tapped) ─────────────
        const unsubBackground = messaging().onNotificationOpenedApp((msg) => {
          if (mounted) handleNavigation(msg.data as Record<string, string> | undefined);
        });
        unsubscribers.current.push(unsubBackground);

        // ── 6. Quit-state tap (app was closed, user tapped notification) ──────
        const initial = await messaging().getInitialNotification();
        if (initial && mounted) {
          // Delay to ensure React Navigation is mounted and ready
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

    return () => {
      mounted = false;
      cleanup();
    };
  }, [enabled, registerToken, onForegroundMessage, onSilentMessage, handleNavigation, cleanup]);

  return { unregisterToken };
}
