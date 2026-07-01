import { router, useLocalSearchParams } from "@/compat/router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import * as Haptics from "@/compat/haptics";
import { AppButton } from "@/components/ui/AppButton";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

export default function ProductDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getChannel, toggleWishlist, isWishlisted } = useData();
  const params = useLocalSearchParams<{ id: string; channelId: string }>();
  const channel = getChannel(params.channelId);
  const product = channel?.products.find((p) => p.id === params.id);

  if (!user || !product || !channel) return null;
  const wishlisted = isWishlisted(user.id, product.id);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{product.name}</Text>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleWishlist(user.id, product, channel); }}>
          <Feather name="heart" size={22} color={wishlisted ? colors.destructive : colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {(product.image || (product as any).images?.[0]?.url) ? (
          <Image source={{ uri: product.image || (product as any).images[0].url }} style={styles.imagePreview} />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.muted }]}>
            <Feather name="image" size={60} color={colors.mutedForeground} />
            <Text style={[styles.imagePlaceholderText, { color: colors.mutedForeground }]}>Product Image</Text>
          </View>
        )}

        <View style={styles.content}>
          <Text style={[styles.productName, { color: colors.foreground }]}>{product.name}</Text>
          <Text style={[styles.price, { color: colors.primary }]}>₹{product.price.toLocaleString("en-IN")}</Text>

          <View style={[styles.channelRow, { backgroundColor: colors.secondary }]}>
            <Feather name="radio" size={14} color={colors.primary} />
            <Text style={[styles.channelName, { color: colors.primary }]}>{channel.name}</Text>
            <TouchableOpacity onPress={() => router.push({ pathname: "/channel/[id]", params: { id: channel.id } })}>
              <Text style={[styles.viewChannel, { color: colors.mutedForeground }]}>View Channel</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Description</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{product.description}</Text>

          {product.details && product.details.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Details</Text>
              <View style={[styles.detailsTable, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {product.details.map((d, idx) => (
                  <View key={idx} style={[styles.detailRow, { borderBottomColor: colors.border, borderBottomWidth: idx < product.details.length - 1 ? 1 : 0 }]}>
                    <Text style={[styles.detailKey, { color: colors.mutedForeground }]}>{d.name}</Text>
                    <Text style={[styles.detailVal, { color: colors.foreground }]}>{d.value}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={styles.meta}>
            <View style={styles.metaItem}>
              <Feather name="eye" size={14} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{product.views} views</Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="heart" size={14} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{product.wishlisted?.length || 0} wishlisted</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 12) }]}>
        <AppButton
          title={wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
          variant={wishlisted ? "outline" : "primary"}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); toggleWishlist(user.id, product, channel); }}
          style={{ flex: 1 }}
        />
        <TouchableOpacity
          style={[styles.chatBtn, { backgroundColor: colors.secondary }]}
          onPress={() => router.push({ pathname: "/(tabs)/chat" })}
        >
          <Feather name="message-circle" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  title: { flex: 1, fontSize: 16, fontWeight: "700" },
  imagePlaceholder: { height: 280, alignItems: "center", justifyContent: "center", gap: 8 },
  imagePlaceholderText: { fontSize: 13 },
  imagePreview: { width: "100%", height: 320, resizeMode: "cover" },
  content: { padding: 20 },
  productName: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
  price: { fontSize: 24, fontWeight: "900", marginBottom: 14 },
  channelRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, marginBottom: 20 },
  channelName: { flex: 1, fontSize: 13, fontWeight: "600" },
  viewChannel: { fontSize: 12 },
  sectionTitle: { fontSize: 14, fontWeight: "700", marginBottom: 8, marginTop: 4 },
  description: { fontSize: 14, lineHeight: 22, marginBottom: 20 },
  detailsTable: { borderRadius: 12, borderWidth: 1, overflow: "hidden", marginBottom: 20 },
  detailRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12 },
  detailKey: { width: 100, fontSize: 13 },
  detailVal: { flex: 1, fontSize: 13, fontWeight: "600" },
  meta: { flexDirection: "row", gap: 20 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 13 },
  footer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, gap: 10 },
  chatBtn: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
