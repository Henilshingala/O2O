import { router } from "@/compat/router";
import React from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import { AppButton } from "@/components/ui/AppButton";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import type { Bid } from "@/types";

export default function SellerBidsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { channels, bids } = useData();

  if (!user) return null;
  const myChannels = channels.filter((c) => c.ownerId === user.id);
  const myChannelIds = myChannels.map((c) => c.id);

  const bidRequests = bids.filter((b) =>
    b.status === "active" && (b.allSellers || b.selectedSellers.some((s) => myChannelIds.includes(s)))
  );

  const formatTimeLeft = (endTime: string) => {
    const ms = new Date(endTime).getTime() - Date.now();
    if (ms <= 0) return "Expired";
    const min = Math.floor(ms / 60000);
    return `${min}m left`;
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Bid Requests</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={bidRequests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: 40 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="inbox" size={52} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No bid requests</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Buyers will send bids to your channels</Text>
          </View>
        }
        renderItem={({ item }) => {
          const myOffer = item.offers.find((o) => myChannelIds.includes(o.channelId));
          const myRejection = item.rejections.find((r) => myChannelIds.includes(r.channelId));
          const myChannelId = myChannels.find((c) => item.selectedSellers.includes(c.id) || item.allSellers)?.id ?? myChannelIds[0];

          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.productName, { color: colors.foreground }]}>{item.productName}</Text>
                <Badge label={formatTimeLeft(item.endTime)} variant={myOffer ? "success" : myRejection ? "muted" : "warning"} />
              </View>
              <View style={styles.details}>
                <Text style={[styles.detailText, { color: colors.mutedForeground }]}>Qty: {item.quantity} units</Text>
                <Text style={[styles.detailText, { color: colors.mutedForeground }]}>Budget: ₹{item.budget}/unit</Text>
                {item.description ? <Text style={[styles.detailText, { color: colors.mutedForeground }]} numberOfLines={2}>{item.description}</Text> : null}
              </View>

              {myOffer && (
                <View style={[styles.myOfferRow, { backgroundColor: "#D1FAE5" }]}>
                  <Feather name="check-circle" size={14} color="#065F46" />
                  <Text style={{ color: "#065F46", fontSize: 13, fontWeight: "600" }}>Your offer: ₹{myOffer.price}</Text>
                </View>
              )}

              {myRejection && (
                <View style={[styles.myOfferRow, { backgroundColor: colors.muted }]}>
                  <Feather name="x-circle" size={14} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>You rejected this bid</Text>
                </View>
              )}

              {!myOffer && !myRejection && (
                <View style={styles.actions}>
                  <AppButton
                    title="Join Bid"
                    size="sm"
                    style={{ flex: 1 }}
                    onPress={() => router.push({ pathname: "/bid/offer/[id]", params: { id: item.id, channelId: myChannelId } })}
                  />
                  <AppButton
                    title="Reject"
                    variant="outline"
                    size="sm"
                    style={{ flex: 1 }}
                    onPress={() => router.push({ pathname: "/bid/reject/[id]", params: { id: item.id, channelId: myChannelId } })}
                  />
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: "800" },
  list: { flexGrow: 1, padding: 16, gap: 12 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center" },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  productName: { fontSize: 16, fontWeight: "700", flex: 1 },
  details: { gap: 4 },
  detailText: { fontSize: 13 },
  myOfferRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 8 },
  actions: { flexDirection: "row", gap: 10 },
});
