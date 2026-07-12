import "react-native-gesture-handler";
import "react-native-reanimated";
import { AppRegistry, LogBox } from 'react-native';
import messaging from "@react-native-firebase/messaging";
import RootLayout from "./app/_layout";

// ─── FCM background / quit-state handler ─────────────────────────────────────
// Must be registered before AppRegistry.registerComponent().
// This runs inside a headless JS task when the app is fully closed or backgrounded
// and a push arrives. For silent data-only messages (edits, deletes, typing etc.)
// we simply return — no notification is shown.
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  // Visible notifications are displayed automatically by the Firebase SDK.
  // Only data-only messages need explicit handling here if we want to e.g.
  // write to local cache. For now, acknowledge receipt and return.
  if (!remoteMessage.notification && remoteMessage.data) {
    const type = remoteMessage.data['type'] as string | undefined;
    // Silent updates — no action needed in headless mode
    console.log('[FCM] Background data-only message:', type);
  }
});

// ─── Log suppression ─────────────────────────────────────────────────────────
LogBox.ignoreLogs([
  'Sending `onAnimatedValueUpdate`',
  "[Reanimated]",
  "socket.io-client",
  'VirtualizedLists should never be nested',
  'Require cycle: ../',
  'Require cycle: ..\\',
]);

// Component name "main" must match MainActivity.java → getMainComponentName().
// JS entry "index" must match MainApplication.java → getJSMainModuleName().
AppRegistry.registerComponent("main", () => RootLayout);
export default RootLayout;
