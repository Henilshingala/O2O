import React from "react";
import Icon from "react-native-vector-icons/Feather";
import Ionicon from "react-native-vector-icons/Ionicons";

export function Feather({ name, size, color, style }: any) {
  return <Icon name={name} size={size} color={color} style={style} />;
}

export function Ionicons({ name, size, color, style }: any) {
  return <Ionicon name={name} size={size} color={color} style={style} />;
}

// @ts-ignore - glyphMap exists at runtime
Feather.glyphMap = Icon.glyphMap;
// @ts-ignore
Ionicons.glyphMap = Ionicon.glyphMap;
