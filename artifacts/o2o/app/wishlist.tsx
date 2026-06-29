import { router } from "@/compat/router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import * as Haptics from "@/compat/haptics";
import { AppButton } from "@/components/ui/AppButton";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import type { WishlistItem } from "@/types";

export default function WishlistScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getWishlist, getChannel, toggleWishlist } = useData();
  const [selectedItems, setSelectedItems] = useState<WishlistItem[]>([]);

  if (!user) return null;
  const wishlist = getWishlist(user.id);

  const grouped: Record<string, WishlistItem[]> = {};
  wishlist.forEach((item) => {
    if (!grouped[item.productName]) grouped[item.productName] = [];
    grouped[item.productName].push(item);
  });

  const handleCreateBid = () => {
    if (wishlist.length === 0) return;
    const first = wishlist[0];
    router.push({
      pathname: "/bid/create",
      params: { productName: first.productName, productImage: first.image ?? "" },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>My Wishlist</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={wishlist}
        keyExtractor={(item) => `${item.productId}_${item.channelId}`}
        contentContainerStyle={[styles.list, { paddingBottom: 120 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="heart" size={52} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Wishlist is empty</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Browse channels and heart products to add them here
            </Text>
            <AppButton title="Browse Channels" onPress={() => router.push("/(tabs)/channels")} style={styles.emptyBtn} />
          </View>
        }
        renderItem={({ item }) => {
          const channel = getChannel(item.channelId);
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: "/product/[id]", params: { id: item.productId, channelId: item.channelId } })}
            >
              <View style={[styles.productImage, { backgroundColor: colors.muted }]}>
                <Feather name="image" size={28} color={colors.mutedForeground} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={[styles.productName, { color: colors.foreground }]} numberOfLines={1}>
                  {item.productName}
                </Text>
                <View style={styles.channelRow}>
                  <Feather name="radio" size={12} color={colors.primary} />
                  <Text style={[styles.channelName, { color: colors.primary }]}>{item.channelName}</Text>
                </View>
                <Text style={[styles.price, { color: colors.primary }]}>
                  ₹{item.price.toLocaleString("en-IN")}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.removeBtn}
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
        }}
      />

      {wishlist.length > 0 && (
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 12) }]}>
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
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: "800", textAlign: "center" },
  list: { flexGrow: 1, padding: 16, gap: 10 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyBtn: { marginTop: 8 },
  card: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, gap: 12 },
  productImage: { width: 64, height: 64, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1, gap: 4 },
  productName: { fontSize: 14, fontWeight: "700" },
  channelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  channelName: { fontSize: 12, fontWeight: "600" },
  price: { fontSize: 16, fontWeight: "800" },
  removeBtn: { padding: 4 },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
});
