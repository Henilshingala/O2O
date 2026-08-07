import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

interface AvatarProps {
  name?: string | null;
  size?: number;
  color?: string;
  uri?: string | null;
}

const COLORS = [
  "#2563EB", "#7C3AED", "#DC2626", "#D97706",
  "#059669", "#0891B2", "#BE185D", "#4F46E5",
];

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function Avatar({ name, size = 40, color, uri }: AvatarProps) {
  const safeName = name?.trim() ? name.trim() : "Unknown";
  const initials = safeName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const bg = color ?? hashColor(safeName);
  const fontSize = size * 0.38;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          styles.image,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <Text style={[styles.initials, { fontSize, color: "#fff" }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
  initials: { fontWeight: "700" },
  image: { backgroundColor: "#E2E8F0" },
});
