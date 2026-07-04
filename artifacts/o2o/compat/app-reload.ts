import { DevSettings } from "react-native";

export async function reloadAppAsync() {
  DevSettings.reload();
}
