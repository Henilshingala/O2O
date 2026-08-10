import { router, useLocalSearchParams } from "@/compat/router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { EmojiKeyboard, type EmojiType } from "rn-emoji-keyboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import * as Haptics from "@/compat/haptics";
import { ChatAttachMenu, type ChatAttachMenuHandle } from "@/components/ChatAttachMenu";
import { MessageContent } from "@/components/MessageContent";
import { SelectionToolbar } from "@/components/SelectionToolbar";
import { ForwardModal } from "@/components/ForwardModal";
import { MessageInfoModal } from "@/components/MessageInfoModal";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useSocket } from "@/context/SocketContext";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useColors } from "@/hooks/useColors";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import type { Message } from "@/types";

export default function GroupChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getUserById } = useAuth();
  const { getGroup, sendGroupMessage, deleteMessage, voteOnPoll, markRoomRead } = useData();
  const socketContext = useSocket();
  const params = useLocalSearchParams<{ id: string }>();

  const [text, setText] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectionMode = selectedIds.size > 0;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [infoMessage, setInfoMessage] = useState<Message | null>(null);

  // Emoji keyboard
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Poll creation
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  const attachMenuRef = useRef<ChatAttachMenuHandle>(null);
  const uploadPlaceholders = useRef<Map<string, any>>(new Map());

  const group = getGroup(params.id);

  // Back handler dismisses emoji picker first
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showEmojiPicker) { setShowEmojiPicker(false); return true; }
      return false;
    });
    return () => sub.remove();
  }, [showEmojiPicker]);

  const toggleEmojiPicker = () => {
    if (showEmojiPicker) {
      setShowEmojiPicker(false);
    } else {
      Keyboard.dismiss();
      setShowEmojiPicker(true);
    }
  };

  const handleEmojiSelect = (emojiObj: EmojiType) => {
    const emoji = emojiObj.emoji;
    setText((prev) => {
      const before = prev.slice(0, cursorPosition);
      const after = prev.slice(cursorPosition);
      return before + emoji + after;
    });
    setCursorPosition((prev) => prev + emoji.length);
  };

  // ── All hooks must be called before any conditional returns ───────────────
  const { displayMessages, sendMessage, loadOlderMessages, loadingMore, setMessages } = useRealtimeMessages({
    roomType: "group",
    roomId: group?.id,
    initialMessages: group?.messages ?? [],
    queryKey: ["groups"],
    onSend: (msg) => sendGroupMessage(group!.id, { ...msg, groupId: group!.id }),
  });

  // Mark as read on enter and when messages arrive
  useEffect(() => {
    if (group?.id) markRoomRead("group", group.id);
  }, [group?.id, displayMessages.length]);

  // Set active room for SocketContext to handle incoming messages/read-receipts
  useEffect(() => {
    if (group?.id) {
      socketContext?.setActiveRoom("group", group.id);
      return () => {
        socketContext?.setActiveRoom(null, null);
      };
    }
  }, [group?.id, socketContext]);

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
      if (!group) return;
      const payload = { ...msg, groupId: group.id };
      try {
        const saved = await sendGroupMessage(group.id, payload);
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
    [group, sendGroupMessage, setMessages]
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
    setSelectedIds((prev) => { const s = new Set(prev); s.add(id); return s; });
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }, []);

  const handleCancelSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectedMessages = useMemo(
    () => displayMessages.filter((m) => selectedIds.has(m.id)),
    [displayMessages, selectedIds]
  );

  const confirmDelete = useCallback(async (forEveryone: boolean) => {
    if (!group) return;
    setShowDeleteModal(false);
    const ids = [...selectedIds];
    handleCancelSelection();
    for (const id of ids) {
      if (forEveryone) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, text: "Message deleted", type: "text" as const, metadata: {}, deletedAt: new Date().toISOString() } : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, metadata: { ...m.metadata, deletedForMe: true } } : m
          )
        );
      }
      try {
        await deleteMessage(id, "group", group.id, forEveryone);
      } catch {}
    }
  }, [group, selectedIds, deleteMessage, setMessages, handleCancelSelection]);

  const handleShare = useCallback(async () => {
    const urls = selectedMessages
      .flatMap((m) => {
        const u = m.metadata?.url as string | undefined;
        if (u) return [u];
        return (m.metadata?.urls as string[] | undefined) ?? [];
      })
      .filter(Boolean);
    if (urls.length === 0) return;
    try { await Share.share({ message: urls.join("\n") }); } catch {}
    handleCancelSelection();
  }, [selectedMessages, handleCancelSelection]);

  const handleCopy = useCallback(async () => {
    const t = selectedMessages
      .filter((m) => !m.type || m.type === "text")
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((m) => m.text)
      .join("\n");
    try { await Share.share({ message: t }); } catch {}
    handleCancelSelection();
  }, [selectedMessages, handleCancelSelection]);

  const handlePollVote = useCallback(
    async (messageId: string, optionIndex: number) => {
      if (!group || !user) return;
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
        await voteOnPoll(messageId, "group", group.id, optionIndex);
      } catch {}
    },
    [group, user, voteOnPoll, setMessages]
  );

  // ── Poll send ─────────────────────────────────────────────────────────────
  const handleSendPoll = () => {
    if (!group || !user) return;
    const validOptions = pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim() || validOptions.length < 2) return;
    setShowPollModal(false);
    sendMessage({
      senderId: user.id,
      text: pollQuestion.trim(),
      timestamp: new Date().toISOString(),
      type: "poll",
      groupId: group.id,
      metadata: {
        question: pollQuestion.trim(),
        options: validOptions.map((o) => ({ text: o.trim(), votes: [] })),
      },
    });
    setPollQuestion("");
    setPollOptions(["", ""]);
  };

  // ── Guard: show loader until group is available ───────────────────────────
  if (!user) return null;
  if (!group) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const send = () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage({
      senderId: user.id,
      text: text.trim(),
      timestamp: new Date().toISOString(),
      type: "text",
      groupId: group.id,
    });
    setText("");
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      {selectionMode ? (
        <SelectionToolbar
          selected={selectedMessages}
          onCancel={handleCancelSelection}
          onDelete={() => setShowDeleteModal(true)}
          onForward={() => setShowForwardModal(true)}
          onShare={handleShare}
          onCopy={handleCopy}
          onInfo={() => {
            if (selectedMessages.length === 1) {
              setInfoMessage(selectedMessages[0]);
              handleCancelSelection();
            }
          }}
        />
      ) : (
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerCenter}
            onPress={() => router.push({ pathname: "/group/info", params: { id: group.id } })}
          >
            {group.image ? (
              <Image source={{ uri: resolveMediaUrl(group.image) }} style={styles.groupAvatarImg} />
            ) : (
              <View style={[styles.groupAvatar, { backgroundColor: colors.accent }]}>
                <Feather name="users" size={18} color={colors.primary} />
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={[styles.headerName, { color: colors.foreground }]}>{group.name}</Text>
              <Text style={[styles.memberCount, { color: colors.mutedForeground }]}>{group.members.length} members</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push({ pathname: "/group/info", params: { id: group.id } })}>
            <Feather name="more-vertical" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={displayMessages}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.messages}
        onEndReached={loadOlderMessages}
        onEndReachedThreshold={0.2}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ padding: 12 }} /> : null}
        renderItem={({ item }) => {
          if (item.metadata?.deletedForMe === true) return null;
          const sender = getUserById(item.senderId);
          return (
            <MessageContent
              item={item}
              isMine={item.senderId === user.id}
              senderName={item.senderId !== user.id ? (sender?.fullName ?? "Unknown") : undefined}
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

      {!selectionMode && (
        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity onPress={() => setShowAttachMenu(!showAttachMenu)} style={styles.attachBtn}>
            <Feather name="plus" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleEmojiPicker} style={styles.attachBtn}>
            <Feather name={showEmojiPicker ? "keyboard" : "smile"} size={22} color={colors.primary} />
          </TouchableOpacity>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.muted, color: colors.foreground }]}
            value={text}
            onChangeText={setText}
            placeholder="Message..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={1000}
            onFocus={() => { if (showEmojiPicker) setShowEmojiPicker(false); }}
            onSelectionChange={(e) => setCursorPosition(e.nativeEvent.selection.start)}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.muted }]}
            onPress={send}
            disabled={!text.trim()}
          >
            <Feather name="send" size={18} color={text.trim() ? "#fff" : colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      {showEmojiPicker && !selectionMode && (
        <View style={{ height: 360, backgroundColor: colors.card }}>
          <EmojiKeyboard
            onEmojiSelected={handleEmojiSelect}
            enableSearchBar
            enableRecentlyUsed
            allowMultipleSelections
            theme={{
              container: colors.card,
              header: colors.foreground,
              knob: colors.card,
              category: {
                icon: colors.mutedForeground,
                iconActive: colors.primary,
                container: colors.card,
                containerActive: colors.muted,
              },
              search: {
                text: colors.foreground,
                placeholder: colors.mutedForeground,
                icon: colors.mutedForeground,
                background: colors.muted,
              },
            }}
            styles={{ container: { paddingBottom: insets.bottom } }}
          />
        </View>
      )}

      <ChatAttachMenu
        ref={attachMenuRef}
        visible={showAttachMenu}
        onClose={() => setShowAttachMenu(false)}
        senderId={user.id}
        groupId={group.id}
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

      {/* Delete modal */}
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
              style={[styles.cancelBtn, { backgroundColor: colors.muted }]}
              onPress={() => setShowDeleteModal(false)}
            >
              <Text style={{ color: colors.foreground }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ForwardModal
        visible={showForwardModal}
        messages={selectedMessages}
        onClose={() => setShowForwardModal(false)}
        onDone={() => { setShowForwardModal(false); handleCancelSelection(); }}
      />

      <MessageInfoModal
        visible={!!infoMessage}
        message={infoMessage}
        senderName={
          infoMessage?.senderId === user.id
            ? "You"
            : getUserById(infoMessage?.senderId ?? "")?.fullName
        }
        onClose={() => setInfoMessage(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  groupAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  groupAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 15, fontWeight: "700" },
  memberCount: { fontSize: 12, marginTop: 2 },
  messages: { paddingVertical: 12, paddingHorizontal: 8 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, gap: 8 },
  attachBtn: { padding: 4, marginBottom: 4 },
  textInput: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modalContent: { padding: 20, borderRadius: 16 },
  modalTitle: { fontSize: 17, fontWeight: "700", marginBottom: 16 },
  deleteOption: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignSelf: "flex-end", marginTop: 12 },
  pollInput: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
});
