// react-native-reanimated MUST be the very first import for proper native init.
import "react-native-reanimated";
import "react-native-gesture-handler";
import { AppRegistry, LogBox } from 'react-native';
import RootLayout from "./app/_layout";

// Suppress only specific noisy-but-harmless warnings.
// Do NOT silence all logs — real errors and crashes must surface.
LogBox.ignoreLogs([
  // React Navigation internal animation event — not a bug
  'Sending `onAnimatedValueUpdate`',
  // Reanimated worklet source-map noise
  "[Reanimated]",
  // Socket.IO reconnection info noise
  "socket.io-client",
  // VirtualizedLists inside ScrollViews — acceptable in our layout
  'VirtualizedLists should never be nested',
  // Known RN 0.68 internal circular dependency (whatwg-fetch polyfill ↔ RN fetch).
  // The path prefix varies: "../../node_modules/…" on Mac/Linux,
  // "..\..\..\node_modules\…" on Windows. Match both by checking just the
  // leading ".." portion that appears in ALL require-cycle warnings from node_modules.
  'Require cycle: ../',   // Unix / Mac paths (../../node_modules/...)
  'Require cycle: ..\\',  // Windows paths  (..\..\..\node_modules\...)
]);

// Component name "main" must match MainActivity.java → getMainComponentName().
// JS entry "index" must match MainApplication.java → getJSMainModuleName().
AppRegistry.registerComponent("main", () => RootLayout);
export default RootLayout;
