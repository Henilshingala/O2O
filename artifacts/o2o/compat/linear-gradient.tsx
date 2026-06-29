import React from "react";
import { View, Platform } from "react-native";

let NativeLinearGradient: any = null;
try {
  if (Platform.OS !== "web") {
    NativeLinearGradient = require("react-native-linear-gradient").default;
  }
} catch (e) {
  // fallback if not linked/installed yet
}

export function LinearGradient({ colors, start, end, style, children, ...props }: any) {
  if (Platform.OS === "web" || !NativeLinearGradient) {
    // Map start/end props (e.g. {x: 0, y: 0} to {x: 1, y: 1}) to css angle/direction
    const cssGradient = `linear-gradient(to bottom, ${colors.join(", ")})`;
    return (
      <View style={[{ backgroundImage: cssGradient } as any, style]} {...props}>
        {children}
      </View>
    );
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
