/**
 * MediaViewer — Full-screen media viewer
 *
 * Features:
 *  - Swipe left/right to navigate (FlatList, pagingEnabled)
 *  - Counter badge: "3 / 12"
 *  - Drag down to dismiss (PanResponder + Animated)
 *  - Double-tap to zoom in/out
 *  - Pinch-to-zoom (react-native-gesture-handler PinchGestureHandler)
 *  - Video pages: tap play button → in-app VideoPlayer (no browser)
 */
import React, {
  useCallback,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  PinchGestureHandler,
  State as GestureState,
} from "react-native-gesture-handler";
import { Feather } from "@/compat/vector-icons";
import { VideoPlayer } from "@/components/VideoPlayer";
import { resolveMediaUrl } from "@/lib/mediaUrl";

const { width: SW, height: SH } = Dimensions.get("window");

interface MediaViewerProps {
  visible: boolean;
  urls: string[];
  types: ("image" | "video")[];
  initialIndex?: number;
  onClose: () => void;
}

// Single page inside the viewer — handles zoom + pinch per page
function MediaPage({
  url,
  type,
  isCurrent,
  onPlayVideo,
}: {
  url: string;
  type: "image" | "video";
  isCurrent: boolean;
  onPlayVideo?: (uri: string) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(1);
  const pinchScale = useRef(new Animated.Value(1)).current;
  const lastTap = useRef(0);

  const onPinchEvent = Animated.event([{ nativeEvent: { scale: pinchScale } }], {
    useNativeDriver: true,
  });

  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === GestureState.END) {
      baseScale.current *= event.nativeEvent.scale;
      const next = Math.max(1, Math.min(4, baseScale.current));
      baseScale.current = next;
      Animated.spring(scale, { toValue: next, useNativeDriver: true }).start();
      pinchScale.setValue(1);
    }
  };

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (baseScale.current > 1) {
        baseScale.current = 1;
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
        pinchScale.setValue(1);
      } else {
        baseScale.current = 2.5;
        Animated.spring(scale, { toValue: 2.5, useNativeDriver: true }).start();
      }
    }
    lastTap.current = now;
  }, []);

  const combinedScale = Animated.multiply(scale, pinchScale);
  const resolvedUrl = resolveMediaUrl(url);

  return (
    <PinchGestureHandler
      onGestureEvent={onPinchEvent}
      onHandlerStateChange={onPinchHandlerStateChange}
      enabled={isCurrent && type === "image"}
    >
      <Animated.View style={styles.page}>
        <TouchableWithoutFeedback onPress={handleDoubleTap}>
          <Animated.Image
            source={{ uri: resolvedUrl }}
            style={[styles.pageImg, { transform: [{ scale: combinedScale }] }]}
            resizeMode="contain"
          />
        </TouchableWithoutFeedback>
        {type === "video" && (
          <TouchableOpacity
            style={styles.videoOverlay}
            onPress={() => onPlayVideo?.(resolvedUrl)}
          >
            <View style={styles.playCircle}>
              <Feather name="play" size={36} color="#fff" />
            </View>
            <Text style={styles.videoHint}>Tap to play</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </PinchGestureHandler>
  );
}

export function MediaViewer({
  visible,
  urls,
  types,
  initialIndex = 0,
  onClose,
}: MediaViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [videoPlayerUri, setVideoPlayerUri] = useState<string | null>(null);
  const flatRef = useRef<FlatList>(null);
  const translateY = useRef(new Animated.Value(0)).current;
  const bgOpacity = useRef(new Animated.Value(1)).current;
  const isZoomed = useRef(false);

  const handleShow = useCallback(() => {
    setCurrentIndex(initialIndex);
    translateY.setValue(0);
    bgOpacity.setValue(1);
    requestAnimationFrame(() => {
      if (initialIndex > 0) {
        flatRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }
    });
  }, [initialIndex]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        !isZoomed.current && gs.dy > 10 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          translateY.setValue(gs.dy);
          bgOpacity.setValue(Math.max(0, 1 - gs.dy / (SH * 0.4)));
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > SH * 0.18 || gs.vy > 0.6) {
          Animated.parallel([
            Animated.timing(translateY, { toValue: SH, duration: 220, useNativeDriver: true }),
            Animated.timing(bgOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
          ]).start(onClose);
        } else {
          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
            Animated.timing(bgOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  const onMomentumScrollEnd = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
    setCurrentIndex(idx);
    isZoomed.current = false;
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onShow={handleShow}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.bg, { opacity: bgOpacity }]}>
        {/* Close */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
        >
          <Feather name="x" size={26} color="#fff" />
        </TouchableOpacity>

        {/* Counter */}
        {urls.length > 1 && (
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {urls.length}
            </Text>
          </View>
        )}

        {/* Pages */}
        <Animated.View
          style={[styles.pagesWrapper, { transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          <FlatList
            ref={flatRef}
            data={urls}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumScrollEnd}
            getItemLayout={(_, i) => ({ length: SW, offset: SW * i, index: i })}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item, index }) => (
              <MediaPage
                url={item}
                type={types[index] ?? "image"}
                isCurrent={index === currentIndex}
                onPlayVideo={(uri) => setVideoPlayerUri(uri)}
              />
            )}
          />
        </Animated.View>
      </Animated.View>

      {/* In-app video player — opens over the viewer */}
      {videoPlayerUri && (
        <VideoPlayer
          uri={videoPlayerUri}
          fullscreen
          autoPlay
          onClose={() => setVideoPlayerUri(null)}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.97)",
  },
  closeBtn: {
    position: "absolute",
    top: 48,
    right: 20,
    zIndex: 20,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 20,
  },
  counter: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 20,
  },
  counterText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pagesWrapper: {
    flex: 1,
  },
  page: {
    width: SW,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  pageImg: {
    width: SW,
    height: SH * 0.75,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  playCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  videoHint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 4,
  },
});
