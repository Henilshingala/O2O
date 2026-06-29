import { router } from "@/compat/router";
import React from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

export default function MyOrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getMyOrders } = useData();
  if (!user) return null;
  const orders = getMyOrders(user.id, user.role);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>My Orders</Text>
        <View style={{ width: 22 }} />
      </View>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: 40 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="package" size={52} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No orders yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Your completed bids will appear here</Text>
          </View>
        }
        renderItem={({ item }) => {
          const statusBadge = { pending: "warning", confirmed: "primary", delivered: "success" }[item.status] as any;
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.id } })}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.productName, { color: colors.foreground }]}>{item.productName}</Text>
                <Badge label={item.status.toUpperCase()} variant={statusBadge} />
              </View>
              <Text style={[styles.sellerName, { color: colors.primary }]}>
                {user.role === "buyer" ? `Seller: ${item.sellerName}` : `Buyer Order`}
              </Text>
              <View style={styles.details}>
                <Text style={[styles.detail, { color: colors.mutedForeground }]}>Qty: {item.quantity}</Text>
                <Text style={[styles.detail, { color: colors.mutedForeground }]}>₹{item.offerPrice}/unit</Text>
                <Text style={[styles.detail, { color: colors.mutedForeground }]}>Total: ₹{(item.offerPrice * item.quantity).toLocaleString()}</Text>
              </View>
              <View style={styles.chatRow}>
                <Feather name="message-circle" size={14} color={colors.primary} />
                <Text style={[styles.chatText, { color: colors.primary }]}>Open Order Chat</Text>
              </View>
            </TouchableOpacity>
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
  card: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 8 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  productName: { fontSize: 15, fontWeight: "700", flex: 1 },
  sellerName: { fontSize: 13, fontWeight: "600" },
  details: { flexDirection: "row", gap: 12 },
  detail: { fontSize: 13 },
  chatRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  chatText: { fontSize: 13, fontWeight: "600" },
});
