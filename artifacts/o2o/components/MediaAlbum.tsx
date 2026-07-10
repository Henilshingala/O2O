import React, { useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@/compat/vector-icons";
import { useColors } from "@/hooks/useColors";
import { resolveMediaUrl } from "@/lib/mediaUrl";

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
  const resolvedUrl = resolveMediaUrl(url);
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{ width, height, position: "relative", overflow: "hidden" }}
    >
      <Image
        source={{ uri: resolvedUrl }}
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
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const count = urls.length;

  // Layout computation
  let cells: React.ReactNode;

  if (count === 1) {
    cells = (
      <MediaCell
        url={urls[0]}
        type={types[0]}
        width={ALBUM_W}
        height={ALBUM_W}
        onPress={() => setLightboxIdx(0)}
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
            onPress={() => setLightboxIdx(i)}
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
        <MediaCell
          url={urls[0]}
          type={types[0]}
          width={leftW}
          height={h}
          onPress={() => setLightboxIdx(0)}
        />
        <View style={{ flexDirection: "column", gap: GAP }}>
          {[1, 2].map((i) => (
            <MediaCell
              key={i}
              url={urls[i]}
              type={types[i]}
              width={rightW}
              height={(h - GAP) / 2}
              onPress={() => setLightboxIdx(i)}
            />
          ))}
        </View>
      </View>
    );
  } else {
    // 4 or more — show first 4 in 2×2, +X overlay on 4th
    const cellW = (ALBUM_W - GAP) / 2;
    const cellH = cellW;
    const showCount = count > 4 ? count - 4 : 0;
    cells = (
      <View>
        <View style={{ flexDirection: "row", gap: GAP, marginBottom: GAP }}>
          {[0, 1].map((i) => (
            <MediaCell
              key={i}
              url={urls[i]}
              type={types[i]}
              width={cellW}
              height={cellH}
              onPress={() => setLightboxIdx(i)}
            />
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
              onPress={() => setLightboxIdx(i)}
              overlay={
                i === 3 && showCount > 0 ? (
                  <View style={styles.moreOverlay}>
                    <Text style={styles.moreText}>+{showCount}</Text>
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
      <View
        style={[
          styles.container,
          { borderRadius: 14, overflow: "hidden", borderColor: colors.border, borderWidth: 1 },
        ]}
      >
        {cells}
      </View>

      {/* Lightbox */}
      <Modal
        visible={lightboxIdx !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setLightboxIdx(null)}
      >
        <View style={styles.lightboxBg}>
          <TouchableOpacity
            style={styles.lightboxClose}
            onPress={() => setLightboxIdx(null)}
          >
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (lightboxIdx ?? 0) * SCREEN_W, y: 0 }}
          >
            {urls.map((url, i) => (
              <View key={i} style={styles.lightboxPage}>
                <Image
                  source={{ uri: resolveMediaUrl(url) }}
                  style={styles.lightboxImg}
                  resizeMode="contain"
                />
                {types[i] === "video" && (
                  <View style={styles.lightboxVideoOverlay}>
                    <Feather name="play-circle" size={56} color="rgba(255,255,255,0.9)" />
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          <View style={styles.lightboxCounter}>
            <Text style={styles.counterText}>
              {(lightboxIdx ?? 0) + 1} / {urls.length}
            </Text>
          </View>
        </View>
      </Modal>
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
  moreText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },
  lightboxBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
  },
  lightboxClose: {
    position: "absolute",
    top: 48,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  lightboxPage: {
    width: SCREEN_W,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxImg: {
    width: SCREEN_W,
    height: SCREEN_W,
  },
  lightboxVideoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxCounter: {
    position: "absolute",
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  counterText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
});
