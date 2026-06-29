import { router } from "@/compat/router";
import React from "react";
import {
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
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

function MenuItem({ icon, label, onPress, colors, danger = false }: {
  icon: string; label: string; onPress: () => void; colors: any; danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
      onPress={onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: danger ? "#FEE2E2" : colors.muted }]}>
        <Feather name={icon as any} size={18} color={danger ? colors.destructive : colors.foreground} />
      </View>
      <Text style={[styles.menuLabel, { color: danger ? colors.destructive : colors.foreground }]}>{label}</Text>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

export default function SettingsTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { getMyOrders, getMyBids, channels } = useData();

  if (!user) return null;

  const myOrders = getMyOrders(user.id, user.role);
  const myBids = user.role === "buyer" ? getMyBids(user.id) : [];
  const myChannels = channels.filter((c) => c.ownerId === user.id);

  const handleLogout = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await logout();
    router.replace("/welcome");
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 100 : 90 }}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 8,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
      </View>

      {/* Profile Card */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Avatar name={user.fullName} size={64} />
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.foreground }]}>{user.fullName}</Text>
          <Text style={[styles.profileUsername, { color: colors.mutedForeground }]}>@{user.username}</Text>
          <View style={styles.profileMeta}>
            <Badge label={user.role.toUpperCase()} variant={user.role === "seller" ? "primary" : "success"} />
            <Text style={[styles.profileCity, { color: colors.mutedForeground }]}>{user.city}</Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.stat}>
          <Text style={[styles.statVal, { color: colors.primary }]}>{myOrders.length}</Text>
          <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Orders</Text>
        </View>
        {user.role === "buyer" && (
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: colors.primary }]}>{myBids.length}</Text>
            <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Bids</Text>
          </View>
        )}
        {user.role === "seller" && (
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: colors.primary }]}>{myChannels.length}</Text>
            <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Channels</Text>
          </View>
        )}
      </View>

      {/* Account Section */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACCOUNT</Text>
      <View style={[styles.menuGroup, { borderColor: colors.border }]}>
        <MenuItem icon="mail" label={user.email} onPress={() => {}} colors={colors} />
        <MenuItem icon="phone" label={user.mobile} onPress={() => {}} colors={colors} />
        <MenuItem icon="map-pin" label={user.city} onPress={() => {}} colors={colors} />
      </View>

      {/* Role-specific */}
      {user.role === "buyer" && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>BUYER</Text>
          <View style={[styles.menuGroup, { borderColor: colors.border }]}>
            <MenuItem icon="heart" label="My Wishlist" onPress={() => router.push("/wishlist")} colors={colors} />
            <MenuItem icon="trending-up" label="My Bids" onPress={() => router.push("/my-bids")} colors={colors} />
            <MenuItem icon="package" label="My Orders" onPress={() => router.push("/my-orders")} colors={colors} />
          </View>
        </>
      )}

      {user.role === "seller" && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SELLER</Text>
          <View style={[styles.menuGroup, { borderColor: colors.border }]}>
            <MenuItem icon="radio" label="My Channels" onPress={() => router.push("/(tabs)/channels")} colors={colors} />
            <MenuItem icon="bar-chart-2" label="Analytics" onPress={() => router.push("/analytics")} colors={colors} />
            <MenuItem icon="trending-up" label="Bid Requests" onPress={() => router.push("/seller-bids")} colors={colors} />
            <MenuItem icon="package" label="My Orders" onPress={() => router.push("/my-orders")} colors={colors} />
          </View>
        </>
      )}

      {/* Logout */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACCOUNT</Text>
      <View style={[styles.menuGroup, { borderColor: colors.border }]}>
        <MenuItem icon="log-out" label="Log Out" onPress={handleLogout} colors={colors} danger />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 22, fontWeight: "800" },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 18, fontWeight: "800" },
  profileUsername: { fontSize: 13 },
  profileMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  profileCity: { fontSize: 12 },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  stat: { flex: 1, alignItems: "center" },
  statVal: { fontSize: 22, fontWeight: "800" },
  statLbl: { fontSize: 12, marginTop: 2 },
  sectionLabel: { fontSize: 11, fontWeight: "700", paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, letterSpacing: 0.5 },
  menuGroup: { borderTopWidth: 1, borderBottomWidth: 1, backgroundColor: "transparent" },
  menuItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  menuIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 15 },
});
