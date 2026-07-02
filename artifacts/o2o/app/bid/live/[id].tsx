import { router, useLocalSearchParams } from "@/compat/router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
  Platform,
  ScrollView,
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
import { getSocket } from "@/lib/socket";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { useQueryClient } from "@tanstack/react-query";

function formatCountdown(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const sec = (totalSec % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

export default function LiveBidScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getBid, endBid } = useData();
  const params = useLocalSearchParams<{ id: string }>();
  const [tick, setTick] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !params.id) return;
    socket.emit("join:bid", params.id);
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["bids"] });
    socket.on("bid:offer", refresh);
    socket.on("bid:ended", refresh);
    socket.on("bid:winner", refresh);
    return () => {
      socket.off("bid:offer", refresh);
      socket.off("bid:ended", refresh);
      socket.off("bid:winner", refresh);
      socket.emit("leave:bid", params.id);
    };
  }, [params.id, queryClient]);

  if (!user) return null;
  const bid = getBid(params.id);
  if (!bid) return null;

  const msLeft = new Date(bid.endTime).getTime() - Date.now();
  const isExpired = msLeft <= 0;
  const sortedOffers = [...bid.offers].sort((a, b) => a.price - b.price);
  const bestOffer = sortedOffers[0];
  const prices = bid.offers.map((o) => o.price);
  const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

  const handleEndEarly = () => {
    if (bid.offers.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    endBid(bid.id);
    router.push({ pathname: "/bid/winner/[id]", params: { id: bid.id } });
  };

  const handleTimerEnd = useCallback(() => {
    if (bid.status === "active" && bid.offers.length > 0) {
      router.push({ pathname: "/bid/winner/[id]", params: { id: bid.id } });
    }
  }, [bid]);

  useEffect(() => {
    if (isExpired && bid.status === "active") handleTimerEnd();
  }, [isExpired]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Live Bid</Text>
        <View style={[styles.liveIndicator, { backgroundColor: "#FEE2E2" }]}>
          <View style={[styles.liveDot, { backgroundColor: colors.destructive }]} />
          <Text style={[styles.liveText, { color: colors.destructive }]}>LIVE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 100 }]} showsVerticalScrollIndicator={false}>
        {/* Bid Info */}
        <View style={[styles.bidInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {bid.productImage && (
            <Image source={{ uri: resolveMediaUrl(bid.productImage) }} style={styles.bidImage} resizeMode="cover" />
          )}
          <Text style={[styles.bidProduct, { color: colors.foreground }]}>Product: {bid.productName}</Text>
          <Text style={[styles.bidDetail, { color: colors.mutedForeground }]}>Quantity: {bid.quantity}</Text>
          <Text style={[styles.bidDetail, { color: colors.mutedForeground }]}>Budget: ₹{bid.budget}/unit</Text>
          <Text style={[styles.bidDetail, { color: colors.mutedForeground }]}>Selected Sellers: {bid.selectedSellers.length}</Text>
        </View>

        {/* Timer */}
        <View style={[styles.timerCard, { backgroundColor: isExpired ? "#FEE2E2" : colors.secondary }]}>
          <Feather name="clock" size={22} color={isExpired ? colors.destructive : colors.primary} />
          <Text style={[styles.timerLabel, { color: isExpired ? colors.destructive : colors.mutedForeground }]}>
            {isExpired ? "Bid Ended" : "Time Left"}
          </Text>
          <Text style={[styles.timerValue, { color: isExpired ? colors.destructive : colors.primary }]}>
            {isExpired ? "00:00" : formatCountdown(msLeft)}
          </Text>
        </View>

        {/* Best Offer */}
        {bestOffer && (
          <View style={[styles.bestOffer, { backgroundColor: "#D1FAE5", borderColor: "#A7F3D0" }]}>
            <Text style={[styles.bestOfferLabel, { color: "#065F46" }]}>Best Offer</Text>
            <Text style={[styles.bestOfferValue, { color: "#065F46" }]}>₹{bestOffer.price} by {bestOffer.sellerName}</Text>
          </View>
        )}

        {/* Analytics */}
        <View style={[styles.analyticsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.analyticsTitle, { color: colors.foreground }]}>Bid Analytics</Text>
          <View style={styles.analyticsGrid}>
            <AnalyticItem label="Offers" value={bid.offers.length} colors={colors} />
            {prices.length > 0 && <>
              <AnalyticItem label="Lowest" value={`₹${Math.min(...prices)}`} colors={colors} positive />
              <AnalyticItem label="Highest" value={`₹${Math.max(...prices)}`} colors={colors} />
              <AnalyticItem label="Average" value={`₹${avgPrice}`} colors={colors} />
            </>}
          </View>
        </View>

        {/* Offers List */}
        <Text style={[styles.offersTitle, { color: colors.foreground }]}>Offers Received</Text>
        {sortedOffers.length === 0 ? (
          <View style={[styles.waitingCard, { backgroundColor: colors.muted }]}>
            <Feather name="loader" size={20} color={colors.mutedForeground} />
            <Text style={[styles.waitingText, { color: colors.mutedForeground }]}>Waiting for sellers to respond...</Text>
          </View>
        ) : (
          sortedOffers.map((offer, idx) => (
            <View key={offer.id} style={[styles.offerCard, { backgroundColor: colors.card, borderColor: idx === 0 ? "#A7F3D0" : colors.border }]}>
              <View style={styles.offerRank}>
                <Text style={[styles.offerRankText, { color: idx === 0 ? colors.success : colors.mutedForeground }]}>#{idx + 1}</Text>
              </View>
              <View style={styles.offerInfo}>
                <Text style={[styles.offerSeller, { color: colors.foreground }]}>{offer.sellerName}</Text>
                <View style={styles.offerMeta}>
                  <Feather name="star" size={12} color="#F59E0B" />
                  <Text style={[styles.offerMetaText, { color: colors.mutedForeground }]}>{offer.rating}/5</Text>
                  <Text style={[styles.offerMetaText, { color: colors.mutedForeground }]}>• {offer.deliveryTime}</Text>
                </View>
              </View>
              <Text style={[styles.offerPrice, { color: idx === 0 ? colors.success : colors.foreground }]}>₹{offer.price}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {bid.status === "active" && bid.offers.length > 0 && (
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 12) }]}>
          <AppButton title="View & Select Offers" onPress={handleEndEarly} />
        </View>
      )}
    </View>
  );
}

