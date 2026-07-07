// Reanimated MUST be the very first import for proper native initialization
import "react-native-reanimated";
import "react-native-gesture-handler";
import { AppRegistry, LogBox } from 'react-native';
import RootLayout from "./app/_layout";

// Suppress only specific noisy but harmless warnings — do NOT silence all logs.
// Real errors and crashes must surface in the Metro / device console.
LogBox.ignoreLogs([
  // React Navigation internal warning about nested navigators — not a bug
  'Sending `onAnimatedValueUpdate`',
  // Reanimated worklet source-map noise
  "[Reanimated]",
  // Socket.IO reconnection info noise
  "socket.io-client",
  // VirtualizedLists inside ScrollViews — acceptable in our layout
  'VirtualizedLists should never be nested',
]);

AppRegistry.registerComponent("main", () => RootLayout);
export default RootLayout;
