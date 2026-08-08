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
import { useColors } from "@/hooks/useColors";
import { getProductImages, getProductVideoUrls } from "@/lib/productMedia";
import { resolveMediaUrl, getVideoThumbnailUrl } from "@/lib/mediaUrl";
import type { Product } from "@/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ProductMediaViewProps {
  product: Pick<Product, "image" | "images" | "videoUrl" | "videos" | "details"> & { id?: string };
  height?: number;
  showVideo?: boolean;
  fullWidth?: boolean;
}

type MediaItem = {
  url: string;
  type: "image" | "video";
};

export function ProductMediaView({
  product,
  height = 220,
  showVideo = true,
  fullWidth = true,
}: ProductMediaViewProps) {
  const colors = useColors();
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const images = getProductImages(product as Product);
  const videoUrls = showVideo ? getProductVideoUrls(product as Product) : [];

  const media: MediaItem[] = [
    ...images.map((img) => ({ url: img.url, type: "image" as const })),
    ...videoUrls.map((url) => ({ url, type: "video" as const })),
  ];

  const containerWidth = fullWidth ? SCREEN_WIDTH - 32 : 280;

  // ── No media ──────────────────────────────────────────────────────────────
  if (media.length === 0) {
    return (
      <View style={[styles.placeholder, { height, backgroundColor: colors.muted }]}>
        <Feather name="image" size={40} color={colors.mutedForeground} />
      </View>
    );
  }

  const viewerUrls = media.map((m) => resolveMediaUrl(m.url) ?? m.url);
  const viewerTypes = media.map((m) => m.type);

  const openAt = (idx: number) => {
    setViewerIndex(idx);
    setViewerVisible(true);
  };

  const MAX_VISIBLE = 4;
  const displayMedia = media.slice(0, MAX_VISIBLE);
  const extra = media.length - MAX_VISIBLE;

  const renderMediaCell = (idx: number, style: object) => {
    const item = media[idx];
    if (!item) return null;
    const isLast = idx === MAX_VISIBLE - 1 && extra > 0;
    const thumbUri = item.type === "video" ? getVideoThumbnailUrl(item.url) : resolveMediaUrl(item.url);

    return (
      <TouchableOpacity key={idx} style={style} onPress={() => openAt(idx)} activeOpacity={0.85}>
        <Image
          source={{ uri: thumbUri ?? "" }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
        {item.type === "video" && !isLast && (
          <View style={styles.videoOverlaySmall}>
            <Feather name="play-circle" size={32} color="rgba(255,255,255,0.9)" />
          </View>
        )}
        {item.type === "video" && isLast && (
          <View style={styles.videoOverlaySmall}>
            <Feather name="play-circle" size={24} color="rgba(255,255,255,0.5)" />
          </View>
        )}
        {isLast && (
          <View style={styles.extraOverlay}>
            <Text style={styles.extraText}>+{extra}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderLayout = () => {
    if (media.length === 1) {
      return renderMediaCell(0, { width: "100%", height, borderRadius: 12, overflow: "hidden" });
    }

    if (media.length === 2) {
      const half = (containerWidth - 4) / 2;
      return (
        <View style={[styles.row, { height }]}>
          {renderMediaCell(0, { ...styles.cell, width: half, marginRight: 4 })}
          {renderMediaCell(1, { ...styles.cell, width: half })}
        </View>
      );
    }

    if (media.length === 3) {
      const mainW = (containerWidth * 0.66) - 2;
      const subW = (containerWidth * 0.34) - 2;
      return (
        <View style={[styles.row, { height }]}>
          {renderMediaCell(0, { ...styles.cell, width: mainW, marginRight: 4 })}
          <View style={{ width: subW, height, justifyContent: "space-between" }}>
            {renderMediaCell(1, { ...styles.cell, width: subW, height: (height - 4) / 2 })}
            {renderMediaCell(2, { ...styles.cell, width: subW, height: (height - 4) / 2 })}
          </View>
        </View>
      );
    }

    // 4 or more: 2x2 grid
    const halfW = (containerWidth - 4) / 2;
    const halfH = (height - 4) / 2;
    return (
      <View style={[{ height, justifyContent: "space-between" }]}>
        <View style={[styles.row, { height: halfH, marginBottom: 4 }]}>
          {renderMediaCell(0, { ...styles.cell, width: halfW, marginRight: 4 })}
          {renderMediaCell(1, { ...styles.cell, width: halfW })}
        </View>
        <View style={[styles.row, { height: halfH }]}>
          {renderMediaCell(2, { ...styles.cell, width: halfW, marginRight: 4 })}
          {renderMediaCell(3, { ...styles.cell, width: halfW })}
        </View>
      </View>
    );
  };

  return (
    <>
      {renderLayout()}
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
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    height: "100%",
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  extraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  extraText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },
  videoOverlaySmall: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
});
