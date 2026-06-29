import { router } from "@/compat/router";
import React from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import { Badge } from "@/components/ui/Badge";
import { AppButton } from "@/components/ui/AppButton";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

export default function MyBidsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getMyBids } = useData();
  if (!user) return null;
  const bids = getMyBids(user.id);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>My Bids</Text>
        <TouchableOpacity style={[styles.newBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/bid/create")}>
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={bids}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: 40 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="trending-up" size={52} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No bids yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Create a bid to get competing offers from sellers</Text>
            <AppButton title="Create Bid" onPress={() => router.push("/bid/create")} style={styles.emptyBtn} />
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => item.status === "active" ? router.push({ pathname: "/bid/live/[id]", params: { id: item.id } }) : undefined}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.productName, { color: colors.foreground }]}>{item.productName}</Text>
              <Badge label={item.status.toUpperCase()} variant={item.status === "active" ? "warning" : item.status === "ended" && item.winnerId ? "success" : "muted"} />
            </View>
            <Text style={[styles.detail, { color: colors.mutedForeground }]}>Qty: {item.quantity} • Budget: ₹{item.budget}/unit</Text>
            <Text style={[styles.detail, { color: colors.mutedForeground }]}>Offers: {item.offers.length} • Sellers: {item.selectedSellers.length}</Text>
            {item.status === "active" && (
              <View style={[styles.liveRow, { backgroundColor: "#FEF3C7" }]}>
                <Feather name="clock" size={13} color="#D97706" />
                <Text style={{ color: "#92400E", fontSize: 12 }}>Bidding in progress</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: "800" },
  newBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  list: { flexGrow: 1, padding: 16, gap: 12 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center" },
  emptyBtn: { marginTop: 8 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 6 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  productName: { fontSize: 15, fontWeight: "700", flex: 1 },
  detail: { fontSize: 13 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: 8, marginTop: 4 },
});
