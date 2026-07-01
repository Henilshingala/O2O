import { router, useLocalSearchParams } from "@/compat/router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import * as Haptics from "@/compat/haptics";
import { launchImageLibrary } from "react-native-image-picker";
import { Avatar } from "@/components/ui/Avatar";
import { ChatBubble } from "@/components/ChatBubble";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { customFetch } from "@workspace/api-client-react";
import type { Chat, Message } from "@/types";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getUserById } = useAuth();
  const { getChat, sendChatMessage, createChat } = useData();
  const params = useLocalSearchParams<{ id: string; otherId?: string }>();
  const [text, setText] = useState("");
  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(false);
  const [olderMessages, setOlderMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const flatRef = useRef<FlatList>(null);

  const existingChat = getChat(params.id);

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
    if (existingChat) setChat(existingChat);
  }, [existingChat]);

  useEffect(() => {
    setOlderMessages([]);
    if (!chat?.id) {
      setNextCursor(null);
      return;
    }
    if (chat.messages.length >= 50) {
      const oldest = chat.messages[0];
      setNextCursor(oldest?.id ?? null);
    } else {
      setNextCursor(null);
    }
  }, [chat?.id, chat?.messages.length]);

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
  const mergedMessages = [...chat.messages, ...olderMessages].reduce<Message[]>((acc, msg) => {
    if (!acc.some((m) => m.id === msg.id)) acc.push(msg);
    return acc;
  }, []).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const messages = [...mergedMessages].reverse();

  const loadOlderMessages = async () => {
    if (!chat || loadingMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await customFetch<{ messages: Message[]; nextCursor: string | null }>(
        `/api/data/chats/${chat.id}/messages?limit=50&cursor=${nextCursor}`
      );
      setOlderMessages((prev) => {
        const combined = [...data.messages, ...prev];
        return combined.filter((msg, idx) => combined.findIndex((m) => m.id === msg.id) === idx);
      });
      setNextCursor(data.nextCursor);
    } catch (e) {
      console.error("Load older messages error", e);
    } finally {
      setLoadingMore(false);
    }
  };

  const send = () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendChatMessage(chat.id, {
      senderId: user.id,
      text: text.trim(),
      timestamp: new Date().toISOString(),
      type: "text",
    } as any);
    setText("");
  };

  const sendImage = async () => {
    try {
      const response = await launchImageLibrary({ mediaType: "photo", quality: 0.8 });
      if (!response.assets?.[0]) return;
      const asset = response.assets[0];
      const formData = new FormData();
      formData.append("file", {
        uri: Platform.OS === "android" && !asset.uri?.startsWith("file://") ? `file://${asset.uri}` : asset.uri,
        type: asset.type || "image/jpeg",
        name: asset.fileName || "upload.jpg",
      } as any);
      const data = await customFetch<any>("/api/upload", { method: "POST", body: formData });
      sendChatMessage(chat.id, {
        senderId: user.id,
        text: data.url,
        timestamp: new Date().toISOString(),
        type: "image",
        metadata: { url: data.url },
      } as any);
    } catch (e) {
      console.error("Image send error", e);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      {/* Header */}
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
        ref={flatRef}
        data={messages}
        inverted
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onEndReached={loadOlderMessages}
        onEndReachedThreshold={0.2}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ padding: 12 }} /> : null}
        renderItem={({ item }) => (
          item.type === "image" ? (
            <View style={[styles.imageMsg, item.senderId === user.id ? styles.imageMine : styles.imageTheirs]}>
              <Image source={{ uri: resolveMediaUrl(String(item.metadata?.url || item.text)) }} style={styles.chatImage} />
            </View>
          ) : (
            <ChatBubble
              text={item.text}
              timestamp={item.timestamp}
              isMine={item.senderId === user.id}
              senderName={item.senderId === user.id ? undefined : other?.fullName}
            />
          )
        )}
      />

      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Platform.OS === "web" ? 20 : insets.bottom + 8,
          },
        ]}
      >
        <TouchableOpacity onPress={sendImage} style={styles.attachBtn}>
          <Feather name="image" size={20} color={colors.mutedForeground} />
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
  messageList: { padding: 16, gap: 8 },
  imageMsg: { marginVertical: 4, maxWidth: "75%" },
  imageMine: { alignSelf: "flex-end" },
  imageTheirs: { alignSelf: "flex-start" },
  chatImage: { width: 200, height: 200, borderRadius: 12 },
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
    borderRadius: 20,
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
});
