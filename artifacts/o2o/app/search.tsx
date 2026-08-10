/**
 * FEATURE 2 — Search screen with 3 tabs: Chat | Channel | Group
 * Each tab has its own search input and filters only its respective type.
 */
import { router } from "@/compat/router";
import React, { useMemo, useRef, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useFriends } from "@/context/FriendsContext";
import { useColors } from "@/hooks/useColors";
import { useDebounce } from "@/hooks/useDebounce";

type SearchTab = "all" | "chat" | "group" | "channel";

const TABS: { key: SearchTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "chat", label: "Chats" },
  { key: "group", label: "Groups" },
  { key: "channel", label: "Channels" },
];

type UnifiedResult = {
  id: string;
  type: "chat" | "group" | "channel";
  title: string;
  subtitle: string;
  avatarName?: string;
  icon?: string;
  onPress: () => void;
};

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getUserById } = useAuth();
  const { chats, channels, groups } = useData();
  const { friends } = useFriends();

  const [activeTab, setActiveTab] = useState<SearchTab>("all");
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput | null>(null);

  const debouncedQuery = useDebounce(query, 150);

  if (!user) return null;

  const filteredItems = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();
    const results: UnifiedResult[] = [];

    if (activeTab === "all" || activeTab === "chat") {
      chats
        .filter((c) => c.participants.includes(user.id))
        .forEach((c) => {
          const otherId = c.participants.find((p) => p !== user.id) ?? "";
          const other = otherId ? friends.find((f) => f.id === otherId) || getUserById(otherId) : undefined;
          const fullName = other?.fullName ?? "Unknown";
          if (!q || fullName.toLowerCase().includes(q)) {
            const msgs = Array.isArray(c.messages) ? c.messages : [];
            const last = msgs[msgs.length - 1];
            results.push({
              id: `chat-${c.id}`,
              type: "chat",
              title: fullName,
              subtitle: last?.text ?? "",
              avatarName: fullName,
              onPress: () => router.push({ pathname: "/chat/[id]", params: { id: c.id } })
            });
          }
        });
    }

    if (activeTab === "all" || activeTab === "group") {
      groups
        .filter((g) => g.members.includes(user.id))
        .forEach((g) => {
          if (!q || g.name.toLowerCase().includes(q)) {
            results.push({
              id: `group-${g.id}`,
              type: "group",
              title: g.name,
              subtitle: `${g.members.length} members`,
              icon: "users",
              onPress: () => router.push({ pathname: "/group/[id]", params: { id: g.id } })
            });
          }
        });
    }

    if (activeTab === "all" || activeTab === "channel") {
      channels
        .forEach((c) => {
          if (!q || c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)) {
            results.push({
              id: `channel-${c.id}`,
              type: "channel",
              title: c.name,
              subtitle: `${c.followers.length} followers • ${c.category}`,
              icon: "radio",
              onPress: () => router.push({ pathname: "/channel/[id]", params: { id: c.id } })
            });
          }
        });
    }

    return results;
  }, [chats, groups, channels, debouncedQuery, activeTab, user.id, friends, getUserById]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Search</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Search Input */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <View style={[styles.searchInput, { backgroundColor: colors.muted }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            ref={inputRef}
            style={[styles.searchText, { color: colors.foreground }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search..."
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            autoFocus
            clearButtonMode="while-editing"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Feather name="x-circle" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[
              styles.tabBtn,
              activeTab === t.key && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 },
            ]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === t.key ? colors.primary : colors.mutedForeground },
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Results */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState query={debouncedQuery} tab={activeTab} colors={colors} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={item.onPress}
          >
            {item.type === "chat" ? (
              <Avatar name={item.avatarName!} size={46} />
            ) : (
              <View style={[styles.iconAvatar, { backgroundColor: item.type === "group" ? colors.accent : "#EFF6FF" }]}>
                <Feather name={item.icon as any} size={20} color={colors.primary} />
              </View>
            )}
            
            <View style={styles.rowContent}>
              <Text style={[styles.rowName, { color: colors.foreground }]}>{item.title}</Text>
              {!!item.subtitle && (
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              )}
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function EmptyState({ query, tab, colors }: { query: string; tab: string; colors: any }) {
  const label = tab === "all" ? "No results found" : `No ${tab}s found`;
  return (
    <View style={emptyStyles.root}>
      <Feather name="search" size={40} color={colors.border} />
      <Text style={[emptyStyles.text, { color: colors.mutedForeground }]}>
        {query ? label : "Start typing to search"}
      </Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  root: { alignItems: "center", paddingTop: 60, gap: 12 },
  text: { fontSize: 14 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 13,
  },
  tabLabel: { fontSize: 14, fontWeight: "700" },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
  },
  searchText: { flex: 1, fontSize: 14 },
  list: { flexGrow: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 12,
  },
  iconAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  rowSub: { fontSize: 13 },
});
