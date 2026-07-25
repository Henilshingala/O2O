/**
 * VideoPlayer — Complete custom player
 *
 * BLACK SCREEN FIX: The container must NOT have overflow:hidden or borderRadius
 * directly wrapping the Video component on Android. The native SurfaceView/
 * TextureView gets OS-level clipped and renders nothing (audio still works).
 *
 * SEEK BAR FIX: Uses Animated.Value in pixel-space (0→trackWidth) so the
 * fill and thumb update smoothly. PanResponder captures pageX on layout so
 * no async measure() calls are needed during touch events.
 *
 * Controls: Close · Mute · Speed · Previous · -10s · Play/Pause · +10s · Next
 *           Progress bar with thumb · Time · Fullscreen
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Video from "react-native-video";
import { Feather } from "@/compat/vector-icons";
import { useColors } from "@/hooks/useColors";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SKIP = 10; // seconds
const THUMB_R = 8; // thumb radius px

function fmt(sec: number) {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export interface VideoPlayerProps {
  uri: string;
  fullscreen?: boolean;
  autoPlay?: boolean;
  title?: string;
  style?: object;
  onClose?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function VideoPlayer({
  uri,
  fullscreen,
  autoPlay = false,
  title,
  style,
  onClose,
  onPrevious,
  onNext,
}: VideoPlayerProps) {
  const colors = useColors();
  const videoRef = useRef<any>(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [paused, setPaused] = useState(!autoPlay);
  const [muted, setMuted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(fullscreen ?? false);
  const [isSeeking, setIsSeeking] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const durationRef = useRef(0);
  const currentTimeRef = useRef(0);
  const trackWidthRef = useRef(0);
  const trackPageXRef = useRef(0); // absolute X on screen — captured on layout
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  // Animated pixel position of the playhead (0 → trackWidth)
  const headPx = useRef(new Animated.Value(0)).current;

  // ── Controls visibility ────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3500);
  }, []);

  const toggleControls = useCallback(() => {
    setControlsVisible((v) => {
      if (v) clearTimeout(hideTimer.current);
      else {
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setControlsVisible(false), 3500);
      }
      return !v;
    });
  }, []);

  // ── Sync headPx with currentTime (skip while user is dragging) ─────────────
  useEffect(() => {
    if (isSeeking || durationRef.current <= 0 || trackWidthRef.current <= 0) return;
    const px = (currentTime / durationRef.current) * trackWidthRef.current;
    headPx.setValue(Math.max(0, Math.min(trackWidthRef.current, px)));
  }, [currentTime, isSeeking]);

  // ── Video callbacks ────────────────────────────────────────────────────────
  const handleLoad = (data: any) => {
    const dur = data.duration ?? 0;
    setDuration(dur);
    durationRef.current = dur;
    setLoading(false);
    showControls();
  };

  const handleProgress = (data: any) => {
    const t = data.currentTime ?? 0;
    currentTimeRef.current = t;
    if (!isSeeking) setCurrentTime(t);
    if (!paused && data.playableDuration != null) {
      setBuffering(data.playableDuration <= t + 0.5);
    }
  };

  const handleEnd = () => {
    setEnded(true);
    setPaused(true);
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
  };

  // ── Seek helpers ───────────────────────────────────────────────────────────
  const seekTo = useCallback((sec: number) => {
    const clamped = Math.max(0, Math.min(durationRef.current, sec));
    videoRef.current?.seek(clamped);
    currentTimeRef.current = clamped;
    setCurrentTime(clamped);
    if (durationRef.current > 0 && trackWidthRef.current > 0) {
      headPx.setValue((clamped / durationRef.current) * trackWidthRef.current);
    }
    if (ended && clamped < durationRef.current) {
      setEnded(false);
      setPaused(false);
    }
  }, [ended]);

  const seekToRef = useRef(seekTo);
  seekToRef.current = seekTo;

  const skip = useCallback((delta: number) => {
    seekToRef.current(currentTimeRef.current + delta);
    showControls();
  }, [showControls]);

  const replay = useCallback(() => {
    seekToRef.current(0);
    setEnded(false);
    setPaused(false);
    showControls();
  }, [showControls]);

  // ── Seek bar — PanResponder ────────────────────────────────────────────────
  // We capture the track's screen X once on layout so touch math is O(1)
  const seekTrackRef = useRef<View>(null);

  const measureTrack = useCallback(() => {
    seekTrackRef.current?.measure((_fx, _fy, w, _h, px) => {
      trackWidthRef.current = w;
      trackPageXRef.current = px;
    });
  }, []);

  const seekPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        setIsSeeking(true);
        const x = Math.max(0, Math.min(trackWidthRef.current, e.nativeEvent.pageX - trackPageXRef.current));
        headPx.setValue(x);
        const dur = durationRef.current;
        if (dur > 0) {
          const t = (x / trackWidthRef.current) * dur;
          currentTimeRef.current = t;
          setCurrentTime(t);
        }
      },
      onPanResponderMove: (e) => {
        const x = Math.max(0, Math.min(trackWidthRef.current, e.nativeEvent.pageX - trackPageXRef.current));
        headPx.setValue(x);
        const dur = durationRef.current;
        if (dur > 0) {
          const t = (x / trackWidthRef.current) * dur;
          currentTimeRef.current = t;
          setCurrentTime(t);
        }
      },
      onPanResponderRelease: () => {
        const t = currentTimeRef.current;
        videoRef.current?.seek(t);
        if (durationRef.current > 0 && t >= durationRef.current - 0.1) {
          setEnded(true);
          setPaused(true);
        } else if (ended) {
          setEnded(false);
          setPaused(false);
        }
        setIsSeeking(false);
        showControls();
      },
    })
  ).current;

  // ── Render ─────────────────────────────────────────────────────────────────
  const progress = durationRef.current > 0 ? currentTime / durationRef.current : 0;

  const controls = controlsVisible && !loading ? (
    <View style={styles.controlsLayer} pointerEvents="box-none">

      {/* ── Top bar ─────────────────────────────────────────── */}
      <View style={styles.topBar}>
        {(onClose || isFullscreen) && (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => { isFullscreen && !fullscreen ? setIsFullscreen(false) : onClose?.(); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        {title ? (
          <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {/* Mute */}
        <TouchableOpacity style={styles.iconBtn} onPress={() => setMuted((m) => !m)}>
          <Feather name={muted ? "volume-x" : "volume-2"} size={20} color="#fff" />
        </TouchableOpacity>
        {/* Speed */}
        <TouchableOpacity style={styles.speedChip} onPress={() => setShowSpeed((v) => !v)}>
          <Text style={styles.speedChipText}>{speed}×</Text>
        </TouchableOpacity>
      </View>

      {/* Speed picker */}
      {showSpeed && (
        <View style={styles.speedPicker}>
          {SPEEDS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.speedRow, speed === s && styles.speedRowActive]}
              onPress={() => { setSpeed(s); setShowSpeed(false); showControls(); }}
            >
              <Text style={[styles.speedRowText, speed === s && { fontWeight: "800" }]}>{s}×</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Centre controls ──────────────────────────────────── */}
      <View style={styles.centreRow} pointerEvents="box-none">
        {onPrevious && (
          <TouchableOpacity style={styles.ctrlBtn} onPress={onPrevious}>
            <Feather name="skip-back" size={26} color="#fff" />
          </TouchableOpacity>
        )}

        {/* -10s */}
        <TouchableOpacity style={styles.ctrlBtn} onPress={() => skip(-SKIP)}>
          <Feather name="rotate-ccw" size={24} color="#fff" />
          <Text style={styles.skipLabel}>{SKIP}s</Text>
        </TouchableOpacity>

        {/* Play / Pause / Replay */}
        <TouchableOpacity
          style={styles.playBtn}
          onPress={ended ? replay : () => { setPaused((p) => !p); showControls(); }}
        >
          <Feather
            name={ended ? "rotate-ccw" : paused ? "play" : "pause"}
            size={36}
            color="#fff"
          />
        </TouchableOpacity>

        {/* +10s */}
        <TouchableOpacity style={styles.ctrlBtn} onPress={() => skip(SKIP)}>
          <Feather name="rotate-cw" size={24} color="#fff" />
          <Text style={styles.skipLabel}>{SKIP}s</Text>
        </TouchableOpacity>

        {onNext && (
          <TouchableOpacity style={styles.ctrlBtn} onPress={onNext}>
            <Feather name="skip-forward" size={26} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Bottom bar ──────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        <Text style={styles.timeText}>{fmt(currentTime)}</Text>

        {/* Seek track */}
        <View
          ref={seekTrackRef}
          style={styles.seekTrack}
          onLayout={measureTrack}
          {...seekPan.panHandlers}
        >
          {/* Background rail */}
          <View style={styles.seekRail} />
          {/* Buffered / filled */}
          <Animated.View style={[styles.seekFill, { width: headPx }]} />
          {/* Thumb */}
          <Animated.View
            style={[
              styles.seekThumb,
              { transform: [{ translateX: Animated.subtract(headPx, THUMB_R) }] },
            ]}
          />
        </View>

        <Text style={styles.timeText}>{fmt(duration)}</Text>
      </View>
    </View>
  ) : null;

  // ── Player shell ───────────────────────────────────────────────────────────
  // IMPORTANT: The Video component's immediate parent must NOT have
  // overflow:hidden or borderRadius — it clips the native video surface on Android.
  const shell = (
    <View
      style={[
        styles.shell,
        isFullscreen ? styles.shellFullscreen : style,
      ]}
    >
      {/* Video — fills parent absolutely */}
      <Video
        ref={videoRef}
        source={{ uri }}
        style={StyleSheet.absoluteFillObject}
        paused={paused}
        muted={muted}
        rate={speed}
        resizeMode="contain"
        onLoad={handleLoad}
        onProgress={handleProgress}
        onEnd={handleEnd}
        onBuffer={({ isBuffering }: { isBuffering: boolean }) => setBuffering(isBuffering)}
        onError={() => { setLoading(false); setBuffering(false); }}
        progressUpdateInterval={250}
        repeat={false}
        useTextureView={Platform.OS === "android"}
        ignoreSilentSwitch="ignore"
      />

      {/* Tap area — controls toggle */}
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        onPress={toggleControls}
        activeOpacity={1}
      />

      {/* Spinners */}
      {(loading || (buffering && !loading)) && (
        <View style={styles.spinnerOverlay} pointerEvents="none">
          <ActivityIndicator color="#fff" size="large" />
          {loading && <Text style={styles.loadingLabel}>Loading…</Text>}
        </View>
      )}

      {controls}
    </View>
  );

  if (isFullscreen) {
    return (
      <Modal
        visible
        animationType="fade"
        transparent={false}
        statusBarTranslucent
        supportedOrientations={["portrait", "landscape"]}
        onRequestClose={() => { setIsFullscreen(false); if (fullscreen) onClose?.(); }}
      >
        <StatusBar hidden />
        <View style={styles.fullscreenBg}>{shell}</View>
      </Modal>
    );
  }

  // Inline: wrap in a rounded clipping container OUTSIDE the video layer
  return (
    <View style={[styles.inlineWrapper, style]}>
      {shell}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get("window");

const styles = StyleSheet.create({
  // Outer wrapper — has borderRadius & overflow:hidden for visual rounding
  // but it does NOT clip the Video because Video is in `shell` (a sibling layer
  // approach via absolute fill of the wrapper).
  inlineWrapper: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: "hidden",   // safe here: Video is in shell which fills this
    backgroundColor: "#000",
  },

  // The shell has NO overflow:hidden / borderRadius so the native video surface
  // initialises correctly. It fills the inlineWrapper via absoluteFillObject.
  shell: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  shellFullscreen: {
    flex: 1,
  },

  fullscreenBg: {
    flex: 1,
    backgroundColor: "#000",
  },

  // ── Overlays ────────────────────────────────────────────────────────────────
  spinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  loadingLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    marginTop: 8,
  },

  // ── Controls layer ──────────────────────────────────────────────────────────
  controlsLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.38)",
    justifyContent: "space-between",
  },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
  },
  titleText: {
    flex: 1,
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginHorizontal: 4,
  },
  iconBtn: {
    padding: 6,
  },
  speedChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  speedChipText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  // Speed picker
  speedPicker: {
    position: "absolute",
    top: 46,
    right: 12,
    backgroundColor: "rgba(20,20,20,0.92)",
    borderRadius: 10,
    overflow: "hidden",
    zIndex: 30,
    minWidth: 80,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  speedRow: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    alignItems: "center",
  },
  speedRowActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  speedRowText: {
    color: "#fff",
    fontSize: 14,
  },

  // Centre controls
  centreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 52,
    height: 52,
    gap: 2,
  },
  skipLabel: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  timeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    minWidth: 34,
    textAlign: "center",
  },

  // Seek bar
  seekTrack: {
    flex: 1,
    height: 28,           // tall for easy touch target
    justifyContent: "center",
  },
  seekRail: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  seekFill: {
    position: "absolute",
    left: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#fff",
  },
  seekThumb: {
    position: "absolute",
    top: (28 - THUMB_R * 2) / 2,
    width: THUMB_R * 2,
    height: THUMB_R * 2,
    borderRadius: THUMB_R,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 5,
  },
});
