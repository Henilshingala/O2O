import { router, useLocalSearchParams } from "@/compat/router";
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

export default function SelectSellersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { channels, createBid } = useData();
  const params = useLocalSearchParams<{
    productName: string; quantity: string; budget: string; description: string; sellerMode: string; productImage?: string;
  }>();

  const sellerChannels = channels.filter((c) => c.ownerId !== user?.id);
  const [selected, setSelected] = useState<string[]>(sellerChannels.map((c) => c.id));
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const toggle = (id: string) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSubmit = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const now = new Date();
      const bid = await createBid({
        buyerId: user.id,
        productName: params.productName,
        productImage: params.productImage || undefined,
        quantity: Number(params.quantity),
        budget: Number(params.budget),
        description: params.description ?? "",
        selectedSellers: selected,
        allSellers: params.sellerMode === "all",
        status: "active",
        startTime: now.toISOString(),
        endTime: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      });
      router.replace({ pathname: "/bid/live/[id]", params: { id: bid.id } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Select Sellers</Text>
        <TouchableOpacity onPress={() => setSelected(sellerChannels.map((c) => c.id))}>
          <Text style={[styles.selectAll, { color: colors.primary }]}>All</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sellerChannels}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="radio" size={48} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No seller channels available</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = selected.includes(item.id);
          return (
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: colors.border }]}
              onPress={() => toggle(item.id)}
            >
              <View style={[styles.avatar, { backgroundColor: "#EFF6FF" }]}>
                <Feather name="radio" size={20} color={colors.primary} />
              </View>
              <View style={styles.info}>
                <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.sub, { color: colors.mutedForeground }]}>{item.followers.length} followers</Text>
              </View>
              <View style={[styles.checkbox, { backgroundColor: isSelected ? colors.primary : "transparent", borderColor: isSelected ? colors.primary : colors.border }]}>
                {isSelected && <Feather name="check" size={14} color="#fff" />}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 12) }]}>
        <Text style={[styles.selectedCount, { color: colors.mutedForeground }]}>Selected: {selected.length} seller{selected.length !== 1 ? "s" : ""}</Text>
        <AppButton title="SUBMIT BID" onPress={handleSubmit} loading={loading} disabled={selected.length === 0} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  title: { flex: 1, fontSize: 17, fontWeight: "700" },
  selectAll: { fontSize: 14, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700" },
  sub: { fontSize: 12, marginTop: 2 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1, gap: 10 },
  selectedCount: { fontSize: 13, textAlign: "center" },
});
