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
  height = 260,
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
      return (
        <View style={{ width: "100%", height, borderRadius: 10, overflow: "hidden" }}>
          {renderMediaCell(0, { flex: 1, width: "100%", height: "100%" })}
        </View>
      );
    }

    if (media.length === 2) {
      return (
        <View style={{ flexDirection: "row", gap: 4, width: "100%", height, borderRadius: 10, overflow: "hidden" }}>
          {renderMediaCell(0, styles.flexCell)}
          {renderMediaCell(1, styles.flexCell)}
        </View>
      );
    }

    if (media.length === 3) {
      return (
        <View style={{ flexDirection: "row", gap: 4, width: "100%", height, borderRadius: 10, overflow: "hidden" }}>
          {renderMediaCell(0, { ...styles.flexCell, flex: 2 })}
          <View style={{ flex: 1, gap: 4, height: "100%" }}>
            {renderMediaCell(1, styles.flexCell)}
            {renderMediaCell(2, styles.flexCell)}
          </View>
        </View>
      );
    }

    // 4 or more: 2x2 grid
    return (
      <View style={{ gap: 4, width: "100%", height, borderRadius: 10, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", gap: 4, flex: 1 }}>
          {renderMediaCell(0, styles.flexCell)}
          {renderMediaCell(1, styles.flexCell)}
        </View>
        <View style={{ flexDirection: "row", gap: 4, flex: 1 }}>
          {renderMediaCell(2, styles.flexCell)}
          {renderMediaCell(3, styles.flexCell)}
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
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  flexCell: {
    flex: 1,
    height: "100%",
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000",
  },
  extraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  extraText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  videoOverlaySmall: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
});
