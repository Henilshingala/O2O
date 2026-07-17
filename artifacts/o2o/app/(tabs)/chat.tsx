import { router } from "@/compat/router";
import React, { useState } from "react";
import {
  ActionSheetIOS,
  Alert,
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
import { useFriends } from "@/context/FriendsContext";
import { useColors } from "@/hooks/useColors";

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString();
}

function previewText(last: any): string {
  if (!last) return "No messages yet";
  if (last.type === "image") return "📷 Photo";
  if (last.type === "video") return "🎬 Video";
  if (last.type === "audio") return "🎵 Voice message";
  if (last.type === "file") return `📎 ${last.metadata?.fileName ?? "Document"}`;
  if (last.type === "location") return "📍 Location";
  if (last.type === "poll") return `📊 ${last.text}`;
  return last.text ?? "No messages yet";
}

export default function ChatTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getUserById } = useAuth();
  const { friends } = useFriends();
  const { chats, deleteChat, clearChat } = useData();

  if (!user) return null;

  const myChats = chats
    .filter((c) => c.participants.includes(user.id))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const handleLongPress = (chatId: string, otherName: string) => {
    const options = ["Delete Chat", "Clear Messages", "Cancel"];
    const destructiveIndex = 0;
    const cancelIndex = 2;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: destructiveIndex, cancelButtonIndex: cancelIndex },
        (buttonIndex) => {
          if (buttonIndex === 0) confirmDelete(chatId, otherName);
          if (buttonIndex === 1) confirmClear(chatId, otherName);
        }
      );
    } else {
      Alert.alert(otherName, "What would you like to do?", [
        {
          text: "Delete Chat",
          style: "destructive",
          onPress: () => confirmDelete(chatId, otherName),
        },
        {
          text: "Clear Messages",
          onPress: () => confirmClear(chatId, otherName),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const confirmDelete = (chatId: string, otherName: string) => {
    Alert.alert(
      "Delete Chat",
      `Delete your conversation with ${otherName}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteChat(chatId);
            } catch {
              Alert.alert("Error", "Could not delete chat. Please try again.");
            }
          },
        },
      ]
    );
  };

  const confirmClear = (chatId: string, otherName: string) => {
    Alert.alert(
      "Clear Messages",
      `Clear all messages in your conversation with ${otherName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await clearChat(chatId);
            } catch {
              Alert.alert("Error", "Could not clear messages. Please try again.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: insets.top + 8,
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
        contentContainerStyle={[styles.list, { paddingBottom: 90 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="message-circle" size={48} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No chats yet. Start a conversation!
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const otherId = item.participants.find((p) => p !== user.id) ?? "";
          const other = otherId
            ? friends.find((f) => f.id === otherId) || getUserById(otherId)
            : undefined;
          const messages = Array.isArray(item.messages) ? item.messages : [];
          const last = messages[messages.length - 1];

          // Unread count: messages not sent by me and not in readBy
          const unread = messages.filter(
            (m) =>
              m.senderId !== user.id &&
              !((m.metadata?.readBy as string[] | undefined)?.includes(user.id))
          ).length;

          const otherName = other?.fullName ?? "Unknown";

          return (
            <TouchableOpacity
              style={[
                styles.chatRow,
                { backgroundColor: colors.card, borderBottomColor: colors.border },
              ]}
              onPress={() =>
                router.push({ pathname: "/chat/[id]", params: { id: item.id } })
              }
              onLongPress={() => handleLongPress(item.id, otherName)}
              delayLongPress={350}
            >
              <Avatar name={otherName} size={50} />
              <View style={styles.chatContent}>
                <View style={styles.chatTop}>
                  <Text
                    style={[
                      styles.chatName,
                      { color: colors.foreground, fontWeight: unread > 0 ? "800" : "700" },
                    ]}
                  >
                    {otherName}
                  </Text>
                  <View style={styles.chatTopRight}>
                    {last && (
                      <Text style={[styles.chatTime, { color: unread > 0 ? colors.primary : colors.mutedForeground }]}>
                        {formatTime(last.timestamp)}
                      </Text>
                    )}
                    {unread > 0 && (
                      <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text
                  style={[
                    styles.chatPreview,
                    { color: unread > 0 ? colors.foreground : colors.mutedForeground, fontWeight: unread > 0 ? "600" : "400" },
                  ]}
                  numberOfLines={1}
                >
                  {last?.senderId === user.id ? `You: ${previewText(last)}` : previewText(last)}
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
    justifyContent: "space-between",
    alignItems: "center",
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
  chatTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  chatTopRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  chatName: { fontSize: 15 },
  chatTime: { fontSize: 12 },
  chatPreview: { fontSize: 13 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
