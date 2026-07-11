/**
 * ForwardModal — forward selected messages to one or more friends / groups.
 *
 * Shows two tabs: Friends and Groups.
 * Allows multi-select. Sends messages in chronological order.
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@/compat/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";
import { useFriends } from "@/context/FriendsContext";
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import type { Message } from "@/types";

interface ForwardModalProps {
  visible: boolean;
  messages: Message[];
  onClose: () => void;
  onDone: () => void;
}

type TabType = "friends" | "groups";

export function ForwardModal({ visible, messages, onClose, onDone }: ForwardModalProps) {
  const colors = useColors();
  const { user } = useAuth();
  const { friends } = useFriends();
  const { groups, chats, createChat, sendChatMessage, sendGroupMessage } = useData();
  const [tab, setTab] = useState<TabType>("friends");
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  // Sort messages chronologically before forwarding
  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [messages]
  );

  const myGroups = useMemo(
    () => (user ? groups.filter((g) => g.members.includes(user.id)) : []),
    [groups, user]
  );

  const toggleFriend = useCallback((id: string) => {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((id: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const totalSelected = selectedFriends.size + selectedGroups.size;

  const handleSend = useCallback(async () => {
    if (!user || totalSelected === 0) return;
    setSending(true);
    try {
      const ts = new Date().toISOString();

      // Forward to friends (direct chats)
      for (const friendId of selectedFriends) {
        const chat = await createChat(user.id, friendId);
        for (const msg of sortedMessages) {
          await sendChatMessage(chat.id, {
            senderId: user.id,
            text: msg.text,
            timestamp: ts,
            type: msg.type,
            chatId: chat.id,
            metadata: msg.metadata
              ? { ...msg.metadata, uploading: undefined, uploadError: undefined }
              : undefined,
          });
        }
      }

      // Forward to groups
      for (const groupId of selectedGroups) {
        for (const msg of sortedMessages) {
          await sendGroupMessage(groupId, {
            senderId: user.id,
            text: msg.text,
            timestamp: ts,
            type: msg.type,
            groupId,
            metadata: msg.metadata
              ? { ...msg.metadata, uploading: undefined, uploadError: undefined }
              : undefined,
          });
        }
      }

      setSelectedFriends(new Set());
      setSelectedGroups(new Set());
      onDone();
    } catch (e) {
      console.error("Forward failed:", e);
    } finally {
      setSending(false);
    }
  }, [user, selectedFriends, selectedGroups, sortedMessages, createChat, sendChatMessage, sendGroupMessage, onDone]);

  const handleClose = () => {
    setSelectedFriends(new Set());
    setSelectedGroups(new Set());
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleClose}>
            <Feather name="x" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Forward to</Text>
          <TouchableOpacity
            onPress={handleSend}
            disabled={totalSelected === 0 || sending}
            style={[styles.sendBtn, { backgroundColor: totalSelected > 0 ? colors.primary : colors.muted }]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                Send{totalSelected > 0 ? ` (${totalSelected})` : ""}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
          {(["friends", "groups"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setTab(t)}
            >
              <Text style={{ color: tab === t ? colors.primary : colors.mutedForeground, fontWeight: "600", textTransform: "capitalize" }}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* List */}
        {tab === "friends" ? (
          <FlatList
            data={friends}
            keyExtractor={(f) => f.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.mutedForeground }]}>No friends yet</Text>
            }
            renderItem={({ item }) => {
              const checked = selectedFriends.has(item.id);
              return (
                <TouchableOpacity
                  style={[styles.row, { borderBottomColor: colors.border }]}
                  onPress={() => toggleFriend(item.id)}
                >
                  <Avatar name={item.fullName} size={40} />
                  <Text style={[styles.name, { color: colors.foreground }]}>{item.fullName}</Text>
                  <View style={[styles.check, { borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primary : "transparent" }]}>
                    {checked && <Feather name="check" size={14} color="#fff" />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        ) : (
          <FlatList
            data={myGroups}
            keyExtractor={(g) => g.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.mutedForeground }]}>No groups yet</Text>
            }
            renderItem={({ item }) => {
              const checked = selectedGroups.has(item.id);
              return (
                <TouchableOpacity
                  style={[styles.row, { borderBottomColor: colors.border }]}
                  onPress={() => toggleGroup(item.id)}
                >
                  <View style={[styles.groupIcon, { backgroundColor: colors.accent }]}>
                    <Feather name="users" size={18} color={colors.primary} />
                  </View>
                  <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                  <View style={[styles.check, { borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primary : "transparent" }]}>
                    {checked && <Feather name="check" size={14} color="#fff" />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  title: { flex: 1, fontSize: 18, fontWeight: "700" },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12 },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  empty: { textAlign: "center", marginTop: 40, fontSize: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  groupIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  name: { flex: 1, fontSize: 15, fontWeight: "500" },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
