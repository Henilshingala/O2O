/**
 * MediaAlbum — WhatsApp-style media grid bubble
 *
 * Layouts:
 *  1  → full square preview
 *  2  → side by side
 *  3  → 1 large left + 2 stacked right
 *  4+ → 2×2 grid; bottom-right tile shows "+N" overlay for remainder
 *
 * Tapping any tile opens MediaViewer (full-screen, swipeable, zoom, drag-to-close).
 */
import React, { useState } from "react";
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@/compat/vector-icons";
import { useColors } from "@/hooks/useColors";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { MediaViewer } from "@/components/MediaViewer";

const { width: SCREEN_W } = Dimensions.get("window");
const ALBUM_W = Math.min(SCREEN_W * 0.75, 280);
const GAP = 2;

interface MediaAlbumProps {
  urls: string[];
  types: ("image" | "video")[];
}

function MediaCell({
  url,
  type,
  width,
  height,
  onPress,
  overlay,
}: {
  url: string;
  type: "image" | "video";
  width: number;
  height: number;
  onPress: () => void;
  overlay?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{ width, height, position: "relative", overflow: "hidden" }}
    >
      <Image
        source={{ uri: resolveMediaUrl(url) }}
        style={{ width, height }}
        resizeMode="cover"
      />
      {type === "video" && !overlay && (
        <View style={styles.videoOverlay}>
          <Feather name="play-circle" size={28} color="rgba(255,255,255,0.9)" />
        </View>
      )}
      {overlay}
    </TouchableOpacity>
  );
}

export function MediaAlbum({ urls, types }: MediaAlbumProps) {
  const colors = useColors();
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const count = urls.length;

  let cells: React.ReactNode;

  if (count === 1) {
    cells = (
      <MediaCell
        url={urls[0]}
        type={types[0]}
        width={ALBUM_W}
        height={ALBUM_W}
        onPress={() => setViewerIdx(0)}
      />
    );
  } else if (count === 2) {
    const w = (ALBUM_W - GAP) / 2;
    cells = (
      <View style={{ flexDirection: "row", gap: GAP }}>
        {urls.map((url, i) => (
          <MediaCell
            key={i}
            url={url}
            type={types[i]}
            width={w}
            height={ALBUM_W * 0.75}
            onPress={() => setViewerIdx(i)}
          />
        ))}
      </View>
    );
  } else if (count === 3) {
    const leftW = ALBUM_W * 0.6;
    const rightW = ALBUM_W - leftW - GAP;
    const h = ALBUM_W * 0.75;
    cells = (
      <View style={{ flexDirection: "row", gap: GAP }}>
        <MediaCell url={urls[0]} type={types[0]} width={leftW} height={h} onPress={() => setViewerIdx(0)} />
        <View style={{ flexDirection: "column", gap: GAP }}>
          {[1, 2].map((i) => (
            <MediaCell
              key={i}
              url={urls[i]}
              type={types[i]}
              width={rightW}
              height={(h - GAP) / 2}
              onPress={() => setViewerIdx(i)}
            />
          ))}
        </View>
      </View>
    );
  } else {
    // 4+ — show first 4 in 2×2, +X on 4th tile
    const cellW = (ALBUM_W - GAP) / 2;
    const cellH = cellW;
    const remainder = count - 4;
    cells = (
      <View>
        <View style={{ flexDirection: "row", gap: GAP, marginBottom: GAP }}>
          {[0, 1].map((i) => (
            <MediaCell key={i} url={urls[i]} type={types[i]} width={cellW} height={cellH} onPress={() => setViewerIdx(i)} />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: GAP }}>
          {[2, 3].map((i) => (
            <MediaCell
              key={i}
              url={urls[i]}
              type={types[i]}
              width={cellW}
              height={cellH}
              onPress={() => setViewerIdx(i)}
              overlay={
                i === 3 && remainder > 0 ? (
                  <View style={styles.moreOverlay}>
                    <Text style={styles.moreText}>+{remainder}</Text>
                  </View>
                ) : undefined
              }
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <>
      <View style={[styles.container, { borderRadius: 14, overflow: "hidden", borderColor: colors.border, borderWidth: 1 }]}>
        {cells}
      </View>

      <MediaViewer
        visible={viewerIdx !== null}
        urls={urls}
        types={types}
        initialIndex={viewerIdx ?? 0}
        onClose={() => setViewerIdx(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {},
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  moreText: { color: "#fff", fontSize: 22, fontWeight: "800" },
});
