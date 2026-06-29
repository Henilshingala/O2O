import { router, useLocalSearchParams } from "@/compat/router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import * as Haptics from "@/compat/haptics";
import { AppButton } from "@/components/ui/AppButton";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

export default function SelectWinnerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getBid, selectWinner, createOrder } = useData();
  const params = useLocalSearchParams<{ id: string }>();
  const bid = getBid(params.id);

  if (!user || !bid) return null;
  const sortedOffers = [...bid.offers].sort((a, b) => a.price - b.price);

  const handleSelect = (offer: typeof bid.offers[0]) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    selectWinner(bid.id, offer.sellerId, offer.channelId);
    const order = createOrder({
      bidId: bid.id,
      buyerId: user.id,
      sellerId: offer.sellerId,
      sellerName: offer.sellerName,
      sellerChannelId: offer.channelId,
      offerPrice: offer.price,
      productName: bid.productName,
      quantity: bid.quantity,
      status: "pending",
    });
    if (order) router.replace({ pathname: "/order/[id]", params: { id: order.id } });
  };

  const handleRejectAll = () => {
    router.replace("/(tabs)");
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Bid Ended</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 }]}>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Select the best offer for {bid.productName}</Text>

        {sortedOffers.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.muted }]}>
            <Feather name="inbox" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No offers received</Text>
          </View>
        ) : (
          sortedOffers.map((offer, idx) => (
            <View key={offer.id} style={[styles.offerCard, { backgroundColor: colors.card, borderColor: idx === 0 ? "#A7F3D0" : colors.border }]}>
              {idx === 0 && (
                <View style={[styles.bestBadge, { backgroundColor: "#D1FAE5" }]}>
                  <Feather name="award" size={13} color="#065F46" />
                  <Text style={[styles.bestText, { color: "#065F46" }]}>Best Price</Text>
                </View>
              )}
              <View style={styles.offerTop}>
                <View style={styles.offerLeft}>
                  <Text style={[styles.offerSeller, { color: colors.foreground }]}>{offer.sellerName}</Text>
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Feather key={s} name="star" size={13} color={s <= Math.round(offer.rating) ? "#F59E0B" : colors.border} />
                    ))}
                    <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>{offer.rating}/5</Text>
                  </View>
                  <Text style={[styles.offerDelivery, { color: colors.mutedForeground }]}>
                    Delivery: {offer.deliveryTime}
                  </Text>
                  {offer.message && (
                    <Text style={[styles.offerMessage, { color: colors.mutedForeground }]} numberOfLines={2}>
                      "{offer.message}"
                    </Text>
                  )}
                </View>
                <View style={styles.offerRight}>
                  <Text style={[styles.offerPrice, { color: idx === 0 ? colors.success : colors.primary }]}>₹{offer.price}</Text>
                  <Text style={[styles.offerUnit, { color: colors.mutedForeground }]}>/unit</Text>
                </View>
              </View>
              <AppButton title="Select This Offer" onPress={() => handleSelect(offer)} variant={idx === 0 ? "primary" : "outline"} size="sm" style={styles.selectBtn} />
            </View>
          ))
        )}

        <TouchableOpacity style={[styles.rejectAll, { borderColor: colors.destructive }]} onPress={handleRejectAll}>
          <Feather name="x-circle" size={16} color={colors.destructive} />
          <Text style={[styles.rejectAllText, { color: colors.destructive }]}>Reject All Offers</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  title: { flex: 1, fontSize: 17, fontWeight: "700" },
  content: { padding: 16, gap: 12 },
  subtitle: { fontSize: 14, marginBottom: 4 },
  emptyCard: { padding: 40, borderRadius: 14, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14 },
  offerCard: { padding: 16, borderRadius: 14, borderWidth: 1.5, gap: 12 },
  bestBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  bestText: { fontSize: 11, fontWeight: "700" },
  offerTop: { flexDirection: "row", justifyContent: "space-between" },
  offerLeft: { flex: 1, gap: 4 },
  offerSeller: { fontSize: 15, fontWeight: "700" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  ratingText: { fontSize: 12, marginLeft: 4 },
  offerDelivery: { fontSize: 12 },
  offerMessage: { fontSize: 12, fontStyle: "italic" },
  offerRight: { alignItems: "flex-end" },
  offerPrice: { fontSize: 22, fontWeight: "900" },
  offerUnit: { fontSize: 11 },
  selectBtn: {},
  rejectAll: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderRadius: 12, padding: 14, marginTop: 8, borderStyle: "dashed" },
  rejectAllText: { fontSize: 14, fontWeight: "700" },
});
