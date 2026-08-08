import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@/compat/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { UploadProgress } from "@/lib/uploadMedia";

interface UploadProgressBubbleProps {
  fileName: string;
  progress: UploadProgress | null;
  state: "uploading" | "paused" | "failed" | "cancelled";
  fileType?: "image" | "video" | "audio" | "file" | string;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
}

function getFileTypeInfo(fileName: string, typeHint?: string) {
  const lower = (fileName || "").toLowerCase();
  const hint = (typeHint || "").toLowerCase();

  if (hint === "video" || lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.includes("video")) {
    return { icon: "video", color: "#EF4444", bg: "#FEE2E2", label: "Video" };
  }
  if (hint === "audio" || lower.endsWith(".mp3") || lower.endsWith(".m4a") || lower.includes("voice") || lower.includes("audio")) {
    return { icon: "mic", color: "#06B6D4", bg: "#CFFAFE", label: "Audio" };
  }
  if (hint === "file" || lower.endsWith(".pdf") || lower.endsWith(".doc") || lower.endsWith(".docx") || lower.endsWith(".xls") || lower.endsWith(".xlsx") || lower.endsWith(".ppt") || lower.endsWith(".pptx")) {
    return { icon: "file-text", color: "#10B981", bg: "#D1FAE5", label: "Document" };
  }
  if (lower.includes("photos") || lower.includes("album")) {
    return { icon: "layers", color: "#3B82F6", bg: "#DBEAFE", label: "Album" };
  }
  return { icon: "image", color: "#8B5CF6", bg: "#EDE9FE", label: "Image" };
}

function formatEta(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `${Math.round(seconds)}s left`;
  return `${Math.round(seconds / 60)}m left`;
}

export function UploadProgressBubble({
  fileName,
  progress,
  state,
  fileType,
  onPause,
  onResume,
  onCancel,
  onRetry,
}: UploadProgressBubbleProps) {
  const colors = useColors();
  const animWidth = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (progress?.percent != null) {
      Animated.timing(animWidth, {
        toValue: progress.percent,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [progress?.percent]);

  useEffect(() => {
    if (state === "uploading") {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [state]);

  const isFailed = state === "failed" || state === "cancelled";
  const isPaused = state === "paused";
  const typeInfo = getFileTypeInfo(fileName, fileType);
  const percent = progress?.percent ?? 0;
  const eta = progress?.etaSeconds ? formatEta(progress.etaSeconds) : "";

  return (
    <View
      style={[
        styles.bubble,
        {
          backgroundColor: colors.card,
          borderColor: isFailed ? "#FCA5A5" : colors.border,
        },
      ]}
    >
      <View style={styles.topRow}>
        {/* Type Icon Pill */}
        <Animated.View
          style={[
            styles.iconContainer,
            { backgroundColor: isFailed ? "#FEE2E2" : typeInfo.bg },
            state === "uploading" && { opacity: pulseAnim },
          ]}
        >
          <Feather
            name={isFailed ? "alert-circle" : (typeInfo.icon as any)}
            size={18}
            color={isFailed ? "#EF4444" : typeInfo.color}
          />
        </Animated.View>

        {/* Content Info */}
        <View style={styles.contentWrap}>
          <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>
            {fileName}
          </Text>

          <Text style={[styles.subText, { color: isFailed ? "#EF4444" : colors.mutedForeground }]}>
            {isFailed
              ? state === "cancelled"
                ? "Upload cancelled"
                : "Upload failed"
              : isPaused
              ? "Upload paused"
              : progress
              ? `${percent}% · ${progress.loadedStr || ""} ${progress.totalStr ? `/ ${progress.totalStr}` : ""} ${eta ? `· ${eta}` : ""}`
              : "Uploading media…"}
          </Text>
        </View>

        {/* Action Controls */}
        <View style={styles.actionsRow}>
          {isFailed && onRetry && (
            <TouchableOpacity
              onPress={onRetry}
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Feather name="refresh-cw" size={12} color="#fff" />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}

          {!isFailed && !isPaused && onPause && (
            <TouchableOpacity onPress={onPause} style={styles.controlBtn}>
              <Feather name="pause" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}

          {isPaused && onResume && (
            <TouchableOpacity onPress={onResume} style={styles.controlBtn}>
              <Feather name="play" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}

          {onCancel && !isFailed && (
            <TouchableOpacity onPress={onCancel} style={styles.controlBtn}>
              <Feather name="x" size={16} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Progress Bar Track */}
      {!isFailed && (
        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: isPaused ? "#F59E0B" : typeInfo.color,
                width: animWidth.interpolate({
                  inputRange: [0, 100],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 16,
    minWidth: 230,
    maxWidth: 300,
    alignSelf: "flex-end",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  contentWrap: {
    flex: 1,
    justifyContent: "center",
  },
  fileName: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  subText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  controlBtn: {
    padding: 6,
    borderRadius: 8,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  retryText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 10,
    width: "100%",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
});
