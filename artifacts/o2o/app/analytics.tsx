import { router } from "@/compat/router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

function StatCard({ label, value, icon, color, colors }: { label: string; value: string | number; icon: string; color?: string; colors: any }) {
  return (
    <View style={[scStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[scStyles.iconBox, { backgroundColor: color ? `${color}22` : colors.muted }]}>
        <Feather name={icon as any} size={20} color={color ?? colors.primary} />
      </View>
      <Text style={[scStyles.value, { color: color ?? colors.foreground }]}>{value}</Text>
      <Text style={[scStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const scStyles = StyleSheet.create({
  card: { flex: 1, minWidth: "45%", padding: 16, borderRadius: 14, borderWidth: 1, alignItems: "center", gap: 6 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  value: { fontSize: 22, fontWeight: "800" },
  label: { fontSize: 11, textAlign: "center" },
});

export default function AnalyticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { channels } = useData();

  if (!user || user.role !== "seller") return null;
  const myChannels = channels.filter((c) => c.ownerId === user.id);
  const channelIds = myChannels.map((c) => c.id);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["analytics", channelIds],
    queryFn: async () => {
      return await customFetch<any>("/api/analytics", {
        method: "POST",
        body: JSON.stringify({ channelIds })
      });
    }
  });

  if (isLoading || !stats) return <View style={[styles.root, { backgroundColor: colors.background }]}><Text>Loading...</Text></View>;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Bid Analytics</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }} showsVerticalScrollIndicator={false}>
        <View style={styles.statsGrid}>
          <StatCard label="Active Bids" value={stats.activeBids} icon="trending-up" color={colors.primary} colors={colors} />
          <StatCard label="Total Offers" value={stats.totalOffers} icon="send" colors={colors} />
          <StatCard label="Winning Rate" value={`${stats.winningRate}%`} icon="award" color={colors.success} colors={colors} />
          <StatCard label="Channel Rating" value={stats.rating > 0 ? `${stats.rating}/5` : "N/A"} icon="star" color="#F59E0B" colors={colors} />
        </View>

        {stats.totalOffers > 0 && (
          <View style={[styles.priceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Offer Pricing</Text>
            <View style={styles.priceRow}>
              <View style={styles.priceItem}>
                <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Average Price</Text>
                <Text style={[styles.priceValue, { color: colors.foreground }]}>₹{stats.avgPrice}</Text>
              </View>
              <View style={styles.priceDivider} />
              <View style={styles.priceItem}>
                <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Lowest Offer</Text>
                <Text style={[styles.priceValue, { color: colors.success }]}>₹{stats.lowestOffer}</Text>
              </View>
              <View style={styles.priceDivider} />
              <View style={styles.priceItem}>
                <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Highest Offer</Text>
                <Text style={[styles.priceValue, { color: colors.destructive }]}>₹{stats.highestOffer}</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={[styles.reviewsTitle, { color: colors.foreground }]}>Recent Reviews</Text>
        {stats.reviews.length === 0 ? (
          <View style={[styles.emptyReviews, { backgroundColor: colors.muted }]}>
            <Feather name="star" size={32} color={colors.border} />
            <Text style={[styles.emptyReviewsText, { color: colors.mutedForeground }]}>No reviews yet</Text>
          </View>
        ) : (
          stats.reviews.map((r: any) => (
            <View key={r.id} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.reviewHeader}>
                <Text style={[styles.reviewBuyer, { color: colors.foreground }]}>{r.buyerName}</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Feather key={s} name="star" size={13} color={s <= r.rating ? "#F59E0B" : colors.border} />
                  ))}
                </View>
              </View>
              <Text style={[styles.reviewProduct, { color: colors.mutedForeground }]}>{r.productName}</Text>
              {r.text ? <Text style={[styles.reviewText, { color: colors.foreground }]}>"{r.text}"</Text> : null}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: "800" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  priceCard: { padding: 16, borderRadius: 14, borderWidth: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700", marginBottom: 14 },
  priceRow: { flexDirection: "row", alignItems: "center" },
  priceItem: { flex: 1, alignItems: "center" },
  priceLabel: { fontSize: 11, marginBottom: 4 },
  priceValue: { fontSize: 18, fontWeight: "800" },
  priceDivider: { width: 1, height: 40, backgroundColor: "#E2E8F0" },
  reviewsTitle: { fontSize: 16, fontWeight: "700" },
  emptyReviews: { padding: 32, alignItems: "center", borderRadius: 14, gap: 8 },
  emptyReviewsText: { fontSize: 13 },
  reviewCard: { padding: 14, borderRadius: 12, borderWidth: 1, gap: 4 },
  reviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reviewBuyer: { fontSize: 14, fontWeight: "700" },
  starsRow: { flexDirection: "row", gap: 2 },
  reviewProduct: { fontSize: 12 },
  reviewText: { fontSize: 13, fontStyle: "italic", lineHeight: 18 },
});
