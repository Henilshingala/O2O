import { Platform } from "react-native";

let ReactNativeHapticFeedback: any = null;
try {
  if (Platform.OS !== "web") {
    ReactNativeHapticFeedback = require("react-native-haptic-feedback").default;
  }
} catch (e) {
  // fallback
}

export enum NotificationFeedbackType {
  Success = "Success",
  Warning = "Warning",
  Error = "Error",
}

export enum ImpactFeedbackStyle {
  Light = "Light",
  Medium = "Medium",
  Heavy = "Heavy",
}

export function trigger(type: string = "impactLight") {
  if (Platform.OS === "web" || !ReactNativeHapticFeedback) return;

  const options = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };

  ReactNativeHapticFeedback.trigger(type, options);
}

export async function impactAsync(style: string = "light") {
  trigger(style === "heavy" ? "impactHeavy" : style === "medium" ? "impactMedium" : "impactLight");
}

export async function notificationAsync(type: string = "success") {
  trigger(type === "error" ? "notificationError" : type === "warning" ? "notificationWarning" : "notificationSuccess");
}

export async function selectionAsync() {
  trigger("selection");
}
