import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Feather } from "@/compat/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { MessageStatus } from "@/types";

interface MessageStatusIconProps {
  status?: MessageStatus;
  isMine: boolean;
}

export function MessageStatusIcon({ status, isMine }: MessageStatusIconProps) {
  const colors = useColors();
  if (!isMine || !status) return null;

  if (status === "sending") {
    return <ActivityIndicator size={10} color={isMine ? "rgba(255,255,255,0.8)" : colors.mutedForeground} style={styles.icon} />;
  }
  if (status === "failed") {
    return <Feather name="alert-circle" size={12} color="#FCA5A5" style={styles.icon} />;
  }
  if (status === "delivered") {
    return <Feather name="check-circle" size={12} color={isMine ? "rgba(255,255,255,0.85)" : colors.success} style={styles.icon} />;
  }
  // sent
  return <Feather name="check" size={12} color={isMine ? "rgba(255,255,255,0.7)" : colors.mutedForeground} style={styles.icon} />;
}

const styles = StyleSheet.create({
  icon: { marginLeft: 4 },
});
