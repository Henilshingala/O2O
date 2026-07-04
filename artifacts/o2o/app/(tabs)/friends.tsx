import React, { useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "@/compat/router";
import { Feather } from "@/compat/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useFriends, FriendUser } from "@/context/FriendsContext";
import { useAuth } from "@/context/AuthContext";

function Avatar({ user, size = 44, colors }: { user: FriendUser; size?: number; colors: any }) {
  const initials = user.fullName?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "??";
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary + "33" }]}>
      <Text style={[styles.avatarText, { color: colors.primary, fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

function FriendRow({ item, onRemove, colors }: { item: FriendUser; onRemove: () => void; colors: any }) {
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Avatar user={item} colors={colors} />
      <View style={styles.rowInfo}>
        <Text style={[styles.rowName, { color: colors.foreground }]}>{item.fullName}</Text>
        <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>@{item.username} · {item.city}</Text>
      </View>
      <TouchableOpacity
        style={[styles.chip, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "44" }]}
        onPress={onRemove}
      >
        <Text style={[styles.chipText, { color: colors.destructive }]}>Remove</Text>
      </TouchableOpacity>
    </View>
  );
}

function RequestRow({
  item, onAccept, onReject, colors,
}: { item: FriendUser; onAccept: () => void; onReject: () => void; colors: any }) {
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Avatar user={item} colors={colors} />
      <View style={styles.rowInfo}>
        <Text style={[styles.rowName, { color: colors.foreground }]}>{item.fullName}</Text>
        <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>@{item.username}</Text>
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity
          style={[styles.chip, { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={onAccept}
        >
          <Text style={[styles.chipText, { color: "#fff" }]}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, { backgroundColor: colors.muted, borderColor: colors.border, marginLeft: 6 }]}
          onPress={onReject}
        >
          <Text style={[styles.chipText, { color: colors.mutedForeground }]}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function FriendsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { friends, incoming, outgoing, isLoading, removeFriend, acceptRequest, rejectRequest } = useFriends();
  const [tab, setTab] = useState<"friends" | "requests">("friends");

  const requestCount = incoming.length;

  const handleRemove = (f: FriendUser) => {
    Alert.alert("Remove Friend", `Remove ${f.fullName} from your friends?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeFriend(f.id) },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Friends</Text>
        <TouchableOpacity
          style={[styles.searchBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/people-search")}
        >
          <Feather name="user-plus" size={16} color="#fff" />
          <Text style={styles.searchBtnText}>Add People</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(["friends", "requests"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
              {t === "friends" ? `Friends (${friends.length})` : `Requests${requestCount > 0 ? ` (${requestCount})` : ""}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : tab === "friends" ? (
        <FlatList
          data={friends}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="users" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No friends yet</Text>
              <TouchableOpacity onPress={() => router.push("/people-search")}>
                <Text style={[styles.emptyLink, { color: colors.primary }]}>Find people to add →</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <FriendRow item={item} onRemove={() => handleRemove(item)} colors={colors} />
          )}
        />
      ) : (
        <FlatList
          data={[
            ...incoming.map((u) => ({ ...u, _type: "incoming" as const })),
            ...outgoing.map((u) => ({ ...u, _type: "outgoing" as const })),
          ]}
          keyExtractor={(i) => i.id + i._type}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          ListHeaderComponent={
            incoming.length > 0 ? (
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>INCOMING</Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No pending requests</Text>
            </View>
          }
          renderItem={({ item }) =>
            item._type === "incoming" ? (
              <RequestRow
                item={item}
                onAccept={() => acceptRequest(item.id)}
                onReject={() => rejectRequest(item.id)}
                colors={colors}
              />
            ) : (
              <View style={[styles.row, { borderBottomColor: colors.border }]}>
                <Avatar user={item} colors={colors} />
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowName, { color: colors.foreground }]}>{item.fullName}</Text>
                  <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>@{item.username}</Text>
                </View>
                <View style={[styles.chip, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Text style={[styles.chipText, { color: colors.mutedForeground }]}>Pending</Text>
                </View>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1,
  },
  title: { fontSize: 22, fontWeight: "800" },
  searchBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  searchBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabText: { fontSize: 14, fontWeight: "600" },
  row: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 18,
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowInfo: { flex: 1, marginLeft: 12 },
  rowName: { fontSize: 15, fontWeight: "700" },
  rowSub: { fontSize: 12, marginTop: 2 },
  rowActions: { flexDirection: "row" },
  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "800" },
  chip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "700" },
  empty: { alignItems: "center", marginTop: 60, gap: 10 },
  emptyText: { fontSize: 15 },
  emptyLink: { fontSize: 14, fontWeight: "700", marginTop: 4 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4 },
});
