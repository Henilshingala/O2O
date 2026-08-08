import { useLocalSearchParams, router } from "@/compat/router";
import React, { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ProductMediaView } from "@/components/ProductMediaView";
import type { Bid, Product } from "@/types";

export default function BidDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getBid, getChannel, orders } = useData();
  const { user } = useAuth();

  const bid = getBid(id);

  if (!bid) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>Bid not found.</Text>
      </View>
    );
  }

  // Find associated order
  const order = orders.find(o => o.bidId === bid.id);

  // Safe arrays
  const safeOffers = bid.offers || [];
  const safeSellers = bid.selectedSellers || [];

  const winnerOffer = bid.winnerId ? safeOffers.find((o) => o.sellerId === bid.winnerId) : undefined;
  
  const isSeller = user?.role === "seller";
  
  // Format timeline events
  const timeline = useMemo(() => {
    const events = [];
    events.push({ title: "Bid Created", time: new Date(bid.createdAt || bid.startTime || Date.now()).toLocaleString(), icon: "plus-circle", color: colors.primary });
    if (safeOffers.length > 0) {
      events.push({ title: `${safeOffers.length} Participants Joined`, time: new Date(safeOffers[0].timestamp || Date.now()).toLocaleString(), icon: "users", color: "#3B82F6" });
    }
    if (bid.status === "ended" || bid.status === "accepted" || (bid.status as string) === "completed") {
      events.push({ title: "Bid Ended", time: new Date(bid.endTime || Date.now()).toLocaleString(), icon: "clock", color: "#F59E0B" });
    }
    if (bid.winnerId) {
      events.push({ title: "Winner Selected", time: new Date(bid.endTime || Date.now()).toLocaleString(), icon: "award", color: "#10B981" });
    }
    if (order) {
      events.push({ title: "Order Created", time: new Date(order.createdAt).toLocaleString(), icon: "package", color: "#8B5CF6" });
    }
    if (bid.status === "cancelled") {
      events.push({ title: "Bid Cancelled", time: new Date(bid.endTime || Date.now()).toLocaleString(), icon: "x-circle", color: "#EF4444" });
    }
    return events;
  }, [bid, order, colors]);

  const getStatusChip = (status: Bid["status"]) => {
    const chipMap: Record<string, { label: string; bg: string; color: string }> = {
      accepted: { label: "Accepted", bg: "#D1FAE5", color: "#065F46" },
      completed: { label: "Completed", bg: "#D1FAE5", color: "#065F46" },
      closed: { label: "Closed", bg: "#F3F4F6", color: "#6B7280" },
      expired: { label: "Expired", bg: "#FEE2E2", color: "#991B1B" },
      cancelled: { label: "Cancelled", bg: "#FEE2E2", color: "#991B1B" },
      ended: { label: "Ended", bg: "#F3F4F6", color: "#6B7280" },
      active: { label: "Active", bg: "#FEF3C7", color: "#92400E" },
    };
    return chipMap[status] ?? { label: status, bg: "#F3F4F6", color: "#6B7280" };
  };

  const statusChip = getStatusChip(bid.status);
  
  // Sort offers by price ascending (lowest price = rank 1)
  const sortedOffers = [...safeOffers].sort((a, b) => a.price - b.price);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Bid Details</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status & Basic Info */}
        <View style={styles.heroSection}>
          <View style={styles.heroRow}>
            <Text style={[styles.productName, { color: colors.foreground }]}>{bid.productName}</Text>
            <View style={[styles.statusChip, { backgroundColor: statusChip.bg }]}>
              <Text style={[styles.statusText, { color: statusChip.color }]}>{statusChip.label}</Text>
            </View>
          </View>
          <Text style={[styles.bidCode, { color: colors.mutedForeground }]}>BID-{bid.id.slice(0, 8).toUpperCase()}</Text>
        </View>

        {/* Product Info Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Product Details</Text>
          <View style={styles.divider} />
          <View style={{ marginBottom: 12 }}>
            <ProductMediaView 
              product={{
                id: bid.id,
                image: bid.productImage ?? "",
                images: bid.mediaImages?.map((url, i) => ({ id: `${bid.id}_img_${i}`, url, isPrimary: i === 0 })) ?? [],
                videoUrl: bid.mediaVideos?.[0] ?? "",
                videos: bid.mediaVideos ?? [],
                details: [],
              } as unknown as Product}
              height={220}
              showVideo={true}
            />
          </View>
          
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>Quantity</Text>
              <Text style={[styles.gridValue, { color: colors.foreground }]}>{bid.quantity}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>Unit Type</Text>
              <Text style={[styles.gridValue, { color: colors.foreground, textTransform: 'capitalize' }]}>{bid.unitType}</Text>
            </View>
          </View>
          {!!bid.description && (
            <View style={styles.infoRow}>
              <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>Description</Text>
              <Text style={[styles.gridValue, { color: colors.foreground, marginTop: 4 }]}>{bid.description}</Text>
            </View>
          )}
        </View>

        {/* Bid Information Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Bid Information</Text>
          <View style={styles.divider} />
          
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>Starting Price</Text>
              <Text style={[styles.gridValue, { color: colors.foreground }]}>₹{bid.budget}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>Winning Price</Text>
              <Text style={[styles.gridValue, { color: winnerOffer ? "#10B981" : colors.foreground }]}>
                {winnerOffer ? `₹${winnerOffer.price}` : "—"}
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>Participants</Text>
              <Text style={[styles.gridValue, { color: colors.foreground }]}>{safeSellers.length > 0 ? safeSellers.length : "Open to All"}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>Offers Received</Text>
              <Text style={[styles.gridValue, { color: colors.foreground }]}>{safeOffers.length}</Text>
            </View>
          </View>

          <View style={[styles.timeContainer, { backgroundColor: colors.muted }]}>
            <View style={styles.timeRow}>
              <Feather name="calendar" size={14} color={colors.mutedForeground} />
              <Text style={[styles.timeText, { color: colors.mutedForeground }]}>Start: {new Date(bid.startTime || Date.now()).toLocaleString()}</Text>
            </View>
            <View style={styles.timeRow}>
              <Feather name="flag" size={14} color={colors.mutedForeground} />
              <Text style={[styles.timeText, { color: colors.mutedForeground }]}>End: {new Date(bid.endTime || Date.now()).toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Participants */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Participants ({sortedOffers.length})</Text>
          <View style={styles.divider} />
          
          {sortedOffers.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, textAlign: "center", paddingVertical: 12 }}>No offers received.</Text>
          ) : (
            <View style={styles.participantsList}>
              {sortedOffers.map((offer, index) => {
                const isWinner = offer.sellerId === bid.winnerId;
                return (
                  <View key={offer.id} style={[styles.participantRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.participantRank}>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "700" }}>#{index + 1}</Text>
                    </View>
                    <Avatar name={offer.sellerName} size={40} />
                    <View style={styles.participantInfo}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[styles.participantName, { color: colors.foreground }]}>{offer.sellerName}</Text>
                        {isWinner && <Feather name="award" size={14} color="#10B981" />}
                      </View>
                      <Text style={[styles.participantTime, { color: colors.mutedForeground }]}>
                        {offer.timestamp ? new Date(offer.timestamp).toLocaleTimeString() : "—"}
                      </Text>
                    </View>
                    <View style={styles.participantPrice}>
                      <Text style={[styles.priceText, { color: isWinner ? "#10B981" : colors.foreground }]}>
                        ₹{offer.price}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Timeline */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Activity Timeline</Text>
          <View style={styles.divider} />
          
          <View style={styles.timeline}>
            {timeline.map((event, index) => (
              <View key={index} style={styles.timelineEvent}>
                <View style={styles.timelineIconContainer}>
                  <View style={[styles.timelineLine, { backgroundColor: index === timeline.length - 1 ? 'transparent' : colors.border }]} />
                  <View style={[styles.timelineIconWrapper, { backgroundColor: event.color + '20' }]}>
                    <Feather name={event.icon as any} size={16} color={event.color} />
                  </View>
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineTitle, { color: colors.foreground }]}>{event.title}</Text>
                  <Text style={[styles.timelineTime, { color: colors.mutedForeground }]}>{event.time}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerRight: { width: 40 },
  scroll: { padding: 16, gap: 16, paddingBottom: 40 },
  
  heroSection: { paddingVertical: 8, paddingHorizontal: 4 },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  productName: { fontSize: 24, fontWeight: "800", flex: 1 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  bidCode: { fontSize: 14, marginTop: 4, fontWeight: "600" },

  card: { borderRadius: 16, borderWidth: 1, padding: 16, overflow: "hidden" },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 12, opacity: 0.5 },
  
  productImage: { width: "100%", height: 160, borderRadius: 12, marginBottom: 16 },
  placeholderImage: { width: "100%", height: 160, borderRadius: 12, marginBottom: 16, alignItems: "center", justifyContent: "center" },
  
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -8 },
  gridItem: { width: "50%", padding: 8, marginBottom: 4 },
  gridLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", marginBottom: 4 },
  gridValue: { fontSize: 16, fontWeight: "700" },
  infoRow: { marginTop: 8, paddingHorizontal: 8 },

  timeContainer: { marginTop: 12, padding: 12, borderRadius: 12, gap: 8 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeText: { fontSize: 13, fontWeight: "500" },

  participantsList: { gap: 12 },
  participantRow: { flexDirection: "row", alignItems: "center", paddingBottom: 12, gap: 12 },
  participantRank: { width: 24, alignItems: "center" },
  participantInfo: { flex: 1, gap: 2 },
  participantName: { fontSize: 15, fontWeight: "600" },
  participantTime: { fontSize: 12 },
  participantPrice: { alignItems: "flex-end" },
  priceText: { fontSize: 16, fontWeight: "800" },

  timeline: { paddingLeft: 8 },
  timelineEvent: { flexDirection: "row", minHeight: 60 },
  timelineIconContainer: { width: 40, alignItems: "center", position: "relative" },
  timelineLine: { position: "absolute", top: 32, bottom: -16, width: 2, zIndex: 0 },
  timelineIconWrapper: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", zIndex: 1 },
  timelineContent: { flex: 1, paddingLeft: 12, paddingTop: 4 },
  timelineTitle: { fontSize: 15, fontWeight: "700" },
  timelineTime: { fontSize: 13, marginTop: 4 },
});
