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
import { Avatar } from "@/components/ui/Avatar";
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

export default function ChatTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getUserById, getFriends } = useAuth();
  const { chats, createChat } = useData();

  if (!user) return null;

  const myChats = chats
    .filter((c) => c.participants.includes(user.id))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const handleNewChat = () => {
    const friends = getFriends();
    if (friends.length === 0) return;
    const other = friends[0];
    const chat = createChat(user.id, other.id);
    if (chat) router.push({ pathname: "/chat/[id]", params: { id: chat.id } });
  };

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
        <Text style={[styles.title, { color: colors.foreground }]}>Chats</Text>
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/new-chat")}
        >
          <Feather name="edit-2" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={myChats}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 100 : 90 },
        ]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="message-circle" size={48} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No chats yet. Start a conversation!
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const otherId = item.participants.find((p) => p !== user.id)!;
          const other = getUserById(otherId);
          const last = item.messages[item.messages.length - 1];
          return (
            <TouchableOpacity
              style={[styles.chatRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
              onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id } })}
            >
              <Avatar name={other?.fullName ?? "?"} size={50} />
              <View style={styles.chatContent}>
                <View style={styles.chatTop}>
                  <Text style={[styles.chatName, { color: colors.foreground }]}>
                    {other?.fullName ?? "Unknown"}
                  </Text>
                  {last && (
                    <Text style={[styles.chatTime, { color: colors.mutedForeground }]}>
                      {formatTime(last.timestamp)}
                    </Text>
                  )}
                </View>
                <Text style={[styles.chatPreview, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {last?.text ?? "No messages yet"}
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
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  chatContent: { flex: 1 },
  chatTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  chatName: { fontSize: 15, fontWeight: "700" },
  chatTime: { fontSize: 12 },
  chatPreview: { fontSize: 13 },
});
