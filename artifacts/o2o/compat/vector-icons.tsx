import React from "react";
import Icon from "react-native-vector-icons/Feather";
import Ionicon from "react-native-vector-icons/Ionicons";

export function Feather({ name, size, color, style }: any) {
  // @ts-ignore — refs type mismatch between @types/react-native-vector-icons and @types/react
  return <Icon name={name} size={size} color={color} style={style} />;
}

export function Ionicons({ name, size, color, style }: any) {
  // @ts-ignore — refs type mismatch between @types/react-native-vector-icons and @types/react
  return <Ionicon name={name} size={size} color={color} style={style} />;
}

// @ts-ignore - glyphMap exists at runtime
Feather.glyphMap = Icon.glyphMap;
// @ts-ignore
Ionicons.glyphMap = Ionicon.glyphMap;
