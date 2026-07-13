/**
 * App entry point — registered with Android via AppRegistry.
 *
 * Order matters:
 *  1. Polyfills / shims (gesture-handler, reanimated) must be first.
 *  2. FCM background handler must be registered before AppRegistry.
 *  3. AppRegistry.registerComponent() last.
 *
 * This file must NOT export anything (it is an entry point, not a module).
 */

import "react-native-gesture-handler";
import "react-native-reanimated";
import { AppRegistry, LogBox } from "react-native";
import { getMessaging, setBackgroundMessageHandler } from "@react-native-firebase/messaging";
import RootLayout from "./app/_layout";

// ─── Firebase background / headless-JS message handler ───────────────────────
// Must be registered BEFORE AppRegistry.registerComponent().
//
// This handler runs inside a headless JS task when the app is:
//   - Fully closed (terminated state), OR
//   - In the background and a push arrives
//
// For VISIBLE notifications (payload has `notification` block):
//   The @react-native-firebase/messaging SDK displays the system notification
//   automatically via its native FirebaseMessagingService. This JS handler
//   still fires so we can log receipt, but no display code is needed here.
//
// For SILENT / DATA-ONLY notifications (no `notification` block):
//   We receive the message here. No visible notification is shown.
//   The in-app handler (useFCM.onSilentMessage) runs when app is foregrounded.
//
// IMPORTANT:
//   This handler must complete quickly and never throw — a crash here will
//   cause Firebase to log a delivery failure even though the token is valid.
//
// IMPORTANT:
//   The `clickAction` in the server FCM payload must NOT be set to
//   "FLUTTER_NOTIFICATION_CLICK". That Flutter-only value breaks React Native
//   notification display. The sdk uses MainActivity directly without a
//   custom clickAction.
setBackgroundMessageHandler(getMessaging(), async (remoteMessage) => {
  try {
    const hasNotification = !!remoteMessage.notification;
    const hasData = !!(remoteMessage.data && Object.keys(remoteMessage.data).length > 0);
    const type = remoteMessage.data?.["type"] ?? "unknown";
    const screen = remoteMessage.data?.["screen"] ?? "none";
    const messageId = remoteMessage.messageId ?? "no-id";

    if (hasNotification) {
      // Visible notification — the SDK will show the system tray notification
      // automatically. We just log for debugging.
      console.log(
        `[FCM] Background VISIBLE notification received — messageId=${messageId} type=${type} screen=${screen}` +
        ` title="${remoteMessage.notification?.title}" body="${remoteMessage.notification?.body}"`,
      );
    } else if (hasData) {
      // Silent data-only push (edit, delete, reaction, typing, read-receipt).
      // No visible notification is shown. The app will sync state when foregrounded.
      console.log(
        `[FCM] Background SILENT message received — messageId=${messageId} type=${type} screen=${screen}`,
      );
    } else {
      console.log(`[FCM] Background message with no notification and no data — messageId=${messageId}`);
    }
  } catch (err) {
    // Never let this handler throw — Firebase SDK may penalise the device
    console.warn("[FCM] Background handler error (non-fatal):", err);
  }
});

// ─── LogBox ───────────────────────────────────────────────────────────────────
LogBox.ignoreLogs([
  "Sending `onAnimatedValueUpdate`",
  "[Reanimated]",
  "socket.io-client",
  "VirtualizedLists should never be nested",
  "Require cycle: ../",
  "Require cycle: ..\\",
]);

// ─── Register root component ──────────────────────────────────────────────────
// "main" must match getMainComponentName() in MainActivity.java
// "index" must match getJSMainModuleName() in MainApplication.java
AppRegistry.registerComponent("main", () => RootLayout);