function AnalyticItem({ label, value, colors, positive }: { label: string; value: string | number; colors: any; positive?: boolean }) {
  return (
    <View style={aiStyles.item}>
      <Text style={[aiStyles.value, { color: positive ? colors.success : colors.foreground }]}>{value}</Text>
      <Text style={[aiStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const aiStyles = StyleSheet.create({
  item: { flex: 1, alignItems: "center", padding: 10 },
  value: { fontSize: 17, fontWeight: "800" },
  label: { fontSize: 11, marginTop: 2 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  title: { flex: 1, fontSize: 17, fontWeight: "700" },
  liveIndicator: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5 },
  liveText: { fontSize: 11, fontWeight: "700" },
  content: { padding: 16, gap: 12 },
  bidInfo: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 4 },
  bidImage: { width: "100%", height: 120, borderRadius: 10, marginBottom: 8 },
  bidProduct: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  bidDetail: { fontSize: 13 },
  timerCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 18, borderRadius: 14 },
  timerLabel: { flex: 1, fontSize: 14 },
  timerValue: { fontSize: 28, fontWeight: "900", letterSpacing: 2 },
  bestOffer: { padding: 16, borderRadius: 14, borderWidth: 1.5 },
  bestOfferLabel: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
  bestOfferValue: { fontSize: 18, fontWeight: "800" },
  analyticsCard: { padding: 16, borderRadius: 14, borderWidth: 1 },
  analyticsTitle: { fontSize: 14, fontWeight: "700", marginBottom: 12 },
  analyticsGrid: { flexDirection: "row" },
  offersTitle: { fontSize: 16, fontWeight: "700", marginTop: 4 },
  waitingCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderRadius: 12 },
  waitingText: { fontSize: 13 },
  offerCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1.5, gap: 10 },
  offerRank: { width: 28, alignItems: "center" },
  offerRankText: { fontSize: 14, fontWeight: "700" },
  offerInfo: { flex: 1 },
  offerSeller: { fontSize: 14, fontWeight: "700" },
  offerMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  offerMetaText: { fontSize: 12 },
  offerPrice: { fontSize: 17, fontWeight: "800" },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
});
