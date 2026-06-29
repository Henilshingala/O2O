import React from "react";
import Icon from "react-native-vector-icons/Feather";

export function Feather({ name, size, color, style }: any) {
  return <Icon name={name} size={size} color={color} style={style} />;
}

// @ts-ignore - glyphMap exists at runtime
Feather.glyphMap = Icon.glyphMap;
