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
import messaging from "@react-native-firebase/messaging";
import RootLayout from "./app/_layout";

// ─── Firebase background / headless-JS message handler ───────────────────────
// Must be registered BEFORE AppRegistry.registerComponent().
// Runs inside a headless JS task when the app is fully closed or backgrounded
// and a push notification arrives.
//
// For VISIBLE notifications (payload has `notification` block):
//   The Firebase SDK displays the system notification automatically.
//   No code needed here.
//
// For SILENT / DATA-ONLY notifications (no `notification` block):
//   We receive the message here but intentionally do nothing in headless mode.
//   The in-app handler (useFCM.onSilentMessage) runs when the app is foregrounded.
//
// This handler must complete quickly and never throw — a crash here will cause
// Firebase to log a delivery failure even though the token is valid.
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  try {
    if (!remoteMessage.notification && remoteMessage.data) {
      // Silent data-only push: edit, delete, reaction, typing, read-receipt.
      // No visible notification is shown. The app will sync state when foregrounded.
      const type = remoteMessage.data["type"] ?? "unknown";
      console.log("[FCM] Background silent message:", type);
    }
    // Visible notifications are shown by the SDK — nothing extra to do.
  } catch (err) {
    // Never let this handler throw — Firebase SDK may penalise the device
    console.warn("[FCM] Background handler error:", err);
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
