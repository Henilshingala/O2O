import "react-native-gesture-handler";
import { AppRegistry } from "react-native";
import RootLayout from "./app/_layout";

console.log("Registering RootLayout");
AppRegistry.registerComponent("main", () => RootLayout);

console.log("Running application...");
try {
  AppRegistry.runApplication("main", {
    rootTag: document.getElementById("root"),
  });
  console.log("Application started");
} catch (e) {
  console.error("AppRegistry failed:", e);
}
