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
  Modal,
  PermissionsAndroid,
  Linking
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@/compat/vector-icons";
import * as Haptics from "@/compat/haptics";
import { launchImageLibrary, launchCamera } from "react-native-image-picker";
import Geolocation from "react-native-geolocation-service";
import { Avatar } from "@/components/ui/Avatar";
import { ChatBubble } from "@/components/ChatBubble";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { customFetch } from "@workspace/api-client-react";
import type { Chat, Message } from "@/types";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getUserById } = useAuth();
  const { getChat, sendChatMessage, createChat, chats } = useData();
  const params = useLocalSearchParams<{ id: string; otherId?: string }>();
  const [text, setText] = useState("");
  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(false);
  const [olderMessages, setOlderMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const queryClient = useQueryClient();

  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  const existingChat = getChat(params.id) || chats.find(c => c.id === params.id);

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

  // Real-time optimistic updates & socket listener
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !chat) return;
    
    socket.emit("join:chat", chat.id);
    
    const handleNewMessage = (msg: any) => {
      if (msg.chatId === chat.id) {
        setChat((prev) => {
          if (!prev) return prev;
          if (prev.messages.some(m => m.id === msg.id)) return prev; // Avoid duplicates
          return { ...prev, messages: [msg, ...prev.messages] };
        });
        // We also want to invalidate queries to keep cache fresh in background
        queryClient.invalidateQueries({ queryKey: ["chats"] });
      }
    };

    socket.on("message:new", handleNewMessage);
    return () => {
      socket.off("message:new", handleNewMessage);
      socket.emit("leave:chat", chat.id);
    };
  }, [chat?.id, queryClient]);


  useEffect(() => {
    if (!chat?.id) {
      setNextCursor(null);
      return;
    }
    if (chat.messages.length >= 50) {
      const oldest = chat.messages[chat.messages.length - 1]; // oldest is at the end of the array if sorted desc
      setNextCursor(oldest?.id ?? null);
    } else {
      setNextCursor(null);
    }
  }, [chat?.id]);

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

  const uploadAndSend = async (asset: any, type: "image" | "video") => {
    const tempId = `temp_${Date.now()}`;
    const localUri = asset.uri;
    const tempMsg: Message = {
      id: tempId,
      chatId: chat!.id,
      senderId: user.id,
      text: type === "video" ? "Video message" : "Photo message",
      type: type,
      timestamp: new Date().toISOString(),
      metadata: { url: localUri },
    } as any;
    
    // Optimistic UI update
    setChat((prev) => {
      if (!prev) return prev;
      return { ...prev, messages: [tempMsg, ...prev.messages] };
    });

    try {
      const formData = new FormData();
      formData.append("file", {
        uri: Platform.OS === "android" && !localUri?.startsWith("file://") ? `file://${localUri}` : localUri,
        type: asset.type || (type === "video" ? "video/mp4" : "image/jpeg"),
        name: asset.fileName || `upload.${type === "video" ? "mp4" : "jpg"}`,
      } as any);
      const data = await customFetch<any>("/api/upload", { method: "POST", body: formData });
      
      // Update with actual URL by sending real message to API
      sendChatMessage(chat!.id, {
        senderId: user.id,
        text: type === "video" ? "Video message" : "Photo message",
        timestamp: new Date().toISOString(),
        type: type,
        metadata: { url: data.url },
      } as any);
      
      // We remove the temp message shortly after to allow WebSocket to replace it
      setTimeout(() => {
        setChat((prev) => {
          if (!prev) return prev;
          return { ...prev, messages: prev.messages.filter(m => m.id !== tempId) };
        });
      }, 500);
    } catch (e) {
      console.error("Upload error", e);
      // Remove temp message on failure
      setChat((prev) => {
        if (!prev) return prev;
        return { ...prev, messages: prev.messages.filter(m => m.id !== tempId) };
      });
    }
  }

  const handlePickMedia = async () => {
    setShowAttachMenu(false);
    const response = await launchImageLibrary({ mediaType: "mixed", quality: 0.8 });
    if (response.assets?.[0]) {
      const asset = response.assets[0];
      const type = asset.type?.startsWith("video") ? "video" : "image";
      uploadAndSend(asset, type);
    }
  };

  const handleCamera = async () => {
    setShowAttachMenu(false);
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
    }
    const response = await launchCamera({ mediaType: "mixed", quality: 0.8 });
    if (response.assets?.[0]) {
      const asset = response.assets[0];
      const type = asset.type?.startsWith("video") ? "video" : "image";
      uploadAndSend(asset, type);
    }
  };

  const handleLocation = async () => {
    setShowAttachMenu(false);
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
    }
    Geolocation.getCurrentPosition(
      (position) => {
        const tempId = `temp_${Date.now()}`;
        const tempMsg: Message = {
          id: tempId,
          chatId: chat!.id,
          senderId: user.id,
          text: "📍 Shared Location",
          timestamp: new Date().toISOString(),
          type: "location",
          metadata: { lat: position.coords.latitude, lng: position.coords.longitude },
        } as any;
        
        // Optimistic UI Update
        setChat((prev) => {
          if (!prev) return prev;
          return { ...prev, messages: [tempMsg, ...prev.messages] };
        });

        sendChatMessage(chat.id, {
          senderId: user.id,
          text: "📍 Shared Location",
          timestamp: new Date().toISOString(),
          type: "location",
          metadata: { lat: position.coords.latitude, lng: position.coords.longitude },
        } as any);
        
        setTimeout(() => {
          setChat((prev) => {
            if (!prev) return prev;
            return { ...prev, messages: prev.messages.filter(m => m.id !== tempId) };
          });
        }, 500);
      },
      (error) => console.log(error.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const handleSendPoll = () => {
    if (!pollQuestion.trim() || pollOptions.some(o => !o.trim())) return;
    sendChatMessage(chat.id, {
      senderId: user.id,
      text: pollQuestion,
      timestamp: new Date().toISOString(),
      type: "poll",
      metadata: { options: pollOptions.filter(o => o.trim()).map(text => ({ text, votes: [] })) },
    } as any);
    setShowPollModal(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
  };

  const renderMessageContent = (item: Message) => {
    if (item.type === "image" || item.type === "video") {
      return (
        <View style={[styles.mediaMsg, item.senderId === user.id ? styles.msgMine : styles.msgTheirs]}>
          <Image source={{ uri: resolveMediaUrl(String(item.metadata?.url || item.text)) }} style={styles.chatMedia} />
          {item.type === "video" && (
            <View style={styles.videoOverlay}><Feather name="play-circle" size={32} color="#fff" /></View>
          )}
        </View>
      );
    }
    if (item.type === "location") {
      return (
        <TouchableOpacity 
          style={[styles.locationMsg, item.senderId === user.id ? styles.msgMine : styles.msgTheirs, { backgroundColor: colors.muted }]}
          onPress={() => {
            const lat = Number(item.metadata?.lat);
            const lng = Number(item.metadata?.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
              const url = Platform.select({
                ios: `maps:0,0?q=${lat},${lng}`,
                android: `geo:${lat},${lng}?q=${lat},${lng}`,
                default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
              });
              Linking.openURL(url!).catch(err => console.error("Could not open map", err));
            }
          }}
        >
          <Feather name="map-pin" size={24} color={colors.primary} />
          <Text style={{ color: colors.foreground, marginTop: 8 }}>{item.text}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{Number(item.metadata?.lat || 0).toFixed(4)}, {Number(item.metadata?.lng || 0).toFixed(4)}</Text>
        </TouchableOpacity>
      );
    }
    if (item.type === "poll") {
      return (
        <View style={[styles.pollMsg, item.senderId === user.id ? styles.msgMine : styles.msgTheirs, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.pollQuestion, { color: colors.foreground }]}>📊 {item.text}</Text>
          {(item.metadata?.options as any[])?.map((opt: any, idx: number) => (
            <TouchableOpacity key={idx} style={[styles.pollOption, { backgroundColor: colors.muted }]}>
              <Text style={{ color: colors.foreground }}>{opt.text}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{opt.votes?.length || 0} votes</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }
    return (
      <ChatBubble
        text={item.text}
        timestamp={item.timestamp}
        isMine={item.senderId === user.id}
        senderName={item.senderId === user.id ? undefined : other?.fullName}
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      {/* Header */}
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
        ref={flatRef}
        data={messages}
        inverted
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onEndReached={loadOlderMessages}
        onEndReachedThreshold={0.2}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ padding: 12 }} /> : null}
        renderItem={({ item }) => renderMessageContent(item)}
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

      {/* Attach Menu */}
      {showAttachMenu && (
        <View style={[styles.attachMenu, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={styles.attachMenuItem} onPress={handleCamera}>
            <View style={[styles.attachIconBg, { backgroundColor: "#EF4444" }]}><Feather name="camera" size={24} color="#fff" /></View>
            <Text style={[styles.attachText, { color: colors.foreground }]}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachMenuItem} onPress={handlePickMedia}>
            <View style={[styles.attachIconBg, { backgroundColor: "#8B5CF6" }]}><Feather name="image" size={24} color="#fff" /></View>
            <Text style={[styles.attachText, { color: colors.foreground }]}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachMenuItem} onPress={handleLocation}>
            <View style={[styles.attachIconBg, { backgroundColor: "#10B981" }]}><Feather name="map-pin" size={24} color="#fff" /></View>
            <Text style={[styles.attachText, { color: colors.foreground }]}>Location</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachMenuItem} onPress={() => { setShowAttachMenu(false); setShowPollModal(true); }}>
            <View style={[styles.attachIconBg, { backgroundColor: "#F59E0B" }]}><Ionicons name="bar-chart-outline" size={24} color="#fff" /></View>
            <Text style={[styles.attachText, { color: colors.foreground }]}>Poll</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Poll Modal */}
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
  msgMine: { alignSelf: "flex-end" },
  msgTheirs: { alignSelf: "flex-start" },
  mediaMsg: { marginVertical: 4, maxWidth: "75%", position: "relative" },
  chatMedia: { width: 220, height: 220, borderRadius: 16 },
  videoOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 16 },
  locationMsg: { marginVertical: 4, padding: 16, borderRadius: 16, alignItems: "center", maxWidth: "75%" },
  pollMsg: { marginVertical: 4, padding: 16, borderRadius: 16, maxWidth: "80%", width: 260 },
  pollQuestion: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  pollOption: { padding: 12, borderRadius: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  attachBtn: { padding: 8 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, gap: 8 },
  input: { flex: 1, minHeight: 42, maxHeight: 120, borderRadius: 21, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  attachMenu: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 20, borderTopWidth: 1 },
  attachMenuItem: { alignItems: "center", gap: 8 },
  attachIconBg: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  attachText: { fontSize: 12, fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modalContent: { padding: 20, borderRadius: 16 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  pollInput: { padding: 12, borderRadius: 8 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 24 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
});
