import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@/compat/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { UploadProgress } from "@/lib/uploadMedia";

const { width: SCREEN_W } = Dimensions.get("window");

interface UploadProgressBubbleProps {
  fileName: string;
  progress: UploadProgress | null;
  state: "uploading" | "paused" | "failed" | "cancelled";
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
}

function formatEta(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "Estimating…";
  if (seconds < 60) return `${Math.round(seconds)}s left`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m left`;
  return `${Math.round(seconds / 3600)}h left`;
}

export function UploadProgressBubble({
  fileName,
  progress,
  state,
  onPause,
  onResume,
  onCancel,
  onRetry,
}: UploadProgressBubbleProps) {
  const colors = useColors();
  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (progress) {
      Animated.timing(animWidth, {
        toValue: progress.percent,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  }, [progress?.percent]);

  const isFailed = state === "failed" || state === "cancelled";
  const isPaused = state === "paused";

  return (
    <View
      style={[
        styles.bubble,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <Feather
          name={isFailed ? "alert-circle" : isPaused ? "pause-circle" : "upload"}
          size={16}
          color={isFailed ? "#EF4444" : colors.primary}
        />
        <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>
          {fileName}
        </Text>
        <View style={styles.actions}>
          {isFailed && onRetry && (
            <TouchableOpacity onPress={onRetry} style={styles.actionBtn}>
              <Feather name="refresh-cw" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}
          {!isFailed && !isPaused && onPause && (
            <TouchableOpacity onPress={onPause} style={styles.actionBtn}>
              <Feather name="pause" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          {isPaused && onResume && (
            <TouchableOpacity onPress={onResume} style={styles.actionBtn}>
              <Feather name="play" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}
          {onCancel && !isFailed && (
            <TouchableOpacity onPress={onCancel} style={styles.actionBtn}>
              <Feather name="x" size={14} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isFailed ? (
        <Text style={styles.failText}>
          {state === "cancelled" ? "Cancelled — tap retry to try again" : "Upload failed — tap retry"}
        </Text>
      ) : (
        <>
          <View style={[styles.bar, { backgroundColor: colors.muted }]}>
            <Animated.View
              style={[
                styles.barFill,
                {
                  backgroundColor: isPaused ? "#F59E0B" : colors.primary,
                  width: animWidth.interpolate({
                    inputRange: [0, 100],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
          <View style={styles.stats}>
            <Text style={[styles.stat, { color: colors.mutedForeground }]}>
              {progress ? `${progress.loadedStr} / ${progress.totalStr}` : "Starting…"}
            </Text>
            <Text style={[styles.stat, { color: colors.mutedForeground }]}>
              {progress ? (isPaused ? "Paused" : `${progress.percent}% · ${formatEta(progress.etaSeconds)}`) : ""}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 16,
    maxWidth: SCREEN_W * 0.80,
    alignSelf: "flex-end",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 6,
  },
  actionBtn: {
    padding: 4,
  },
  bar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 6,
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stat: {
    fontSize: 10,
  },
  failText: {
    fontSize: 11,
    color: "#EF4444",
    marginTop: 2,
  },
});
