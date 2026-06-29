import { DevSettings, Platform } from "react-native";

export async function reloadAppAsync() {
  if (Platform.OS === "web") {
    window.location.reload();
  } else {
    DevSettings.reload();
  }
}
