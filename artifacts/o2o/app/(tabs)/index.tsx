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
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return d.toLocaleDateString();
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getUserById } = useAuth();
  const { chats, groups, channels, getMyBids, getBidsForSeller, getMyOrders } = useData();

  if (!user) return null;

  const myChats = chats
    .filter((c) => c.participants.includes(user.id))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3);

  const myGroups = groups
    .filter((g) => g.members.includes(user.id))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3);

  const myChannels = channels
    .filter((c) => c.followers.includes(user.id) || c.ownerId === user.id)
    .slice(0, 3);

  const myBids = user.role === "buyer" ? getMyBids(user.id) : [];
  const sellerBids = user.role === "seller"
    ? channels.filter((c) => c.ownerId === user.id).flatMap((c) => getBidsForSeller(c.id))
    : [];
  const myOrders = getMyOrders(user.id, user.role);

  const paddingBottom = Platform.OS === "ios" ? 90 : Platform.OS === "web" ? 100 : 90;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
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
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <Text style={[styles.searchPlaceholder, { color: colors.mutedForeground }]}>
            Search...
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.muted }]}
            onPress={() => {}}
          >
            <Feather name="bell" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(tabs)/settings")}>
            <Avatar name={user.fullName} size={36} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom }}
      >
        {/* Greeting */}
        <View style={styles.greetingBox}>
          <Text style={[styles.greeting, { color: colors.foreground }]}>
            Hello, {user.fullName.split(" ")[0]}
          </Text>
          <View style={[styles.roleBadge, { backgroundColor: user.role === "seller" ? colors.accent : "#D1FAE5" }]}>
            <Text style={[styles.roleText, { color: user.role === "seller" ? colors.accentForeground : "#065F46" }]}>
              {user.role.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Stats Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll} contentContainerStyle={styles.statsContent}>
          {user.role === "buyer" && (
            <>
              <StatCard label="Active Bids" value={myBids.filter(b => b.status === "active").length} icon="trending-up" colors={colors} />
              <StatCard label="My Orders" value={myOrders.length} icon="package" colors={colors} />
            </>
          )}
          {user.role === "seller" && (
            <>
              <StatCard label="Bid Requests" value={sellerBids.length} icon="trending-up" colors={colors} />
              <StatCard label="My Orders" value={myOrders.length} icon="package" colors={colors} />
              <StatCard label="My Channels" value={channels.filter(c => c.ownerId === user.id).length} icon="radio" colors={colors} />
            </>
          )}
          <StatCard label="Groups" value={groups.filter(g => g.members.includes(user.id)).length} icon="users" colors={colors} />
        </ScrollView>

        {/* Quick actions */}
        {user.role === "buyer" && (
          <QuickActions
            colors={colors}
            items={[
              { label: "Wishlist", icon: "heart", onPress: () => router.push("/wishlist") },
              { label: "My Bids", icon: "trending-up", onPress: () => router.push("/my-bids") },
              { label: "Orders", icon: "package", onPress: () => router.push("/my-orders") },
            ]}
          />
        )}
        {user.role === "seller" && (
          <QuickActions
            colors={colors}
            items={[
              { label: "Analytics", icon: "bar-chart-2", onPress: () => router.push("/analytics") },
              { label: "Bid Requests", icon: "trending-up", onPress: () => router.push("/seller-bids") },
              { label: "Orders", icon: "package", onPress: () => router.push("/my-orders") },
            ]}
          />
        )}

        {/* Recent Chats */}
        <SectionHeader title="Recent Chats" onView={() => router.push("/(tabs)/chat")} colors={colors} />
        {myChats.length === 0 ? (
          <EmptyRow label="No recent chats" colors={colors} />
        ) : (
          myChats.map((chat) => {
            const otherId = chat.participants.find((p) => p !== user.id)!;
            const other = getUserById(otherId);
            const last = chat.messages[chat.messages.length - 1];
            return (
              <TouchableOpacity
                key={chat.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: "/chat/[id]", params: { id: chat.id } })}
              >
                <Avatar name={other?.fullName ?? "?"} size={44} />
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                    {other?.fullName ?? "Unknown"}
                  </Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {last?.text ?? "No messages yet"}
                  </Text>
                </View>
                {last && (
                  <Text style={[styles.cardTime, { color: colors.mutedForeground }]}>
                    {formatTime(last.timestamp)}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })
        )}

        {/* Recent Groups */}
        <SectionHeader title="Recent Groups" onView={() => router.push("/(tabs)/groups")} colors={colors} />
        {myGroups.length === 0 ? (
          <EmptyRow label="No groups yet" colors={colors} />
        ) : (
          myGroups.map((grp) => {
            const last = grp.messages[grp.messages.length - 1];
            return (
              <TouchableOpacity
                key={grp.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: "/group/[id]", params: { id: grp.id } })}
              >
                <View style={[styles.groupAvatar, { backgroundColor: colors.accent }]}>
                  <Feather name="users" size={20} color={colors.primary} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{grp.name}</Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                    {grp.members.length} members
                    {last ? ` • ${last.text.slice(0, 30)}` : ""}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Recent Channels */}
        <SectionHeader title="Recent Channels" onView={() => router.push("/(tabs)/channels")} colors={colors} />
        {myChannels.length === 0 ? (
          <EmptyRow label="No channels followed" colors={colors} />
        ) : (
          myChannels.map((ch) => (
            <TouchableOpacity
              key={ch.id}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: "/channel/[id]", params: { id: ch.id } })}
            >
              <View style={[styles.groupAvatar, { backgroundColor: "#EFF6FF" }]}>
                <Feather name="radio" size={20} color={colors.primary} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{ch.name}</Text>
                <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                  {ch.followers.length} followers • {ch.products.length} products
                </Text>
              </View>
              {ch.ownerId === user.id && (
                <View style={[styles.ownerBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.ownerText}>Owner</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, icon, colors }: { label: string; value: number; icon: string; colors: any }) {
  return (
    <View style={[statStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name={icon as any} size={20} color={colors.primary} />
      <Text style={[statStyles.value, { color: colors.foreground }]}>{value}</Text>
      <Text style={[statStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function QuickActions({ items, colors }: { items: { label: string; icon: string; onPress: () => void }[]; colors: any }) {
  return (
    <View style={qaStyles.row}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.label}
          style={[qaStyles.btn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={item.onPress}
        >
          <Feather name={item.icon as any} size={20} color={colors.primary} />
          <Text style={[qaStyles.label, { color: colors.foreground }]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SectionHeader({ title, onView, colors }: { title: string; onView: () => void; colors: any }) {
  return (
    <View style={shStyles.row}>
      <Text style={[shStyles.title, { color: colors.foreground }]}>{title}</Text>
      <TouchableOpacity onPress={onView}>
        <Text style={[shStyles.view, { color: colors.primary }]}>View all</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyRow({ label, colors }: { label: string; colors: any }) {
  return (
    <View style={[emptyStyles.row, { backgroundColor: colors.muted }]}>
      <Text style={[emptyStyles.text, { color: colors.mutedForeground }]}>{label}</Text>
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
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  searchPlaceholder: { fontSize: 14 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  greetingBox: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 16 },
  greeting: { fontSize: 20, fontWeight: "700" },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  roleText: { fontSize: 11, fontWeight: "700" },
  statsScroll: { marginBottom: 4 },
  statsContent: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  cardSub: { fontSize: 13 },
  cardTime: { fontSize: 12 },
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  ownerText: { fontSize: 10, fontWeight: "700", color: "#fff" },
});

const statStyles = StyleSheet.create({
  card: {
    width: 100,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
  },
  value: { fontSize: 22, fontWeight: "800" },
  label: { fontSize: 11, textAlign: "center" },
});

const qaStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  btn: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  label: { fontSize: 11, fontWeight: "600" },
});

const shStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 16, fontWeight: "700" },
  view: { fontSize: 13, fontWeight: "600" },
});

const emptyStyles = StyleSheet.create({
  row: { marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 12, alignItems: "center" },
  text: { fontSize: 13 },
});
