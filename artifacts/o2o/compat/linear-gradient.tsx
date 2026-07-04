import React from "react";
import { View, StyleSheet } from "react-native";

let NativeLinearGradient: any = null;
try {
  NativeLinearGradient = require("react-native-linear-gradient").default;
} catch (e) {
  // fallback if not linked/installed yet
}

export function LinearGradient({ colors, start, end, style, children, ...props }: any) {
  if (!NativeLinearGradient) {
    const backgroundColor = colors?.[0] || "#1E3A8A";
    return <View style={[styles.fallbackGradient, { backgroundColor }, style]} {...props}>{children}</View>;
  }

  return (
    <NativeLinearGradient
      colors={colors}
      start={start}
      end={end}
      style={style}
      {...props}
    >
      {children}
    </NativeLinearGradient>
  );
}

const styles = StyleSheet.create({
  fallbackGradient: {
    flex: 1,
  },
});
