import { router } from "@/compat/router";
import React from "react";
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

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString();
}

export default function GroupsTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getMyGroups } = useData();

  if (!user) return null;
  const groups = getMyGroups(user.id);

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
        <Text style={[styles.title, { color: colors.foreground }]}>Groups</Text>
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/group/create")}
        >
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 100 : 90 },
        ]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="users" size={48} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No groups yet. Create or join one!
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/group/create")}
            >
              <Text style={styles.emptyBtnText}>Create Group</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const last = item.messages[item.messages.length - 1];
          return (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
              onPress={() => router.push({ pathname: "/group/[id]", params: { id: item.id } })}
            >
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Feather name="users" size={22} color={colors.primary} />
              </View>
              <View style={styles.content}>
                <View style={styles.top}>
                  <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                  {last && (
                    <Text style={[styles.time, { color: colors.mutedForeground }]}>
                      {formatTime(last.timestamp)}
                    </Text>
                  )}
                </View>
                <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                  {item.members.length} members
                  {last ? ` • ${last.text.slice(0, 35)}` : ""}
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
  top: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  name: { fontSize: 15, fontWeight: "700" },
  time: { fontSize: 12 },
  sub: { fontSize: 13 },
});
