/**
 * Wishlist Screen
 * BUG 5 — Renders product image via Expo Image (uses item.image from API)
 * BUG 6 — Tap navigates to the Channel (not product detail)
 * FEATURE 9 — Search bar + filter by product/channel name (debounced 300ms)
 */
import { router } from "@/compat/router";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "@/compat/image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import * as Haptics from "@/compat/haptics";
import { AppButton } from "@/components/ui/AppButton";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import type { WishlistItem } from "@/types";
import { useDebounce } from "@/hooks/useDebounce";

export default function WishlistScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getWishlist, getChannel, toggleWishlist } = useData();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);

  if (!user) return null;
  const wishlist = getWishlist(user.id);

  // Filter client-side on debounced query
  const filteredWishlist = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return wishlist;
    return wishlist.filter(
      (item) =>
        item.productName.toLowerCase().includes(q) ||
        item.channelName.toLowerCase().includes(q)
    );
  }, [wishlist, debouncedQuery]);

  const handleCreateBid = () => {
    if (wishlist.length === 0) return;
    const first = wishlist[0];
    router.push({
      pathname: "/bid/create",
      params: { productName: first.productName, productImage: first.image ?? "" },
    });
  };

  const renderItem = useCallback(
    ({ item }: { item: WishlistItem }) => {
      const channel = getChannel(item.channelId);
      return (
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          // BUG 6: Navigate to Channel, not product detail
          onPress={() =>
            router.push({ pathname: "/channel/[id]", params: { id: item.channelId } })
          }
          activeOpacity={0.85}
        >
          {/* BUG 5: Render product image using Expo Image with fallback */}
          <View style={styles.imageWrapper}>
            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={styles.productImage}
                contentFit="cover"
                placeholder={{ color: colors.muted }}
                transition={200}
              />
            ) : (
              <View style={[styles.productImagePlaceholder, { backgroundColor: colors.muted }]}>
                <Feather name="image" size={26} color={colors.mutedForeground} />
              </View>
            )}
          </View>

          <View style={styles.cardInfo}>
            <Text style={[styles.productName, { color: colors.foreground }]} numberOfLines={1}>
              {item.productName}
            </Text>
            <View style={styles.channelRow}>
              <Feather name="radio" size={12} color={colors.primary} />
              <Text style={[styles.channelName, { color: colors.primary }]} numberOfLines={1}>
                {item.channelName}
              </Text>
            </View>
            <Text style={[styles.price, { color: colors.primary }]}>
              ₹{item.price.toLocaleString("en-IN")}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.removeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (channel) {
                const product = channel.products.find((p) => p.id === item.productId);
                if (product) toggleWishlist(user.id, product, channel);
              }
            }}
          >
            <Feather name="heart" size={20} color={colors.destructive} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [colors, getChannel, toggleWishlist, user.id]
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>My Wishlist</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* FEATURE 9 — Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.searchInput, { backgroundColor: colors.muted }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchText, { color: colors.foreground }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by product or channel name..."
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredWishlist}
        keyExtractor={(item) => `${item.productId}_${item.channelId}`}
        contentContainerStyle={[styles.list, { paddingBottom: wishlist.length > 0 ? 120 : 40 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather
              name={debouncedQuery ? "search" : "heart"}
              size={52}
              color={colors.border}
            />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {debouncedQuery ? "No results found" : "Wishlist is empty"}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {debouncedQuery
                ? `No products or channels matching "${debouncedQuery}"`
                : "Browse channels and heart products to add them here"}
            </Text>
            {!debouncedQuery && (
              <AppButton
                title="Browse Channels"
                onPress={() => router.push("/(tabs)/channels")}
                style={styles.emptyBtn}
              />
            )}
          </View>
        }
        renderItem={renderItem}
      />

      {wishlist.length > 0 && (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          <AppButton
            title="Create Bid for Best Price"
            onPress={handleCreateBid}
            style={{ flex: 1 }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  title: { flex: 1, fontSize: 22, fontWeight: "800", textAlign: "center" },

  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
  },
  searchText: { flex: 1, fontSize: 14 },

  list: { flexGrow: 1, padding: 16, gap: 10 },

  empty: { alignItems: "center", paddingTop: 80, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyBtn: { marginTop: 8 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  imageWrapper: { width: 64, height: 64, borderRadius: 10, overflow: "hidden" },
  productImage: { width: 64, height: 64 },
  productImagePlaceholder: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },

  cardInfo: { flex: 1, gap: 4 },
  productName: { fontSize: 14, fontWeight: "700" },
  channelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  channelName: { fontSize: 12, fontWeight: "600", flex: 1 },
  price: { fontSize: 16, fontWeight: "800" },
  removeBtn: { padding: 4 },

  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
});
