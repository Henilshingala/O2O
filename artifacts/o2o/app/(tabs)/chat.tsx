/**
 * FEATURE 1 — Unified conversation list
 * Single FlatList of chats, groups, and channels sorted by latest activity (WhatsApp-style).
 * Each row shows avatar, name, last message preview, timestamp, unread badge.
 */
import { router } from "@/compat/router";
import React, { useMemo, useState } from "react";
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
import type { Chat, Group, Channel } from "@/types";

type ConvoType = "chat" | "group" | "channel";

interface ConvoItem {
  id: string;
  type: ConvoType;
  name: string;
  lastMessage?: string;
  lastTs: number;       // epoch ms for sort
  unread: number;
  raw: Chat | Group | Channel;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 86_400_000) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  if (diff < 7 * 86_400_000) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString();
}

function previewText(msg: any): string {
  if (!msg) return "No messages yet";
  if (msg.type === "image") return "📷 Photo";
  if (msg.type === "video") return "🎬 Video";
  if (msg.type === "audio") return "🎵 Voice message";
  if (msg.type === "file") return `📎 ${msg.metadata?.fileName ?? "Document"}`;
  if (msg.type === "location") return "📍 Location";
  if (msg.type === "poll") return `📊 ${msg.text}`;
  return msg.text ?? "No messages yet";
}

export default function ChatTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getUserById } = useAuth();
  const { friends } = useFriends();
  const { chats, groups, channels, deleteChat, clearChat } = useData();

  if (!user) return null;

  // Build a unified sorted list
  const items = useMemo<ConvoItem[]>(() => {
    const result: ConvoItem[] = [];

    // Personal chats
    chats
      .filter((c) => c.participants.includes(user.id))
      .forEach((c) => {
        const msgs = Array.isArray(c.messages) ? c.messages : [];
        const last = msgs[msgs.length - 1];
        const unread = msgs.filter(
          (m) =>
            m.senderId !== user.id &&
            !((m.metadata?.readBy as string[] | undefined)?.includes(user.id))
        ).length;
        const otherId = c.participants.find((p) => p !== user.id) ?? "";
        const other = otherId
          ? friends.find((f) => f.id === otherId) || getUserById(otherId)
          : undefined;
        result.push({
          id: c.id,
          type: "chat",
          name: other?.fullName ?? "Unknown",
          lastMessage: last
            ? (last.senderId === user.id ? `You: ${previewText(last)}` : previewText(last))
            : undefined,
          lastTs: last ? new Date(last.timestamp).getTime() : new Date(c.updatedAt).getTime(),
          unread,
          raw: c,
        });
      });

    // Groups
    groups
      .filter((g) => g.members.includes(user.id))
      .forEach((g) => {
        const msgs = Array.isArray(g.messages) ? g.messages : [];
        const last = msgs[msgs.length - 1];
        const unread = msgs.filter(
          (m) =>
            m.senderId !== user.id &&
            !((m.metadata?.readBy as string[] | undefined)?.includes(user.id))
        ).length;
        result.push({
          id: g.id,
          type: "group",
          name: g.name,
          lastMessage: last
            ? (last.senderId === user.id ? `You: ${previewText(last)}` : previewText(last))
            : undefined,
          lastTs: last ? new Date(last.timestamp).getTime() : new Date(g.updatedAt).getTime(),
          unread,
          raw: g,
        });
      });

    // Channels followed or owned
    channels
      .filter((ch) => ch.followers.includes(user.id) || ch.ownerId === user.id)
      .forEach((ch) => {
        const msgs = Array.isArray(ch.messages) ? ch.messages : [];
        const last = msgs[msgs.length - 1];
        result.push({
          id: ch.id,
          type: "channel",
          name: ch.name,
          lastMessage: last ? previewText(last) : undefined,
          lastTs: last ? new Date(last.timestamp).getTime() : new Date(ch.createdAt).getTime(),
          unread: 0, // channels are broadcast — no per-user unread
          raw: ch,
        });
      });

    // Sort by latest activity descending
    return result.sort((a, b) => b.lastTs - a.lastTs);
  }, [chats, groups, channels, user.id, friends, getUserById]);

  const handleLongPress = (item: ConvoItem) => {
    if (item.type !== "chat") return;
    const otherName = item.name;
    const options = ["Delete Chat", "Clear Messages", "Cancel"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: 0, cancelButtonIndex: 2 },
        (i) => {
          if (i === 0) confirmDeleteChat(item.id, otherName);
          if (i === 1) confirmClearChat(item.id, otherName);
        }
      );
    } else {
      Alert.alert(otherName, "What would you like to do?", [
        { text: "Delete Chat", style: "destructive", onPress: () => confirmDeleteChat(item.id, otherName) },
        { text: "Clear Messages", onPress: () => confirmClearChat(item.id, otherName) },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const confirmDeleteChat = (chatId: string, name: string) =>
    Alert.alert("Delete Chat", `Delete your conversation with ${name}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { await deleteChat(chatId); } catch { Alert.alert("Error", "Could not delete chat."); } } },
    ]);

  const confirmClearChat = (chatId: string, name: string) =>
    Alert.alert("Clear Messages", `Clear all messages with ${name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: async () => { try { await clearChat(chatId); } catch { Alert.alert("Error", "Could not clear messages."); } } },
    ]);

  const navigate = (item: ConvoItem) => {
    if (item.type === "chat") router.push({ pathname: "/chat/[id]", params: { id: item.id } });
    else if (item.type === "group") router.push({ pathname: "/group/[id]", params: { id: item.id } });
    else router.push({ pathname: "/channel/[id]", params: { id: item.id } });
  };

  const typeIcon = (type: ConvoType) => {
    if (type === "group") return "users";
    if (type === "channel") return "radio";
    return null;
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 8 },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Messages</Text>
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/new-chat")}
        >
          <Feather name="edit-2" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => `${item.type}:${item.id}`}
        contentContainerStyle={[styles.list, { paddingBottom: 90 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="message-circle" size={48} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No conversations yet. Start chatting!
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const icon = typeIcon(item.type);
          return (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
              onPress={() => navigate(item)}
              onLongPress={() => handleLongPress(item)}
              delayLongPress={350}
            >
              {/* Avatar */}
              {icon ? (
                <View style={[styles.iconAvatar, {
                  backgroundColor: item.type === "channel" ? "#EFF6FF" : colors.accent,
                }]}>
                  <Feather name={icon as any} size={22} color={colors.primary} />
                </View>
              ) : (
                <Avatar name={item.name} size={50} />
              )}

              <View style={styles.content}>
                <View style={styles.top}>
                  <Text
                    style={[
                      styles.name,
                      { color: colors.foreground, fontWeight: item.unread > 0 ? "800" : "700" },
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <View style={styles.topRight}>
                    {item.lastTs > 0 && (
                      <Text
                        style={[
                          styles.time,
                          { color: item.unread > 0 ? colors.primary : colors.mutedForeground },
                        ]}
                      >
                        {formatTime(item.lastTs)}
                      </Text>
                    )}
                    {item.unread > 0 && (
                      <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.badgeText}>{item.unread > 99 ? "99+" : item.unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text
                  style={[
                    styles.preview,
                    {
                      color: item.unread > 0 ? colors.foreground : colors.mutedForeground,
                      fontWeight: item.unread > 0 ? "600" : "400",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.lastMessage ?? "No messages yet"}
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 12,
  },
  iconAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 15, flex: 1 },
  time: { fontSize: 12 },
  preview: { fontSize: 13 },
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
