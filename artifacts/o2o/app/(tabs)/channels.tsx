import { router } from "@/compat/router";
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
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

export default function ChannelsTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { channels, followChannel } = useData();
  const [tab, setTab] = useState<"all" | "mine">("all");

  if (!user) return null;

  const allChannels = channels.filter((c) => c.visibility === "public" || c.ownerId === user.id);
  const myChannels = channels.filter((c) => c.followers.includes(user.id) || c.ownerId === user.id);
  const data = tab === "all" ? allChannels : myChannels;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
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
        <Text style={[styles.title, { color: colors.foreground }]}>Channels</Text>
        {user.role === "seller" && (
          <TouchableOpacity
            style={[styles.newBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/channel/create")}
          >
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(["all", "mine"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
              {t === "all" ? "All Channels" : "Following"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 100 : 90 },
        ]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="radio" size={48} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {tab === "mine" ? "Not following any channels yet" : "No channels available"}
            </Text>
            {user.role === "seller" && tab === "mine" && (
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/channel/create")}
              >
                <Text style={styles.emptyBtnText}>Create Channel</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const isOwner = item.ownerId === user.id;
          const isFollowing = item.followers.includes(user.id);
          return (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
              onPress={() => router.push({ pathname: "/channel/[id]", params: { id: item.id } })}
            >
              <View style={[styles.avatar, { backgroundColor: "#EFF6FF" }]}>
                <Feather name="radio" size={22} color={colors.primary} />
              </View>
              <View style={styles.content}>
                <View style={styles.top}>
                  <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                  {isOwner ? (
                    <View style={[styles.ownerBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.ownerText}>Owner</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.followBtn,
                        {
                          backgroundColor: isFollowing ? colors.muted : colors.primary,
                        },
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        followChannel(item.id, user.id);
                      }}
                    >
                      <Text style={[styles.followText, { color: isFollowing ? colors.foreground : "#fff" }]}>
                        {isFollowing ? "Following" : "Follow"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                  {item.followers.length} followers • {item.category} • {item.products.length} products
                </Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 22, fontWeight: "800" },
  newBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabText: { fontSize: 14, fontWeight: "600" },
  list: { flexGrow: 1 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  content: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  name: { fontSize: 15, fontWeight: "700", flex: 1 },
  sub: { fontSize: 13 },
  ownerBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  ownerText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  followBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  followText: { fontSize: 12, fontWeight: "700" },
});
