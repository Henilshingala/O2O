// Reanimated MUST be the very first import for proper native initialization
import "react-native-reanimated";
import "react-native-gesture-handler";
import { AppRegistry } from "react-native";
import RootLayout from "./app/_layout";

AppRegistry.registerComponent("main", () => RootLayout);
export default RootLayout;
