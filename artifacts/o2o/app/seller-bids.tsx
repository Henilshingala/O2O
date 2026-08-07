/**
 * Seller Bids / Bid Requests screen
 * BUG 7 — Accept button only shown when bid.status === 'ended' AND winner is current seller.
 *         All other terminal statuses show a styled status chip.
 */
import { router } from "@/compat/router";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import { AppButton } from "@/components/ui/AppButton";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import type { Bid } from "@/types";

// Statuses that mean the bid is no longer actionable
const TERMINAL_STATUSES: any[] = [
  "accepted",
  "closed",
  "expired",
  "completed",
  "cancelled",
  "ended",
];

function BidStatusChip({ status }: { status: Bid["status"] }) {
  const chipMap: Record<string, { label: string; bg: string; color: string }> = {
    accepted: { label: "Accepted", bg: "#D1FAE5", color: "#065F46" },
    completed: { label: "Completed", bg: "#D1FAE5", color: "#065F46" },
    closed: { label: "Closed", bg: "#F3F4F6", color: "#6B7280" },
    expired: { label: "Expired", bg: "#FEE2E2", color: "#991B1B" },
    cancelled: { label: "Cancelled", bg: "#FEE2E2", color: "#991B1B" },
    ended: { label: "Ended", bg: "#F3F4F6", color: "#6B7280" },
  };
  const chip = chipMap[status] ?? { label: status, bg: "#F3F4F6", color: "#6B7280" };
  return (
    <View style={[chipStyles.chip, { backgroundColor: chip.bg }]}>
      <Text style={[chipStyles.text, { color: chip.color }]}>{chip.label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  text: { fontSize: 13, fontWeight: "700" },
});


export default function SellerBidsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { channels, bids, orders, acceptBid } = useData();

  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!user) return null;

  const myChannels = channels.filter((c) => c.ownerId === user.id);
  const myChannelIds = myChannels.map((c) => c.id);

  const allBidRequests = bids.filter(
    (b) => b.allSellers || b.selectedSellers.some((s) => myChannelIds.includes(s))
  );

  const activeBids = allBidRequests.filter((b) => !TERMINAL_STATUSES.includes(b.status));
  const historyBids = allBidRequests.filter((b) => TERMINAL_STATUSES.includes(b.status));

  // Bids this seller won and must accept to create order.
  // Must check if order has NOT been created yet.
  const wonBids = allBidRequests.filter(
    (b) => b.status === "ended" && b.winnerId === user.id && !orders.some(o => o.bidId === b.id)
  );

  const formatTimeLeft = (endTime: string) => {
    const ms = new Date(endTime).getTime() - Date.now();
    if (ms <= 0) return "Expired";
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${min}m ${sec}s left`;
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 8 },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Bid Requests</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "active" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab("active")}
        >
          <Text style={[styles.tabLabel, { color: activeTab === "active" ? colors.primary : colors.mutedForeground }]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "history" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab("history")}
        >
          <Text style={[styles.tabLabel, { color: activeTab === "history" ? colors.primary : colors.mutedForeground }]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "active" ? (
        <FlatList
          data={activeBids}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: 40 }]}
          ListHeaderComponent={
            wonBids.length > 0 ? (
              <View style={{ marginBottom: 16, gap: 10 }}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Bids You Won — Accept to Create Order
                </Text>
                {wonBids.map((item) => (
                  <View
                    key={item.id}
                    style={[styles.card, { backgroundColor: "#D1FAE5", borderColor: "#A7F3D0" }]}
                  >
                    <Text style={[styles.productName, { color: "#065F46" }]}>{item.productName}</Text>
                    <AppButton
                      title="ACCEPT & CREATE ORDER"
                      size="sm"
                      onPress={async () => {
                        const result = await acceptBid(item.id);
                        if (result.order?.id) {
                          router.push({ pathname: "/order/[id]", params: { id: result.order.id } });
                        }
                      }}
                    />
                  </View>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={52} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No active requests</Text>
            </View>
          }
          renderItem={({ item }) => {
            const myOffer = item.offers.find((o) => myChannelIds.includes(o.channelId));
            const myRejection = item.rejections?.find((r) => myChannelIds.includes(r.channelId));
            const myChannelId =
              myChannels.find((c) => item.selectedSellers.includes(c.id) || item.allSellers)?.id ??
              myChannelIds[0];

            return (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.productName, { color: colors.foreground }]}>
                    {item.productName}
                  </Text>
                  <Badge
                    label={formatTimeLeft(item.endTime)}
                    variant={myOffer ? "success" : myRejection ? "muted" : "warning"}
                  />
                </View>

                <View style={styles.details}>
                  <Text style={[styles.detailText, { color: colors.mutedForeground }]}>
                    Qty: {item.quantity} units
                  </Text>
                  {(item as any).unitType && (
                    <Text style={[styles.detailText, { color: colors.mutedForeground }]}>
                      Unit: {(item as any).unitType}
                    </Text>
                  )}
                  {item.description ? (
                    <Text
                      style={[styles.detailText, { color: colors.mutedForeground }]}
                      numberOfLines={2}
                    >
                      {item.description}
                    </Text>
                  ) : null}
                </View>

                {myOffer && (
                  <View style={[styles.myOfferRow, { backgroundColor: "#D1FAE5" }]}>
                    <Feather name="check-circle" size={14} color="#065F46" />
                    <Text style={{ color: "#065F46", fontSize: 13, fontWeight: "600" }}>
                      Your offer: ₹{myOffer.price}
                    </Text>
                  </View>
                )}

                {myRejection && (
                  <View style={[styles.myOfferRow, { backgroundColor: colors.muted }]}>
                    <Feather name="x-circle" size={14} color={colors.mutedForeground} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                      You rejected this bid
                    </Text>
                  </View>
                )}

                {!myOffer && !myRejection && (
                  <View style={styles.actions}>
                    <AppButton
                      title="Join Bid"
                      size="sm"
                      style={{ flex: 1 }}
                      onPress={() =>
                        router.push({
                          pathname: "/bid/offer/[id]",
                          params: { id: item.id, channelId: myChannelId },
                        })
                      }
                    />
                    <AppButton
                      title="Reject"
                      variant="outline"
                      size="sm"
                      style={{ flex: 1 }}
                      onPress={() =>
                        router.push({
                          pathname: "/bid/reject/[id]",
                          params: { id: item.id, channelId: myChannelId },
                        })
                      }
                    />
                  </View>
                )}

                {myOffer && (
                  <AppButton
                    title="Update Offer"
                    variant="outline"
                    size="sm"
                    onPress={() =>
                      router.push({
                        pathname: "/bid/offer/[id]",
                        params: { id: item.id, channelId: myChannelId },
                      })
                    }
                  />
                )}
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={historyBids}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: 40 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="clock" size={52} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No history</Text>
            </View>
          }
          renderItem={({ item }) => {
            const winnerOffer = item.offers.find((o) => o.sellerId === item.winnerId);
            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: "/bid/details/[id]", params: { id: item.id } })}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.productName, { color: colors.foreground }]}>
                    {item.productName}
                  </Text>
                  <BidStatusChip status={item.status} />
                </View>

                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                    {item.productImage ? (
                      <Image source={{ uri: item.productImage }} style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: colors.muted }} />
                    ) : (
                      <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
                        <Feather name="image" size={24} color={colors.mutedForeground} />
                      </View>
                    )}
                    <View style={styles.historyDetails}>
                      <Text style={[styles.detailText, { color: colors.mutedForeground }]}>
                        Code: {item.id.slice(0, 8).toUpperCase()}
                      </Text>
                      {winnerOffer && (
                        <Text style={[styles.detailText, { color: colors.mutedForeground }]}>
                          Winning Amount: ₹{winnerOffer.price}
                        </Text>
                      )}
                      {winnerOffer && (
                        <Text style={[styles.detailText, { color: colors.mutedForeground }]}>
                          Winner: {winnerOffer.sellerName}
                        </Text>
                      )}
                      <Text style={[styles.detailText, { color: colors.mutedForeground, marginTop: 4 }]}>
                        Ended: {new Date(item.endTime).toLocaleString()}
                      </Text>
                    </View>
                  </View>
              </TouchableOpacity>
            );
          }}
        />
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
  title: { flex: 1, fontSize: 22, fontWeight: "800" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabLabel: { fontSize: 14, fontWeight: "700" },
  list: { flexGrow: 1, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center" },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 10 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  productName: { fontSize: 16, fontWeight: "700", flex: 1 },
  details: { gap: 4 },
  historyDetails: { gap: 4, marginTop: 4 },
  detailText: { fontSize: 13 },
  myOfferRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
  },
  actions: { flexDirection: "row", gap: 10 },
});
