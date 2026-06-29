import { router, useLocalSearchParams } from "@/compat/router";
import React, { useRef, useState } from "react";
import {
  FlatList,
  Platform,
  ScrollView,
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
import { ProductCard } from "@/components/ProductCard";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

export default function ChannelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getChannel, followChannel, sendChannelMessage, toggleWishlist, isWishlisted } = useData();
  const params = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<"products" | "posts">("products");
  const [postText, setPostText] = useState("");

  if (!user) return null;
  const channel = getChannel(params.id);
  if (!channel) return null;

  const isOwner = channel.ownerId === user.id;
  const isFollowing = channel.followers.includes(user.id);

  const sendPost = () => {
    if (!postText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendChannelMessage(channel.id, {
      senderId: user.id,
      text: postText.trim(),
      timestamp: new Date().toISOString(),
    });
    setPostText("");
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
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.channelName, { color: colors.foreground }]}>{channel.name}</Text>
          <Text style={[styles.followers, { color: colors.mutedForeground }]}>
            {channel.followers.length.toLocaleString()} Followers
          </Text>
        </View>
        {!isOwner && (
          <TouchableOpacity
            style={[
              styles.followBtn,
              { backgroundColor: isFollowing ? colors.muted : colors.primary },
            ]}
            onPress={() => followChannel(channel.id, user.id)}
          >
            <Text style={[styles.followText, { color: isFollowing ? colors.foreground : "#fff" }]}>
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
        )}
        {isOwner && (
          <TouchableOpacity
            style={[styles.postBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push({ pathname: "/channel/post", params: { channelId: channel.id } })}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.postBtnText}>Post</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(["products", "posts"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
              {t === "products" ? "Products" : "Updates"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "products" ? (
        <FlatList
          data={channel.products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="package" size={48} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No products yet
              </Text>
              {isOwner && (
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push({ pathname: "/channel/post", params: { channelId: channel.id } })}
                >
                  <Text style={styles.emptyBtnText}>Add Product</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              channel={channel}
              userId={user.id}
              userRole={user.role}
              isOwner={isOwner}
              isWishlisted={isWishlisted(user.id, item.id)}
              onWishlist={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleWishlist(user.id, item, channel);
              }}
              onRepost={() =>
                router.push({
                  pathname: "/channel/repost",
                  params: { channelId: channel.id, productId: item.id },
                })
              }
            />
          )}
        />
      ) : (
        <FlatList
          data={[...channel.messages].reverse()}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: isOwner ? 80 : 40 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="message-square" size={48} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No updates yet
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.postHeader}>
                <View style={[styles.postAvatar, { backgroundColor: colors.accent }]}>
                  <Feather name="radio" size={14} color={colors.primary} />
                </View>
                <Text style={[styles.postSender, { color: colors.foreground }]}>{channel.name}</Text>
                <Text style={[styles.postTime, { color: colors.mutedForeground }]}>
                  {new Date(item.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              <Text style={[styles.postText, { color: colors.foreground }]}>{item.text}</Text>
            </View>
          )}
        />
      )}

      {/* Seller post bar */}
      {tab === "posts" && isOwner && (
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 8),
            },
          ]}
        >
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.muted, color: colors.foreground }]}
            value={postText}
            onChangeText={setPostText}
            placeholder="Post Update..."
            placeholderTextColor={colors.mutedForeground}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: postText.trim() ? colors.primary : colors.muted }]}
            onPress={sendPost}
          >
            <Feather name="send" size={18} color={postText.trim() ? "#fff" : colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      {!isOwner && tab === "posts" && (
        <View style={[styles.readOnly, { backgroundColor: colors.muted, borderTopColor: colors.border }]}>
          <Feather name="lock" size={14} color={colors.mutedForeground} />
          <Text style={[styles.readOnlyText, { color: colors.mutedForeground }]}>
            Only admins can post
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerInfo: { flex: 1 },
  channelName: { fontSize: 16, fontWeight: "800" },
  followers: { fontSize: 12, marginTop: 2 },
  followBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  followText: { fontSize: 13, fontWeight: "700" },
  postBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  postBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabText: { fontSize: 14, fontWeight: "600" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  emptyBtnText: { color: "#fff", fontWeight: "700" },
  postCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  postAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  postSender: { flex: 1, fontSize: 13, fontWeight: "700" },
  postTime: { fontSize: 11 },
  postText: { fontSize: 14, lineHeight: 20 },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  readOnly: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  readOnlyText: { fontSize: 13 },
});
