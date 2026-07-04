import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface BadgeProps {
  label: string;
  variant?: "primary" | "success" | "warning" | "destructive" | "muted";
}

export function Badge({ label, variant = "primary" }: BadgeProps) {
  const colors = useColors();
  const bgMap = {
    primary: colors.accent,
    success: "#D1FAE5",
    warning: "#FEF3C7",
    destructive: "#FEE2E2",
    muted: colors.muted,
  };
  const fgMap = {
    primary: colors.accentForeground,
    success: "#065F46",
    warning: "#92400E",
    destructive: "#991B1B",
    muted: colors.mutedForeground,
  };
  return (
    <View style={[styles.badge, { backgroundColor: bgMap[variant] }]}>
      <Text style={[styles.label, { color: fgMap[variant] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  label: { fontSize: 11, fontWeight: "600" },
});
