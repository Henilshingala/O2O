/**
 * ProductMediaView — WhatsApp-style product media grid
 *
 * Layout:
 *  0 images + video → in-app VideoPlayer
 *  1 image          → full-width single image
 *  2 images         → side-by-side 50/50
 *  3 images         → one large left + two stacked right
 *  4 images         → 2×2 grid
 *  5+ images        → 2×2 grid with +N overlay on last cell
 *
 * Tap any item:
 *  - Image → full-screen MediaViewer
 *  - Video → full-screen in-app VideoPlayer
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
import { MediaViewer } from "@/components/MediaViewer";
import { VideoPlayer } from "@/components/VideoPlayer";
import { useColors } from "@/hooks/useColors";
import { getProductImages, getProductVideoUrl } from "@/lib/productMedia";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import type { Product } from "@/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ProductMediaViewProps {
  product: Pick<Product, "image" | "images" | "videoUrl" | "details">;
  height?: number;
  showVideo?: boolean;
  fullWidth?: boolean;
}

export function ProductMediaView({
  product,
  height = 220,
  showVideo = true,
  fullWidth = true,
}: ProductMediaViewProps) {
  const colors = useColors();
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [videoVisible, setVideoVisible] = useState(false);

  const images = getProductImages(product as Product);
  const videoUrl = showVideo ? getProductVideoUrl(product as Product) : undefined;

  const containerWidth = fullWidth ? SCREEN_WIDTH - 32 : 280;

  // ── Video-only product ────────────────────────────────────────────────────
  if (videoUrl && showVideo && images.length === 0) {
    const resolved = resolveMediaUrl(videoUrl) ?? videoUrl;
    return (
      <>
        <TouchableOpacity
          style={[styles.videoThumb, { height, backgroundColor: colors.muted }]}
          onPress={() => setVideoVisible(true)}
          activeOpacity={0.85}
        >
          <View style={[styles.playCircle, { backgroundColor: colors.primary + "dd" }]}>
            <Feather name="play" size={28} color="#fff" />
          </View>
          <Text style={[styles.videoLabel, { color: colors.foreground }]}>Tap to play</Text>
        </TouchableOpacity>
        {videoVisible && (
          <VideoPlayer
            uri={resolved}
            fullscreen
            autoPlay
            onClose={() => setVideoVisible(false)}
          />
        )}
      </>
    );
  }

  // ── No media ──────────────────────────────────────────────────────────────
  if (images.length === 0) {
    return (
      <View style={[styles.placeholder, { height, backgroundColor: colors.muted }]}>
        <Feather name="image" size={40} color={colors.mutedForeground} />
      </View>
    );
  }

  const imageUrls = images.map((img) => resolveMediaUrl(img.url));
  // If there's a video, include it as first item in the viewer URLs
  const viewerUrls = videoUrl
    ? [resolveMediaUrl(videoUrl) ?? videoUrl, ...imageUrls]
    : imageUrls;
  const viewerTypes: ("image" | "video")[] = videoUrl
    ? ["video", ...imageUrls.map(() => "image" as const)]
    : imageUrls.map(() => "image" as const);

  const openAt = (idx: number) => {
    // idx is index in imageUrls; if there's a video, offset by 1 in viewer
    setViewerIndex(videoUrl ? idx + 1 : idx);
    setViewerVisible(true);
  };

  const MAX_VISIBLE = 4;
  const displayImages = images.slice(0, MAX_VISIBLE);
  const extra = images.length - MAX_VISIBLE;

  const renderImage = (idx: number, style: object) => {
    const img = images[idx];
    if (!img) return null;
    const isLast = idx === MAX_VISIBLE - 1 && extra > 0;
    return (
      <TouchableOpacity key={idx} style={style} onPress={() => openAt(idx)} activeOpacity={0.85}>
        <Image
          source={{ uri: resolveMediaUrl(img.url) }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
        {isLast && (
          <View style={styles.extraOverlay}>
            <Text style={styles.extraText}>+{extra}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── 1 image ───────────────────────────────────────────────────────────────
  if (images.length === 1 && !videoUrl) {
    return (
      <>
        <TouchableOpacity onPress={() => openAt(0)} activeOpacity={0.85}>
          <Image
            source={{ uri: resolveMediaUrl(images[0].url) }}
            style={{ width: "100%", height, borderRadius: 12 }}
            resizeMode="cover"
          />
        </TouchableOpacity>
        <MediaViewer
          visible={viewerVisible}
          urls={viewerUrls}
          types={viewerTypes}
          initialIndex={viewerIndex}
          onClose={() => setViewerVisible(false)}
        />
      </>
    );
  }

  // ── 1 image + video ───────────────────────────────────────────────────────
  if (images.length === 1 && videoUrl) {
    const resolved = resolveMediaUrl(videoUrl) ?? videoUrl;
    const half = (containerWidth - 4) / 2;
    return (
      <>
        <View style={[styles.row, { height }]}>
          {/* Video thumbnail */}
          <TouchableOpacity
            style={[styles.cell, { width: half, marginRight: 4 }]}
            onPress={() => setVideoVisible(true)}
            activeOpacity={0.85}
          >
            <Image
              source={{ uri: resolveMediaUrl(images[0].url) }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
            <View style={styles.videoOverlaySmall}>
              <Feather name="play-circle" size={32} color="rgba(255,255,255,0.9)" />
            </View>
          </TouchableOpacity>
          {/* Image */}
          {renderImage(0, { ...styles.cell, width: half })}
        </View>
        {videoVisible && (
          <VideoPlayer
            uri={resolved}
            fullscreen
            autoPlay
            onClose={() => setVideoVisible(false)}
          />
        )}
        <MediaViewer
          visible={viewerVisible}
          urls={viewerUrls}
          types={viewerTypes}
          initialIndex={viewerIndex}
          onClose={() => setViewerVisible(false)}
        />
      </>
    );
  }

  // ── 2 images ──────────────────────────────────────────────────────────────
  if (images.length === 2) {
    const half = (containerWidth - 4) / 2;
    return (
      <>
        <View style={[styles.row, { height }]}>
          {renderImage(0, { ...styles.cell, width: half, marginRight: 4 })}
          {renderImage(1, { ...styles.cell, width: half })}
        </View>
        <MediaViewer
          visible={viewerVisible}
          urls={viewerUrls}
          types={viewerTypes}
          initialIndex={viewerIndex}
          onClose={() => setViewerVisible(false)}
        />
      </>
    );
  }

  // ── 3 images ──────────────────────────────────────────────────────────────
  if (images.length === 3) {
    const bigW = containerWidth * 0.6 - 2;
    const smallW = containerWidth * 0.4 - 2;
    const smallH = (height - 4) / 2;
    return (
      <>
        <View style={[styles.row, { height }]}>
          {renderImage(0, { ...styles.cell, width: bigW, marginRight: 4 })}
          <View style={{ width: smallW, gap: 4 }}>
            {renderImage(1, { ...styles.cell, height: smallH })}
            {renderImage(2, { ...styles.cell, height: smallH })}
          </View>
        </View>
        <MediaViewer
          visible={viewerVisible}
          urls={viewerUrls}
          types={viewerTypes}
          initialIndex={viewerIndex}
          onClose={() => setViewerVisible(false)}
        />
      </>
    );
  }

  // ── 4+ images: 2×2 grid ───────────────────────────────────────────────────
  const half = (containerWidth - 4) / 2;
  const cellH = (height - 4) / 2;
  return (
    <>
      <View style={{ gap: 4 }}>
        <View style={[styles.row, { height: cellH }]}>
          {renderImage(0, { ...styles.cell, width: half, marginRight: 4 })}
          {renderImage(1, { ...styles.cell, width: half })}
        </View>
        <View style={[styles.row, { height: cellH }]}>
          {renderImage(2, { ...styles.cell, width: half, marginRight: 4 })}
          {renderImage(3, { ...styles.cell, width: half })}
        </View>
      </View>
      <MediaViewer
        visible={viewerVisible}
        urls={viewerUrls}
        types={viewerTypes}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  videoThumb: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  playCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  videoLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 12,
  },
  cell: {
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#1a1a1a",
    position: "relative",
  },
  extraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  extraText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },
  videoOverlaySmall: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
});
