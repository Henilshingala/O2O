import { router, useLocalSearchParams } from "@/compat/router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Share,
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
import { SelectionToolbar } from "@/components/SelectionToolbar";
import { ForwardModal } from "@/components/ForwardModal";
import { MessageInfoModal } from "@/components/MessageInfoModal";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useColors } from "@/hooks/useColors";
import type { Chat, Message } from "@/types";

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getUserById } = useAuth();
  const { getChat, sendChatMessage, createChat, chats, deleteMessage, voteOnPoll, markRoomRead } = useData();
  const params = useLocalSearchParams<{ id: string; otherId?: string }>();

  const [text, setText] = useState("");
  const [chat, setChat] = useState<Chat | null>(null);
  const chatRef = useRef<Chat | null>(null);
  const [loading, setLoading] = useState(false);

  // Attach menu / poll
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const attachMenuRef = useRef<ChatAttachMenuHandle>(null);

  // Selection mode
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectionMode = selectedIds.size > 0;

  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [infoMessage, setInfoMessage] = useState<Message | null>(null);

  const uploadPlaceholders = useRef<
    Map<string, { progress: any; failed: boolean; cancelled: boolean }>
  >(new Map());

  const existingChat = getChat(params.id) || chats.find((c) => c.id === params.id);
  chatRef.current = chat;

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

  const queryKey = useMemo(() => ["chats"], []);
  const { displayMessages, sendMessage, loadOlderMessages, loadingMore, setMessages } =
    useRealtimeMessages({
      roomType: "chat",
      roomId: chat?.id,
      initialMessages: chat?.messages ?? [],
      queryKey,
      onSend: (msg) => {
        const c = chatRef.current;
        if (c) return sendChatMessage(c.id, { ...msg, chatId: c.id });
        return Promise.reject(new Error("No active chat"));
      },
    });

  // Mark as read when chat opens / when messages arrive
  useEffect(() => {
    if (chat?.id) {
      markRoomRead("chat", chat.id);
    }
  }, [chat?.id, displayMessages.length]);

  // ── Placeholder callbacks ─────────────────────────────────────────────────
  const handleSendPlaceholder = useCallback(
    (tempId: string, msg: Omit<Message, "id">) => {
      uploadPlaceholders.current.set(tempId, { progress: null, failed: false, cancelled: false });
      setMessages((prev) => [
        { ...msg, id: tempId, status: "sending" as const, metadata: { ...(msg.metadata as any), uploading: true } },
        ...prev,
      ]);
    },
    [setMessages]
  );

  const handleResolvePlaceholder = useCallback(
    (tempId: string, result: { url: string } | { error: string }) => {
      if ("error" in result) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, status: "failed" as const, metadata: { ...m.metadata, uploading: false, uploadError: result.error } }
              : m
          )
        );
        return;
      }
      if (result.url?.startsWith("__progress__")) {
        try {
          const progress = JSON.parse(result.url.slice("__progress__".length));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? { ...m, metadata: { ...m.metadata, uploading: true, url: `__progress__${JSON.stringify(progress)}` } }
                : m
            )
          );
        } catch {}
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, status: "sending" as const, metadata: { ...m.metadata, uploading: false, url: result.url } }
            : m
        )
      );
    },
    [setMessages]
  );

  const handleAttachSend = useCallback(
    async (msg: Omit<Message, "id">, tempId?: string) => {
      const currentChat = chatRef.current;
      if (!currentChat) return;
      const payload = { ...msg, chatId: currentChat.id };
      try {
        const saved = await sendChatMessage(currentChat.id, payload);
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== tempId && m.id !== saved.id);
          return [{ ...saved, status: "sent" as const }, ...filtered];
        });
      } catch (err: any) {
        const errMsg = err?.message ?? "Send failed";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, status: "failed" as const, metadata: { ...m.metadata, uploading: false, uploadError: errMsg } }
              : m
          )
        );
      }
    },
    [sendChatMessage, setMessages]
  );

  const handleRetryUpload = useCallback(
    (failedId: string) => {
      const started = attachMenuRef.current?.retry(failedId) ?? false;
      if (!started) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedId
            ? { ...m, status: "sending" as const, metadata: { ...m.metadata, uploading: true, uploadError: undefined } }
            : m
        )
      );
    },
    [setMessages]
  );

  // ── Selection handlers ────────────────────────────────────────────────────
  const handleLongPress = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleCancelSelection = useCallback(() => setSelectedIds(new Set()), []);

  // ── Action handlers ───────────────────────────────────────────────────────
  const selectedMessages = useMemo(
    () => displayMessages.filter((m) => selectedIds.has(m.id)),
    [displayMessages, selectedIds]
  );

  const handleDelete = useCallback(() => setShowDeleteModal(true), []);

  const confirmDelete = useCallback(async (forEveryone: boolean) => {
    if (!chat) return;
    setShowDeleteModal(false);
    const ids = [...selectedIds];
    handleCancelSelection();
    for (const id of ids) {
      if (forEveryone) {
        // Optimistic: mark as deleted locally
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, text: "Message deleted", type: "text" as const, metadata: {}, deletedAt: new Date().toISOString() } : m
          )
        );
      } else {
        // Delete for me: hide locally
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, metadata: { ...m.metadata, deletedForMe: true } } : m
          )
        );
      }
      try {
        await deleteMessage(id, "chat", chat.id, forEveryone);
      } catch (e) {
        console.error("Delete failed:", e);
      }
    }
  }, [chat, selectedIds, deleteMessage, setMessages, handleCancelSelection]);

  const handleForward = useCallback(() => setShowForwardModal(true), []);

  const handleShare = useCallback(async () => {
    const urls = selectedMessages
      .flatMap((m) => {
        const url = m.metadata?.url as string | undefined;
        if (url) return [url];
        const urls = m.metadata?.urls as string[] | undefined;
        return urls ?? [];
      })
      .filter(Boolean);
    if (urls.length === 0) return;
    try {
      await Share.share({ message: urls.join("\n") });
    } catch {}
    handleCancelSelection();
  }, [selectedMessages, handleCancelSelection]);

  const handleCopy = useCallback(async () => {
    const text = selectedMessages
      .filter((m) => !m.type || m.type === "text")
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((m) => m.text)
      .join("\n");
    try {
      await Share.share({ message: text });
    } catch {}
    handleCancelSelection();
  }, [selectedMessages, handleCancelSelection]);

  const handleInfo = useCallback(() => {
    if (selectedMessages.length === 1) {
      setInfoMessage(selectedMessages[0]);
      handleCancelSelection();
    }
  }, [selectedMessages, handleCancelSelection]);

  const handlePollVote = useCallback(
    async (messageId: string, optionIndex: number) => {
      if (!chat || !user) return;
      // Optimistic update
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const meta: any = { ...m.metadata };
          const options = [...(meta.options || [])] as { text: string; votes: string[] }[];
          const opt = options[optionIndex];
          if (!opt || opt.votes.includes(user.id)) return m;
          options[optionIndex] = { ...opt, votes: [...opt.votes, user.id] };
          return { ...m, metadata: { ...meta, options } };
        })
      );
      try {
        await voteOnPoll(messageId, "chat", chat.id, optionIndex);
      } catch (e) {
        console.error("Poll vote failed:", e);
      }
    },
    [chat, user, voteOnPoll, setMessages]
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
      {/* Header — changes to SelectionToolbar in selection mode */}
      {selectionMode ? (
        <SelectionToolbar
          selected={selectedMessages}
          onCancel={handleCancelSelection}
          onDelete={handleDelete}
          onForward={handleForward}
          onShare={handleShare}
          onCopy={handleCopy}
          onInfo={handleInfo}
        />
      ) : (
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
      )}

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
        renderItem={({ item }) => {
          // Hide "delete for me" messages
          if (item.metadata?.deletedForMe === true) return null;
          
          console.log(
            "[TRACE]",
            "artifacts/o2o/app/chat/[id].tsx",
            item.id,
            item.type,
            item.senderId,
            user.id,
            item.senderId === user.id
          );

          return (
            <MessageContent
              item={item}
              isMine={item.senderId === user.id}
              senderName={item.senderId !== user.id ? other?.fullName : undefined}
              onRetryUpload={handleRetryUpload}
              onPollVote={handlePollVote}
              onLongPress={() => handleLongPress(item.id)}
              onPress={() => handleToggleSelect(item.id)}
              selected={selectedIds.has(item.id)}
              selectionMode={selectionMode}
            />
          );
        }}
      />

      {/* Input bar — hidden in selection mode */}
      {!selectionMode && (
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
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted }]}
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
      )}

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

      {/* Poll creation modal */}
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

      {/* Delete confirmation modal */}
      <Modal visible={showDeleteModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Delete {selectedIds.size} message{selectedIds.size !== 1 ? "s" : ""}?
            </Text>
            <TouchableOpacity
              style={[styles.deleteOption, { borderBottomColor: colors.border }]}
              onPress={() => confirmDelete(false)}
            >
              <Feather name="eye-off" size={18} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontSize: 15 }}>Delete for me</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteOption}
              onPress={() => confirmDelete(true)}
            >
              <Feather name="trash-2" size={18} color="#EF4444" />
              <Text style={{ color: "#EF4444", fontSize: 15 }}>Delete for everyone</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.muted, marginTop: 12, alignSelf: "flex-end" }]}
              onPress={() => setShowDeleteModal(false)}
            >
              <Text style={{ color: colors.foreground }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Forward modal */}
      <ForwardModal
        visible={showForwardModal}
        messages={selectedMessages}
        onClose={() => setShowForwardModal(false)}
        onDone={() => {
          setShowForwardModal(false);
          handleCancelSelection();
        }}
      />

      {/* Message info modal */}
      <MessageInfoModal
        visible={!!infoMessage}
        message={infoMessage}
        senderName={
          infoMessage?.senderId === user.id
            ? "You"
            : infoMessage?.senderId
              ? (getUserById(infoMessage.senderId)?.fullName ?? "Unknown")
              : undefined
        }
        onClose={() => setInfoMessage(null)}
      />
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
  deleteOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
