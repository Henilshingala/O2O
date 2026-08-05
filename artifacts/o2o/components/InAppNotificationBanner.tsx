/**
 * InAppNotificationBanner
 *
 * Shown when a push notification arrives while the app is in the foreground.
 * Slides in from the top, auto-dismisses after 4 s, and is tappable for navigation.
 *
 * Inspired by WhatsApp / iMessage style banners.
 */

import React, { useEffect, useRef, useCallback } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  PanResponder,
  Dimensions,
} from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
const AUTO_DISMISS_MS = 4000;

export interface InAppBannerData {
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface Props {
  notification: InAppBannerData | null;
  onDismiss: () => void;
  onPress?: (data?: Record<string, string>) => void;
}

export function InAppNotificationBanner({ notification, onDismiss, onPress }: Props) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => onDismiss());
  }, [translateY, opacity, onDismiss]);

  useEffect(() => {
    if (!notification) return;

    // Slide in
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    // Auto-dismiss
    dismissTimer.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [notification, dismiss, translateY, opacity]);

  // Swipe up to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy < -5,
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -20) dismiss();
      },
    }),
  ).current;

  if (!notification) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }], opacity }]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.inner}
        onPress={() => {
          dismiss();
          onPress?.(notification.data);
        }}
      >
        {/* Icon strip */}
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>O</Text>
        </View>

        {/* Text */}
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={1}>{notification.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{notification.body}</Text>
        </View>

        {/* Dismiss × */}
        <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Progress bar */}
      <AutoDismissBar durationMs={AUTO_DISMISS_MS} />
    </Animated.View>
  );
}

/** Shrinking progress bar that mirrors the auto-dismiss timer */
function AutoDismissBar({ durationMs }: { durationMs: number }) {
  const width = useRef(new Animated.Value(SCREEN_WIDTH - 32)).current;
  useEffect(() => {
    Animated.timing(width, {
      toValue: 0,
      duration: durationMs,
      useNativeDriver: false,
    }).start();
  }, [width, durationMs]);
  return (
    <Animated.View style={[styles.progressBar, { width }]} />
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 44, // below status bar
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 20,
    borderRadius: 16,
    backgroundColor: "#1E293B",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    overflow: "hidden",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  iconBadge: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: "#069752",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  textCol: {
    flex: 1,
  },
  title: {
    color: "#F8FAFC",
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 2,
  },
  body: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 18,
  },
  close: {
    color: "#64748B",
    fontSize: 14,
    paddingLeft: 4,
  },
  progressBar: {
    height: 3,
    backgroundColor: "#3B82F6",
    borderRadius: 2,
    marginHorizontal: 16,
    marginBottom: 6,
  },
});
