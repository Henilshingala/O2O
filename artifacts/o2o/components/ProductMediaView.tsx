import React, { useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@/compat/vector-icons";
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
  const [activeIndex, setActiveIndex] = useState(0);

  const images = getProductImages(product as Product);
  const videoUrl = showVideo ? getProductVideoUrl(product as Product) : undefined;
  const slideWidth = fullWidth ? SCREEN_WIDTH - 32 : 280;

  if (videoUrl && showVideo) {
    const resolved = resolveMediaUrl(videoUrl) ?? videoUrl;
    if (Platform.OS === "web") {
      return (
        <View style={[styles.videoContainer, { height }]}>
          <video
            src={resolved}
            controls
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 } as React.CSSProperties}
          />
        </View>
      );
    }
    return (
      <View style={[styles.videoContainer, { height, backgroundColor: colors.muted }]}>
        <TouchableOpacity style={styles.videoPlayBtn} onPress={() => { if (resolved) Linking.openURL(resolved).catch(() => {}); }}>
          <Feather name="play-circle" size={48} color={colors.primary} />
          <Text style={{ color: colors.foreground, marginTop: 8 }}>Play Video</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (images.length === 0) {
    return (
      <View style={[styles.placeholder, { height, backgroundColor: colors.muted }]}>
        <Feather name="image" size={40} color={colors.mutedForeground} />
      </View>
    );
  }

  if (images.length === 1) {
    return (
      <Image
        source={{ uri: resolveMediaUrl(images[0].url) }}
        style={{ width: "100%", height, borderRadius: 12 }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / slideWidth));
        }}
      >
        {images.map((img, idx) => (
          <Image
            key={img.id ?? idx}
            source={{ uri: resolveMediaUrl(img.url) }}
            style={{ width: slideWidth, height, borderRadius: 12 }}
            resizeMode="cover"
          />
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {images.map((img, idx) => (
          <View
            key={img.id ?? idx}
            style={[styles.dot, { backgroundColor: idx === activeIndex ? colors.primary : colors.border }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { width: "100%", alignItems: "center", justifyContent: "center", borderRadius: 12 },
  videoContainer: { width: "100%", borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  videoPlayBtn: { alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
