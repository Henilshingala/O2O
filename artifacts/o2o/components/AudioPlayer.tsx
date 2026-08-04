/**
 * AudioPlayer — Professional in-app audio player
 *
 * BUG 9 FIX: Layout redesigned so the info row is:
 *   [timestamp]  [waveform center]  [speed button]
 *   All on one flex row — no overlap.
 *
 * Sent bubble:    #2e7d32 background, white text/icons
 * Received bubble: #e0e0e0 background, dark text/icons
 *
 * File name displayed below the row in smaller grey text.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Sound from "react-native-sound";
import { Feather } from "@/compat/vector-icons";
import { useColors } from "@/hooks/useColors";

Sound.setCategory("Playback");

const SPEEDS = [1, 1.5, 2];

function formatTime(seconds: number) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface AudioPlayerProps {
  uri: string;
  fileName?: string;
  /** Hint duration string displayed before loading completes */
  duration?: string;
  isMine?: boolean;
  onLongPress?: () => void;
}

export function AudioPlayer({
  uri,
  fileName,
  duration: hintDuration,
  isMine,
  onLongPress,
}: AudioPlayerProps) {
  const colors = useColors();
  const soundRef = useRef<Sound | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0); // cycles through SPEEDS
  const speed = SPEEDS[speedIdx];

  // Colour tokens
  const bubbleBg = isMine ? "#2e7d32" : "#e0e0e0";
  const iconColor = isMine ? "#fff" : "#212121";
  const mutedColor = isMine ? "rgba(255,255,255,0.72)" : "#757575";
  const barColor = isMine ? "rgba(255,255,255,0.9)" : "#2e7d32";
  const barInactive = isMine ? "rgba(255,255,255,0.3)" : "#bdbdbd";
  const trackBg = isMine ? "rgba(255,255,255,0.25)" : "#bdbdbd";
  const speedBg = isMine ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.08)";

  useEffect(() => {
    let cancelled = false;
    const snd = new Sound(uri, "", (error) => {
      if (cancelled) { snd?.release(); return; }
      if (error) { setStatus("error"); return; }
      soundRef.current = snd;
      setDuration(snd.getDuration());
      setStatus("ready");
    });
    return () => {
      cancelled = true;
      clearInterval(intervalRef.current);
      soundRef.current?.stop();
      soundRef.current?.release();
      soundRef.current = null;
    };
  }, [uri]);

  const startPolling = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      soundRef.current?.getCurrentTime((seconds, isPlaying) => {
        setCurrentTime(seconds);
        if (!isPlaying) {
          setPlaying(false);
          clearInterval(intervalRef.current);
          const dur = soundRef.current?.getDuration() ?? Infinity;
          if (seconds >= dur - 0.15) {
            setCurrentTime(0);
            soundRef.current?.setCurrentTime(0);
          }
        }
      });
    }, 200);
  }, []);

  const togglePlay = () => {
    if (!soundRef.current || status !== "ready") return;
    if (playing) {
      soundRef.current.pause();
      setPlaying(false);
      clearInterval(intervalRef.current);
    } else {
      soundRef.current.setSpeed(speed);
      soundRef.current.play(() => {
        setPlaying(false);
        clearInterval(intervalRef.current);
      });
      setPlaying(true);
      startPolling();
    }
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (soundRef.current) soundRef.current.setSpeed(SPEEDS[next]);
  };

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  // Deterministic waveform bars from uri hash
  const barHeights = Array.from({ length: 24 }, (_, i) => {
    const seed = (uri.charCodeAt(i % Math.max(uri.length, 1)) * 31 + i * 7) % 100;
    return 4 + (seed % 22);
  });

  const timeLabel =
    playing || currentTime > 0
      ? formatTime(currentTime)
      : hintDuration ?? formatTime(duration);

  const shortName = fileName ? String(fileName).split("/").pop() ?? "Voice message" : "Voice message";

  return (
    <TouchableOpacity
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={1}
      style={[styles.container, { backgroundColor: bubbleBg }]}
    >
      {/* Play / Pause button */}
      <TouchableOpacity
        style={[styles.playCircle, { backgroundColor: isMine ? "rgba(255,255,255,0.2)" : "rgba(46,125,50,0.12)" }]}
        onPress={togglePlay}
        disabled={status === "loading"}
      >
        {status === "loading" ? (
          <Feather name="loader" size={18} color={iconColor} />
        ) : status === "error" ? (
          <Feather name="alert-circle" size={18} color={iconColor} />
        ) : playing ? (
          <Feather name="pause" size={18} color={iconColor} />
        ) : (
          <Feather name="play" size={18} color={iconColor} />
        )}
      </TouchableOpacity>

      {/* Right side: waveform + seek + info row */}
      <View style={styles.rightSection}>
        {/* Waveform */}
        <View style={styles.waveform}>
          {barHeights.map((h, i) => {
            const filled = i / barHeights.length <= progress;
            return (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  { height: h, backgroundColor: filled ? barColor : barInactive },
                ]}
              />
            );
          })}
        </View>

        {/* Seek track */}
        <View style={[styles.seekTrack, { backgroundColor: trackBg }]}>
          <View style={[styles.seekFill, { flex: progress, backgroundColor: barColor }]} />
          <View style={{ flex: Math.max(0, 1 - progress) }} />
        </View>

        {/* BUG 9 FIX: info row — timestamp LEFT, speed button RIGHT, space-between */}
        <View style={styles.infoRow}>
          {/* Left: timestamp */}
          <Text style={[styles.timeText, { color: mutedColor }]}>{timeLabel}</Text>

          {/* Right: speed toggle */}
          <TouchableOpacity
            onPress={cycleSpeed}
            style={[styles.speedBtn, { backgroundColor: speedBg }]}
          >
            <Text style={[styles.speedBtnText, { color: isMine ? "#fff" : "#2e7d32" }]}>
              {speed}×
            </Text>
          </TouchableOpacity>
        </View>

        {/* File name beneath */}
        <Text style={[styles.fileName, { color: mutedColor }]} numberOfLines={1}>
          {shortName}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    minWidth: 220,
    maxWidth: 300,
  },
  playCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rightSection: {
    flex: 1,
    gap: 4,
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 26,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  seekTrack: {
    height: 3,
    borderRadius: 2,
    flexDirection: "row",
    overflow: "hidden",
  },
  seekFill: {
    borderRadius: 2,
  },
  // BUG 9: space-between so timestamp is left, speed is right — no overlap
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeText: {
    fontSize: 11,
    fontWeight: "600",
    minWidth: 36,
  },
  speedBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  speedBtnText: {
    fontSize: 11,
    fontWeight: "800",
  },
  fileName: {
    fontSize: 10,
    marginTop: 1,
  },
});
