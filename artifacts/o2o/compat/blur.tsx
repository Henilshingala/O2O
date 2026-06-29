import React from "react";
import { View, StyleSheet, Platform } from "react-native";

let NativeBlurView: any = null;
try {
  if (Platform.OS !== "web") {
    NativeBlurView = require("@react-native-community/blur").BlurView;
  }
} catch (e) {
  // fallback
}

export function BlurView({ intensity, tint, style, children, ...props }: any) {
  if (Platform.OS === "web" || !NativeBlurView) {
    const isDark = tint === "dark";
    const backgroundColor = isDark ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.5)";
    const blurStyle = {
      backgroundColor,
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
    };
    return (
      <View style={[blurStyle as any, style]} {...props}>
        {children}
      </View>
    );
  }

  // Map intensity (0-100) and tint to @react-native-community/blur values
  const blurType = tint === "dark" ? "dark" : "light";

  return (
    <NativeBlurView
      blurType={blurType}
      blurAmount={intensity ? Math.floor(intensity / 10) : 10}
      style={[StyleSheet.absoluteFill, style]}
      {...props}
    >
      {children}
    </NativeBlurView>
  );
}
