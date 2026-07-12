/**
 * useFCM — Firebase Cloud Messaging lifecycle hook.
 *
 * Responsibilities:
 *  1. Request notification permission on Android 13+.
 *  2. Retrieve the FCM token and register it with the backend.
 *  3. Listen for token refreshes and re-register.
 *  4. Handle foreground messages → show in-app banner (via callback).
 *  5. Handle notification tap (background/quit) → deep-link navigation.
 *  6. Remove the token from the backend on logout.
 *
 * Usage:
 *   const { onMessage } = useFCM({ onForegroundMessage, navigate });
 */

import { useEffect, useCallback, useRef } from "react";
import { Platform, PermissionsAndroid } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import messaging, { FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import { customFetch } from "@workspace/api-client-react";

const DEVICE_ID_KEY = "@o2o_device_id";
const FCM_TOKEN_KEY = "@o2o_fcm_token";

/** Generate a stable, random device identifier (UUID-like) */
async function getOrCreateDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `android_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export interface ForegroundMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface UseFCMOptions {
  /** Called when a message arrives while the app is in the foreground */
  onForegroundMessage?: (msg: ForegroundMessage) => void;
  /** Navigate to a screen when the user taps a notification */
  navigate?: (screen: string, params?: Record<string, string>) => void;
  /** Set to false to skip initializing (e.g. before the user logs in) */
  enabled?: boolean;
}

export function useFCM({ onForegroundMessage, navigate, enabled = true }: UseFCMOptions = {}) {
  const unsubscribers = useRef<Array<() => void>>([]);
  const registeredToken = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    unsubscribers.current.forEach((u) => u());
    unsubscribers.current = [];
  }, []);

  /** Register (or re-register) the FCM token with the backend */
  const registerToken = useCallback(async (token: string) => {
    if (token === registeredToken.current) return;
    registeredToken.current = token;
    await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
    try {
      const deviceId = await getOrCreateDeviceId();
      await customFetch("/api/notifications/fcm-token", {
        method: "POST",
        body: JSON.stringify({ token, deviceId }),
      });
    } catch (err) {
      console.warn("[FCM] Failed to register token:", err);
    }
  }, []);

  /** Remove the token from the backend (call on logout) */
  const unregisterToken = useCallback(async () => {
    try {
      const token = registeredToken.current ?? (await AsyncStorage.getItem(FCM_TOKEN_KEY));
      const deviceId = await getOrCreateDeviceId();
      if (token) {
        await customFetch("/api/notifications/fcm-token", {
          method: "DELETE",
          body: JSON.stringify({ token, deviceId }),
        });
      }
    } catch { /* ignore on logout */ }
    registeredToken.current = null;
    await AsyncStorage.removeItem(FCM_TOKEN_KEY);
  }, []);

  /** Navigate based on the notification data payload */
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
        // Android 13+ runtime permission
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.info("[FCM] Notification permission denied");
            return;
          }
        }

        // Get + register token
        const token = await messaging().getToken();
        if (mounted) await registerToken(token);

        // Listen for token refreshes
        const unsubRefresh = messaging().onTokenRefresh(async (newToken) => {
          if (mounted) await registerToken(newToken);
        });
        unsubscribers.current.push(unsubRefresh);

        // Foreground messages
        const unsubForeground = messaging().onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
          if (!mounted) return;
          const notification = remoteMessage.notification;
          if (!notification) return;
          onForegroundMessage?.({
            title: notification.title ?? "O2O",
            body: notification.body ?? "",
            data: remoteMessage.data as Record<string, string> | undefined,
          });
        });
        unsubscribers.current.push(unsubForeground);

        // Background tap — app was backgrounded, user tapped notification
        const unsubBackground = messaging().onNotificationOpenedApp((remoteMessage) => {
          if (mounted) handleNavigation(remoteMessage.data as Record<string, string> | undefined);
        });
        unsubscribers.current.push(unsubBackground);

        // Quit-state tap — app was fully closed, user tapped notification
        const initial = await messaging().getInitialNotification();
        if (initial && mounted) {
          // Small delay to ensure navigation is ready
          setTimeout(() => handleNavigation(initial.data as Record<string, string> | undefined), 500);
        }
      } catch (err) {
        console.warn("[FCM] Init error:", err);
      }
    }

    init();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [enabled, registerToken, onForegroundMessage, handleNavigation, cleanup]);

  return { unregisterToken };
}
