import React from "react";
import { Text } from "react-native";

export function Feather({ name, size, color, style }: any) {
  return <Text style={[{ color, fontSize: size, fontFamily: "sans-serif" }, style]}>[{name}]</Text>;
}

Feather.glyphMap = {};
