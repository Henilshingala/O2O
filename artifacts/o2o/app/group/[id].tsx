import { router, useLocalSearchParams } from "@/compat/router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { ChatAttachMenu } from "@/components/ChatAttachMenu";
import { MessageContent } from "@/components/MessageContent";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useColors } from "@/hooks/useColors";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export default function GroupChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getUserById } = useAuth();
  const { getGroup, sendGroupMessage } = useData();
  const params = useLocalSearchParams<{ id: string }>();
  const [text, setText] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  if (!user) return null;
  const group = getGroup(params.id);
  if (!group) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const { displayMessages, sendMessage, loadOlderMessages, loadingMore } = useRealtimeMessages({
    roomType: "group",
    roomId: group.id,
    initialMessages: group.messages,
    queryKey: ["groups"],
    onSend: (msg) => sendGroupMessage(group.id, { ...msg, groupId: group.id }),
  });

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
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior="padding" keyboardVerticalOffset={0}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
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

      <FlatList
        data={displayMessages}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.messages}
        onEndReached={loadOlderMessages}
        onEndReachedThreshold={0.2}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ padding: 12 }} /> : null}
        renderItem={({ item }) => {
          const sender = getUserById(item.senderId);
          return (
            <MessageContent
              item={item}
              isMine={item.senderId === user.id}
              senderName={item.senderId !== user.id ? (sender?.fullName ?? "Unknown") : undefined}
            />
          );
        }}
      />

      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 8) }]}>
        <TouchableOpacity onPress={() => setShowAttachMenu(!showAttachMenu)} style={styles.attachBtn}>
          <Feather name="plus" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.muted, color: colors.foreground }]}
          value={text}
          onChangeText={setText}
          placeholder="Message..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.muted }]}
          onPress={send}
          disabled={!text.trim()}
        >
          <Feather name="send" size={18} color={text.trim() ? "#fff" : colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ChatAttachMenu
        visible={showAttachMenu}
        onClose={() => setShowAttachMenu(false)}
        senderId={user.id}
        bottomInset={insets.bottom + 16}
        onSend={(msg) => sendMessage({ ...msg, groupId: group.id })}
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
});
