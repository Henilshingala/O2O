import { router } from "@/compat/router";
import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import { Badge } from "@/components/ui/Badge";
import { AppButton } from "@/components/ui/AppButton";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import type { Bid } from "@/types";

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
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, alignSelf: "flex-start" },
  text: { fontSize: 13, fontWeight: "700" },
});

export default function MyBidsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getMyBids } = useData();

  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!user) return null;
  const bids = getMyBids(user.id);

  const activeBids = bids.filter(b => !TERMINAL_STATUSES.includes(b.status));
  const historyBids = bids.filter(b => TERMINAL_STATUSES.includes(b.status));

  const formatTimeLeft = (endTime: string) => {
    const ms = new Date(endTime).getTime() - Date.now();
    if (ms <= 0) return "Ending soon";
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${min}m ${sec}s left`;
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>My Bids</Text>
        <TouchableOpacity style={[styles.newBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/bid/create")}>
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="trending-up" size={52} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No active bids</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Create a bid to get competing offers from sellers</Text>
              <AppButton title="Create Bid" onPress={() => router.push("/bid/create")} style={styles.emptyBtn} />
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: "/bid/live/[id]", params: { id: item.id } })}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.productName, { color: colors.foreground }]}>{item.productName}</Text>
                <Badge label={formatTimeLeft(item.endTime)} variant="warning" />
              </View>
              <Text style={[styles.detail, { color: colors.mutedForeground }]}>Qty: {item.quantity} • Budget: ₹{item.budget}/unit</Text>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={[styles.detail, { color: colors.mutedForeground }]}>Offers: {item.offers.length} • Sellers: {item.selectedSellers.length}</Text>
                {item.offers.length > 0 && (
                  <View style={{ backgroundColor: colors.destructive, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{item.offers.length} New</Text>
                  </View>
                )}
              </View>
              <View style={[styles.liveRow, { backgroundColor: "#FEF3C7" }]}>
                <Feather name="clock" size={13} color="#D97706" />
                <Text style={{ color: "#92400E", fontSize: 12 }}>Bidding in progress...</Text>
              </View>
            </TouchableOpacity>
          )}
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
                  <Text style={[styles.productName, { color: colors.foreground }]}>{item.productName}</Text>
                  <BidStatusChip status={item.status} />
                </View>
                <View style={styles.historyDetails}>
                  <Text style={[styles.detail, { color: colors.mutedForeground }]}>Code: {item.id.slice(0, 8).toUpperCase()}</Text>
                  {winnerOffer && (
                    <Text style={[styles.detail, { color: colors.mutedForeground }]}>Winning Amount: ₹{winnerOffer.price}</Text>
                  )}
                  {winnerOffer && (
                    <Text style={[styles.detail, { color: colors.mutedForeground }]}>Winner: {winnerOffer.sellerName}</Text>
                  )}
                  <Text style={[styles.detail, { color: colors.mutedForeground, marginTop: 4 }]}>
                    Ended: {new Date(item.endTime).toLocaleString()}
                  </Text>
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
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: "800" },
  newBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabLabel: { fontSize: 14, fontWeight: "700" },
  list: { flexGrow: 1, padding: 16, gap: 12 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center" },
  emptyBtn: { marginTop: 8 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 6 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  productName: { fontSize: 16, fontWeight: "700", flex: 1 },
  detail: { fontSize: 13 },
  historyDetails: { gap: 4, marginTop: 4 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: 8, marginTop: 4 },
});
