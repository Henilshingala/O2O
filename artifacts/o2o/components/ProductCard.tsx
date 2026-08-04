/**
 * ProductCard — with FEATURE 7: live stats (wishlist ❤️, bid 🗳️, view 👁️)
 * Subscribes to Socket.IO 'product:stats:update' events.
 * Falls back to React Query refetch every 30 seconds.
 */
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@/compat/vector-icons";
import { router } from "@/compat/router";
import { useColors } from "@/hooks/useColors";
import { getProductPrimaryImage } from "@/lib/productMedia";
import { getSocket } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import type { Channel, Product } from "@/types";

interface ProductCardProps {
  product: Product;
  channel: Channel;
  userId: string;
  userRole: "buyer" | "seller";
  isOwner?: boolean;
  isWishlisted?: boolean;
  onWishlist?: () => void;
  onRepost?: () => void;
}

interface LiveStats {
  wishlistCount: number;
  bidCount: number;
  viewCount: number;
}

export function ProductCard({
  product,
  channel,
  userId,
  userRole,
  isOwner,
  isWishlisted,
  onWishlist,
  onRepost,
}: ProductCardProps) {
  const colors = useColors();
  const queryClient = useQueryClient();

  // Local live stats — initialized from product data
  const [stats, setStats] = useState<LiveStats>({
    wishlistCount: (product as any).wishlistCount ?? product.wishlisted?.length ?? 0,
    bidCount: (product as any).bidCount ?? 0,
    viewCount: product.views ?? 0,
  });

  // FEATURE 7 — subscribe to live stats updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handler = (data: { productId: string } & Partial<LiveStats>) => {
      if (data.productId !== product.id) return;
      setStats((prev) => ({
        wishlistCount: data.wishlistCount ?? prev.wishlistCount,
        bidCount: data.bidCount ?? prev.bidCount,
        viewCount: data.viewCount ?? prev.viewCount,
      }));
    };

    socket.on("product:stats:update", handler);
    return () => { socket.off("product:stats:update", handler); };
  }, [product.id]);

  // Fallback: refetch channel data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    }, 30_000);
    return () => clearInterval(interval);
  }, [queryClient]);

  // Keep stats in sync when product prop updates (after query refetch)
  useEffect(() => {
    setStats({
      wishlistCount: (product as any).wishlistCount ?? product.wishlisted?.length ?? 0,
      bidCount: (product as any).bidCount ?? 0,
      viewCount: product.views ?? 0,
    });
  }, [product.wishlisted?.length, product.views]);

  const imgUri = getProductPrimaryImage(product);

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() =>
        router.push({ pathname: "/product/[id]", params: { id: product.id, channelId: channel.id } })
      }
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        {imgUri ? (
          <Image source={{ uri: imgUri }} style={styles.image} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.muted }]}>
            <Feather name="image" size={40} color={colors.mutedForeground} />
          </View>
        )}
        <TouchableOpacity
          style={[styles.heartBtn, { backgroundColor: isWishlisted ? "#FFF0F0" : "rgba(255,255,255,0.9)" }]}
          onPress={onWishlist}
        >
          <Feather name="heart" size={18} color={isWishlisted ? colors.destructive : colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{product.name}</Text>
        <Text style={[styles.price, { color: colors.primary }]}>₹{product.price.toLocaleString("en-IN")}</Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
          {product.description}
        </Text>

        {product.details && product.details.length > 0 && (
          <View style={styles.details}>
            {product.details.slice(0, 3).map((d) => (
              <Text key={d.name} style={[styles.detail, { color: colors.mutedForeground }]}>
                <Text style={{ fontWeight: "600", color: colors.foreground }}>{d.name}: </Text>
                {d.value}
              </Text>
            ))}
          </View>
        )}

        {/* FEATURE 7 — live stats row */}
        <View style={styles.footer}>
          <View style={styles.stats}>
            <Feather name="eye" size={13} color={colors.mutedForeground} />
            <Text style={[styles.statText, { color: colors.mutedForeground }]}>{stats.viewCount}</Text>
            <Feather name="heart" size={13} color="#E91E63" />
            <Text style={[styles.statText, { color: colors.mutedForeground }]}>{stats.wishlistCount}</Text>
            <Feather name="tag" size={13} color={colors.primary} />
            <Text style={[styles.statText, { color: colors.mutedForeground }]}>{stats.bidCount}</Text>
          </View>
          {isOwner && onRepost && (
            <TouchableOpacity style={[styles.repostBtn, { borderColor: colors.primary }]} onPress={onRepost}>
              <Feather name="refresh-cw" size={13} color={colors.primary} />
              <Text style={[styles.repostText, { color: colors.primary }]}>Repost</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 14 },
  imageContainer: { position: "relative" },
  image: { width: "100%", height: 200 },
  imagePlaceholder: { width: "100%", height: 200, alignItems: "center", justifyContent: "center" },
  heartBtn: {
    position: "absolute", top: 10, right: 10, width: 36, height: 36,
    borderRadius: 18, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  content: { padding: 14 },
  name: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  price: { fontSize: 17, fontWeight: "800", marginBottom: 6 },
  description: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  details: { marginBottom: 10, gap: 2 },
  detail: { fontSize: 12 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stats: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, marginRight: 6 },
  repostBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  repostText: { fontSize: 12, fontWeight: "600" },
});
