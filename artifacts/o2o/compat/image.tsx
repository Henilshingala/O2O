import React from "react";
import { Image as RNImage, StyleSheet } from "react-native";

export function Image({ source, style, contentFit, ...props }: any) {
  // Map contentFit to resizeMode
  let resizeMode = "cover";
  if (contentFit === "contain") resizeMode = "contain";
  if (contentFit === "fill") resizeMode = "stretch";
  if (contentFit === "none") resizeMode = "center";

  return <RNImage source={source} style={style} resizeMode={resizeMode as any} {...props} />;
}
