import { router, useLocalSearchParams } from "@/compat/router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import * as Haptics from "@/compat/haptics";
import { Avatar } from "@/components/ui/Avatar";
import { ChatAttachMenu, type ChatAttachMenuHandle } from "@/components/ChatAttachMenu";
import { MessageContent } from "@/components/MessageContent";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useColors } from "@/hooks/useColors";
import type { Chat, Message } from "@/types";

const LOG = (step: string, data?: any) =>
  console.log(`[ChatScreen] ${step}`, data !== undefined ? JSON.stringify(data) : "");

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
  const attachMenuRef = useRef<ChatAttachMenuHandle>(null);

  // Track upload placeholders: tempId → local progress/state so we can update them
  const uploadPlaceholders = useRef<
    Map<string, { progress: any; failed: boolean; cancelled: boolean }>
  >(new Map());

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

  const { displayMessages, sendMessage, loadOlderMessages, loadingMore, setMessages } =
    useRealtimeMessages({
      roomType: "chat",
      roomId: chat?.id,
      initialMessages: chat?.messages ?? [],
      queryKey: ["chats"],
      onSend: (msg) => {
        if (chat) return sendChatMessage(chat.id, { ...msg, chatId: chat.id });
        return Promise.reject(new Error("No active chat"));
      },
    });

  // ── ChatAttachMenu callbacks ──────────────────────────────────────────────

  /** Insert a "sending" placeholder into the FlatList immediately */
  const handleSendPlaceholder = useCallback(
    (tempId: string, msg: Omit<Message, "id">) => {
      uploadPlaceholders.current.set(tempId, {
        progress: null,
        failed: false,
        cancelled: false,
      });
      setMessages((prev) => [
        { ...msg, id: tempId, status: "sending" as const },
        ...prev,
      ]);
    },
    [setMessages]
  );

  /**
   * Handle resolution events from ChatAttachMenu:
   * - Progress updates: encoded as __progress__{...json}
   * - Success: a real URL → swap placeholder for real message
   * - Error: { error: string } → mark as failed
   */
  const handleResolvePlaceholder = useCallback(
    (tempId: string, result: { url: string } | { error: string }) => {
      if ("error" in result) {
        // Mark as failed
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  status: "failed" as const,
                  metadata: { ...m.metadata, uploading: false, uploadError: result.error },
                }
              : m
          )
        );
        return;
      }

      // Progress update
      if (result.url && typeof result.url === "string" && result.url.startsWith("__progress__")) {
        try {
          const progress = JSON.parse(result.url.slice("__progress__".length));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    metadata: {
                      ...m.metadata,
                      uploading: true,
                      url: `__progress__${JSON.stringify(progress)}`,
                    },
                  }
                : m
            )
          );
        } catch {/* ignore */}
        return;
      }

      // Real URL → upload done, swap placeholder out
      console.log(`[PLACEHOLDER_REMOVED] tempId=${tempId}`);
      setMessages((prev) =>
        prev.filter((m) => m.id !== tempId)
      );
    },
    [setMessages]
  );

  /**
   * Called by ChatAttachMenu AFTER the upload completes.
   * We bypass the hook's sendMessage() (which would add a second optimistic entry)
   * and call sendChatMessage directly. The socket event will deliver the real message
   * to both participants and the useRealtimeMessages hook will render it.
   */
  const handleAttachSend = useCallback(
    async (msg: Omit<Message, "id">) => {
      if (!chat) {
        LOG("handleAttachSend: no active chat, dropping message");
        return;
      }
      try {
        console.log(`[MESSAGE_CREATE_REQUEST] POSTing message to backend`, { chatId: chat.id, type: msg.type });
        LOG("handleAttachSend: POSTing message to backend", {
          chatId: chat.id,
          type: msg.type,
          hasUrl: !!(msg.metadata as any)?.url,
        });
        const saved = await sendChatMessage(chat.id, { ...msg, chatId: chat.id });
        console.log(`[MESSAGE_CREATE_RESPONSE] received from backend`, { id: saved.id });
        LOG("handleAttachSend: message saved", { id: saved.id });
        // Insert the saved message into local state so sender sees it immediately
        // (socket will also deliver it, deduplication is handled by useRealtimeMessages)
        console.log(`[MESSAGE_SAVED] inserted into local state`);
        setMessages((prev) => {
          if (prev.some((m) => m.id === saved.id)) return prev;
          return [{ ...saved, status: "sent" as const }, ...prev];
        });
      } catch (err: any) {
        LOG("handleAttachSend: FAILED", err?.message);
        // Surface error in UI briefly — the placeholder was already removed by
        // onResolvePlaceholder, so we add a failed sentinel entry
        const errorMsg: Message = {
          ...msg,
          id: `err_${Date.now()}`,
          status: "failed" as const,
          chatId: chat.id,
          metadata: { ...(msg.metadata as any), uploadError: err?.message ?? "Send failed" },
        };
        setMessages((prev) => [errorMsg, ...prev]);
      }
    },
    [sendChatMessage, chat, setMessages]
  );

  /** Retry a failed upload — resets the placeholder and re-runs the original upload */
  const handleRetryUpload = useCallback(
    (failedId: string) => {
      // Only flip the UI back to "sending" if a retry attempt actually starts
      // (attachMenuRef won't have anything to retry, or may already have one
      // in flight, in which case we leave the failed state as-is).
      const started = attachMenuRef.current?.retry(failedId) ?? false;
      if (!started) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedId
            ? {
                ...m,
                status: "sending" as const,
                metadata: { ...m.metadata, uploading: true, uploadError: undefined },
              }
            : m
        )
      );
    },
    [setMessages]
  );

  if (!user) return null;
  if (loading || !chat) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const otherId = chat.participants.find((p) => p !== user.id) ?? "";
  const other = otherId ? getUserById(otherId) : undefined;

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
      metadata: {
        options: pollOptions.filter((o) => o.trim()).map((t) => ({ text: t, votes: [] })),
      },
    });
    setShowPollModal(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]}>
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Avatar name={other?.fullName ?? "?"} size={36} />
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.foreground }]}>
            {other?.fullName ?? "Unknown"}
          </Text>
        </View>
      </View>

      <FlatList
        data={displayMessages}
        inverted
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onEndReached={loadOlderMessages}
        onEndReachedThreshold={0.2}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={colors.primary} style={{ padding: 12 }} />
          ) : null
        }
        renderItem={({ item }) => (
          <MessageContent
            item={item}
            isMine={item.senderId === user.id}
            senderName={item.senderId !== user.id ? other?.fullName : undefined}
            onRetryUpload={handleRetryUpload}
          />
        )}
      />

      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => setShowAttachMenu(!showAttachMenu)}
          style={styles.attachBtn}
        >
          <Feather name="plus" size={24} color={colors.primary} />
        </TouchableOpacity>
        <TextInput
          style={[
            styles.input,
            { color: colors.foreground, backgroundColor: colors.muted },
          ]}
          value={text}
          onChangeText={setText}
          placeholder="Message..."
          placeholderTextColor={colors.mutedForeground}
          multiline
        />
        <TouchableOpacity
          onPress={send}
          style={[styles.sendBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <ChatAttachMenu
        ref={attachMenuRef}
        visible={showAttachMenu}
        onClose={() => setShowAttachMenu(false)}
        senderId={user.id}
        chatId={chat.id}
        bottomInset={insets.bottom + 16}
        onShowPoll={() => setShowPollModal(true)}
        onSend={handleAttachSend}
        onSendPlaceholder={handleSendPlaceholder}
        onResolvePlaceholder={handleResolvePlaceholder}
      />

      <Modal visible={showPollModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Create Poll
            </Text>
            <TextInput
              style={[
                styles.pollInput,
                { color: colors.foreground, backgroundColor: colors.muted },
              ]}
              placeholder="Ask a question..."
              placeholderTextColor={colors.mutedForeground}
              value={pollQuestion}
              onChangeText={setPollQuestion}
            />
            {pollOptions.map((opt, idx) => (
              <TextInput
                key={idx}
                style={[
                  styles.pollInput,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.muted,
                    marginTop: 8,
                  },
                ]}
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
              <Text style={{ color: colors.primary, marginTop: 12, fontWeight: "600" }}>
                + Add Option
              </Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowPollModal(false)}
                style={[styles.modalBtn, { backgroundColor: colors.muted }]}
              >
                <Text style={{ color: colors.foreground }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSendPoll}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              >
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: { marginRight: 4 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: "700" },
  messageList: { padding: 8, gap: 4 },
  attachBtn: { padding: 8 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: { padding: 20, borderRadius: 16 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  pollInput: { padding: 12, borderRadius: 8 },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 24,
  },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
});
