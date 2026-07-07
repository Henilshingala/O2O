// Reanimated MUST be the very first import for proper native initialization
import "react-native-reanimated";
import "react-native-gesture-handler";
import { AppRegistry, LogBox } from 'react-native';
import RootLayout from "./app/_layout";

LogBox.ignoreAllLogs();

AppRegistry.registerComponent("main", () => RootLayout);
export default RootLayout;
