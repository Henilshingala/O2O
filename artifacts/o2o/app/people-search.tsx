import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "@/compat/router";
import { Feather } from "@/compat/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useFriends, FriendUser } from "@/context/FriendsContext";

function Avatar({ user, size = 44, colors }: { user: FriendUser; size?: number; colors: any }) {
  const initials = user.fullName?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "??";
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary + "22", alignItems: "center", justifyContent: "center" }]}>
      <Text style={{ color: colors.primary, fontSize: size * 0.38, fontWeight: "800" }}>{initials}</Text>
    </View>
  );
}

function RelationshipButton({
  rel, userId, colors, onSend, onCancel, loading,
}: {
  rel: FriendUser["relationship"]; userId: string; colors: any;
  onSend: () => void; onCancel: () => void; loading: boolean;
}) {
  if (rel === "friends") {
    return (
      <View style={[styles.chip, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}>
        <Feather name="check" size={12} color={colors.primary} />
        <Text style={[styles.chipText, { color: colors.primary, marginLeft: 4 }]}>Friends</Text>
      </View>
    );
  }
  if (rel === "pending_sent") {
    return (
      <TouchableOpacity
        style={[styles.chip, { backgroundColor: colors.muted, borderColor: colors.border }]}
        onPress={onCancel}
        disabled={loading}
      >
        <Text style={[styles.chipText, { color: colors.mutedForeground }]}>Requested</Text>
      </TouchableOpacity>
    );
  }
  if (rel === "pending_received") {
    return (
      <View style={[styles.chip, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Text style={[styles.chipText, { color: colors.mutedForeground }]}>Incoming</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={[styles.chip, { backgroundColor: colors.primary, borderColor: colors.primary }]}
      onPress={onSend}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size={12} color="#fff" />
      ) : (
        <>
          <Feather name="user-plus" size={12} color="#fff" />
          <Text style={[styles.chipText, { color: "#fff", marginLeft: 4 }]}>Add</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export default function PeopleSearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { searchUsers, sendRequest, cancelRequest } = useFriends();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FriendUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!text.trim() || text.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchUsers(text);
        setResults(res);
      } finally {
        setSearching(false);
      }
    }, 400);
    setDebounceTimer(t);
  }, [searchUsers, debounceTimer]);

  const handleSend = async (user: FriendUser) => {
    setLoadingId(user.id);
    try {
      await sendRequest(user.id);
      setResults((prev) => prev.map((u) => u.id === user.id ? { ...u, relationship: "pending_sent" } : u));
    } catch (e: any) {
      alert(e?.data?.error || e?.message || "Failed to send request");
    } finally {
      setLoadingId(null);
    }
  };

  const handleCancel = async (user: FriendUser) => {
    setLoadingId(user.id);
    try {
      await cancelRequest(user.id);
      setResults((prev) => prev.map((u) => u.id === user.id ? { ...u, relationship: "none" } : u));
    } catch {
      // ignore
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Find People</Text>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search by name or username..."
          placeholderTextColor={colors.mutedForeground}
          value={query}
          onChangeText={handleSearch}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(""); setResults([]); }}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {searching ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          ListEmptyComponent={
            query.trim().length >= 2 ? (
              <View style={styles.empty}>
                <Feather name="user-x" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No users found</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Feather name="search" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Type at least 2 characters</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <Avatar user={item} colors={colors} />
              <View style={styles.rowInfo}>
                <Text style={[styles.rowName, { color: colors.foreground }]}>{item.fullName}</Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                  @{item.username} · {item.role} · {item.city}
                </Text>
              </View>
              <RelationshipButton
                rel={item.relationship}
                userId={item.id}
                colors={colors}
                onSend={() => handleSend(item)}
                onCancel={() => handleCancel(item)}
                loading={loadingId === item.id}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: "800" },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    margin: 16, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowInfo: { flex: 1, marginLeft: 12 },
  rowName: { fontSize: 15, fontWeight: "700" },
  rowSub: { fontSize: 12, marginTop: 2 },
  chip: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "700" },
  empty: { alignItems: "center", marginTop: 60, gap: 10 },
  emptyText: { fontSize: 14 },
});
