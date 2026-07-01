import React from "react";
import { Text } from "react-native";

const ICON_EMOJI: Record<string, string> = {
  image: "🖼️",
  eye: "👁️",
  heart: "❤️",
  "refresh-cw": "🔄",
  "alert-circle": "⚠️",
  x: "❌",
  "arrow-left": "⬅️",
  radio: "🔘",
  inbox: "📥",
  "check-circle": "✅",
  "x-circle": "❌",
  "message-circle": "💬",
  plus: "➕",
  "trending-up": "📈",
  clock: "⏰",
  users: "👥",
  "more-vertical": "⋮",
  send: "📤",
  package: "📦",
  camera: "📷",
  lock: "🔒",
  "chevron-up": "⬆️",
  "chevron-down": "⬇️",
  award: "🏆",
  star: "⭐",
  "alert-triangle": "⚠️",
  loader: "⏳",
  bell: "🔔",
  home: "🏠",
  settings: "⚙️",
  search: "🔍",
  "user-plus": "➕",
  "user-x": "🚫",
  "message-square": "💬",
  "edit-2": "✏️",
  check: "✔️",
};

export function Feather({ name, size, color, style }: any) {
  const emoji = ICON_EMOJI[name] ?? "🔹";
  return <Text style={[{ color, fontSize: size, fontFamily: "sans-serif" }, style]}>{emoji}</Text>;
}

Feather.glyphMap = {};
