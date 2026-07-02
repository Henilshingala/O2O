import { router, useLocalSearchParams } from "@/compat/router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import * as Haptics from "@/compat/haptics";
import { Avatar } from "@/components/ui/Avatar";
import { ChatAttachMenu } from "@/components/ChatAttachMenu";
import { MessageContent } from "@/components/MessageContent";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useColors } from "@/hooks/useColors";
import type { Chat, Message } from "@/types";

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getUserById } = useAuth();
  const { getChat, sendChatMessage, createChat, chats } = useData();
  const params = useLocalSearchParams<{ id: string; otherId?: string }>();
  const [text, setText] = useState("");
  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  const existingChat = getChat(params.id) || chats.find((c) => c.id === params.id);

  useEffect(() => {
    if (existingChat) {
      setChat(existingChat);
      return;
    }
    if (params.otherId && user) {
      setLoading(true);
      createChat(user.id, params.otherId)
        .then(setChat)
        .finally(() => setLoading(false));
    }
  }, [existingChat, params.id, params.otherId, user, createChat]);

  useEffect(() => {
    if (existingChat && chat?.id !== existingChat.id) {
      setChat(existingChat);
    }
  }, [existingChat?.messages.length, existingChat?.id]);

  const { displayMessages, sendMessage, loadOlderMessages, loadingMore } = useRealtimeMessages({
    roomType: "chat",
    roomId: chat?.id,
    initialMessages: chat?.messages ?? [],
    queryKey: ["chats"],
    onSend: (msg) => sendChatMessage(chat!.id, { ...msg, chatId: chat!.id }),
  });

  if (!user) return null;
  if (loading || !chat) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const otherId = chat.participants.find((p) => p !== user.id)!;
  const other = getUserById(otherId);

  const send = () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage({
      senderId: user.id,
      text: text.trim(),
      timestamp: new Date().toISOString(),
      type: "text",
      chatId: chat.id,
    });
    setText("");
  };

  const handleSendPoll = () => {
    if (!pollQuestion.trim() || pollOptions.some((o) => !o.trim())) return;
    sendMessage({
      senderId: user.id,
      text: pollQuestion,
      timestamp: new Date().toISOString(),
      type: "poll",
      chatId: chat.id,
      metadata: { options: pollOptions.filter((o) => o.trim()).map((t) => ({ text: t, votes: [] })) },
    });
    setShowPollModal(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior="padding" keyboardVerticalOffset={0}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Avatar name={other?.fullName ?? "?"} size={36} />
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.foreground }]}>{other?.fullName ?? "Unknown"}</Text>
        </View>
      </View>

      <FlatList
        data={displayMessages}
        inverted
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onEndReached={loadOlderMessages}
        onEndReachedThreshold={0.2}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ padding: 12 }} /> : null}
        renderItem={({ item }) => (
          <MessageContent
            item={item}
            isMine={item.senderId === user.id}
            senderName={item.senderId !== user.id ? other?.fullName : undefined}
          />
        )}
      />

      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Platform.OS === "web" ? 20 : insets.bottom + 8 }]}>
        <TouchableOpacity onPress={() => setShowAttachMenu(!showAttachMenu)} style={styles.attachBtn}>
          <Feather name="plus" size={24} color={colors.primary} />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted }]}
          value={text}
          onChangeText={setText}
          placeholder="Message..."
          placeholderTextColor={colors.mutedForeground}
          multiline
        />
        <TouchableOpacity onPress={send} style={[styles.sendBtn, { backgroundColor: colors.primary }]}>
          <Feather name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <ChatAttachMenu
        visible={showAttachMenu}
        onClose={() => setShowAttachMenu(false)}
        senderId={user.id}
        bottomInset={insets.bottom + 16}
        onShowPoll={() => setShowPollModal(true)}
        onSend={(msg) => sendMessage({ ...msg, chatId: chat.id })}
      />

      <Modal visible={showPollModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Create Poll</Text>
            <TextInput
              style={[styles.pollInput, { color: colors.foreground, backgroundColor: colors.muted }]}
              placeholder="Ask a question..."
              placeholderTextColor={colors.mutedForeground}
              value={pollQuestion}
              onChangeText={setPollQuestion}
            />
            {pollOptions.map((opt, idx) => (
              <TextInput
                key={idx}
                style={[styles.pollInput, { color: colors.foreground, backgroundColor: colors.muted, marginTop: 8 }]}
                placeholder={`Option ${idx + 1}`}
                placeholderTextColor={colors.mutedForeground}
                value={opt}
                onChangeText={(val) => {
                  const newOpts = [...pollOptions];
                  newOpts[idx] = val;
                  setPollOptions(newOpts);
                }}
              />
            ))}
            <TouchableOpacity onPress={() => setPollOptions([...pollOptions, ""])}>
              <Text style={{ color: colors.primary, marginTop: 12, fontWeight: "600" }}>+ Add Option</Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowPollModal(false)} style={[styles.modalBtn, { backgroundColor: colors.muted }]}>
                <Text style={{ color: colors.foreground }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSendPoll} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: "#fff" }}>Send Poll</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  backBtn: { marginRight: 4 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: "700" },
  messageList: { padding: 16, gap: 8 },
  attachBtn: { padding: 8 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, gap: 8 },
  input: { flex: 1, minHeight: 42, maxHeight: 120, borderRadius: 21, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modalContent: { padding: 20, borderRadius: 16 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  pollInput: { padding: 12, borderRadius: 8 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 24 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
});
