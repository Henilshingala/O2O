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

type SearchTab = "chat" | "channel" | "group";

const TABS: { key: SearchTab; label: string }[] = [
  { key: "chat", label: "Chat" },
  { key: "channel", label: "Channel" },
  { key: "group", label: "Group" },
];

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getUserById } = useAuth();
  const { chats, channels, groups } = useData();
  const { friends } = useFriends();

  const [activeTab, setActiveTab] = useState<SearchTab>("chat");
  const [queries, setQueries] = useState<Record<SearchTab, string>>({
    chat: "",
    channel: "",
    group: "",
  });

  const inputRefs = useRef<Record<SearchTab, TextInput | null>>({ chat: null, channel: null, group: null });

  const debouncedChat = useDebounce(queries.chat, 300);
  const debouncedChannel = useDebounce(queries.channel, 300);
  const debouncedGroup = useDebounce(queries.group, 300);

  if (!user) return null;

  const filteredChats = useMemo(() => {
    const q = debouncedChat.toLowerCase().trim();
    return chats
      .filter((c) => c.participants.includes(user.id))
      .filter((c) => {
        if (!q) return true;
        const otherId = c.participants.find((p) => p !== user.id) ?? "";
        const other = otherId ? friends.find((f) => f.id === otherId) || getUserById(otherId) : undefined;
        return (other?.fullName ?? "").toLowerCase().includes(q);
      });
  }, [chats, debouncedChat, user.id, friends, getUserById]);

  const filteredChannels = useMemo(() => {
    const q = debouncedChannel.toLowerCase().trim();
    return channels
      .filter((c) => c.followers.includes(user.id) || c.ownerId === user.id)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  }, [channels, debouncedChannel, user.id]);

  const filteredGroups = useMemo(() => {
    const q = debouncedGroup.toLowerCase().trim();
    return groups
      .filter((g) => g.members.includes(user.id))
      .filter((g) => !q || g.name.toLowerCase().includes(q));
  }, [groups, debouncedGroup, user.id]);

  const setQuery = (tab: SearchTab) => (v: string) =>
    setQueries((prev) => ({ ...prev, [tab]: v }));

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

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[
              styles.tabBtn,
              activeTab === t.key && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 },
            ]}
            onPress={() => {
              setActiveTab(t.key);
              setTimeout(() => inputRefs.current[t.key]?.focus(), 100);
            }}
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

      {/* Search input for each tab */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.searchInput, { backgroundColor: colors.muted }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            ref={(ref) => { inputRefs.current[activeTab] = ref; }}
            style={[styles.searchText, { color: colors.foreground }]}
            value={queries[activeTab]}
            onChangeText={setQuery(activeTab)}
            placeholder={
              activeTab === "chat"
                ? "Search people..."
                : activeTab === "channel"
                  ? "Search channels..."
                  : "Search groups..."
            }
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            autoFocus={activeTab === "chat"}
            clearButtonMode="while-editing"
          />
          {queries[activeTab].length > 0 && (
            <TouchableOpacity onPress={() => setQuery(activeTab)("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      {activeTab === "chat" && (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState query={debouncedChat} label="No chats found" colors={colors} />}
          renderItem={({ item }) => {
            const otherId = item.participants.find((p) => p !== user.id) ?? "";
            const other = otherId ? friends.find((f) => f.id === otherId) || getUserById(otherId) : undefined;
            const msgs = Array.isArray(item.messages) ? item.messages : [];
            const last = msgs[msgs.length - 1];
            return (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: colors.border }]}
                onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id } })}
              >
                <Avatar name={other?.fullName ?? "?"} size={46} />
                <View style={styles.rowContent}>
                  <Text style={[styles.rowName, { color: colors.foreground }]}>{other?.fullName ?? "Unknown"}</Text>
                  {last && (
                    <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {last.text ?? ""}
                    </Text>
                  )}
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            );
          }}
        />
      )}

      {activeTab === "channel" && (
        <FlatList
          data={filteredChannels}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState query={debouncedChannel} label="No channels found" colors={colors} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: colors.border }]}
              onPress={() => router.push({ pathname: "/channel/[id]", params: { id: item.id } })}
            >
              <View style={[styles.iconAvatar, { backgroundColor: "#EFF6FF" }]}>
                <Feather name="radio" size={20} color={colors.primary} />
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                  {item.followers.length} followers • {item.category}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        />
      )}

      {activeTab === "group" && (
        <FlatList
          data={filteredGroups}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState query={debouncedGroup} label="No groups found" colors={colors} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: colors.border }]}
              onPress={() => router.push({ pathname: "/group/[id]", params: { id: item.id } })}
            >
              <View style={[styles.iconAvatar, { backgroundColor: colors.accent }]}>
                <Feather name="users" size={20} color={colors.primary} />
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                  {item.members.length} members
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function EmptyState({ query, label, colors }: { query: string; label: string; colors: any }) {
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
    borderBottomWidth: 1,
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
