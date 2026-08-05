/**
 * Channel Screen — complete rewrite
 *
 * FEATURE 5  — Unified timeline (products + text/image/video/emoji messages in one FlatList)
 * FEATURE 6  — Updates tab shows reposted products only, with search bar
 * FEATURE 7  — Product cards show live stats (wishlist, bid count, views) via Socket.IO
 * FEATURE 8  — Header shows real-time subscriber count via Socket.IO
 * FEATURE 11 — Search icon in header → slide-down search bar (Reanimated)
 */
import { router, useLocalSearchParams } from "@/compat/router";
import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import {
  BackHandler,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Image } from "@/compat/image";
import { EmojiKeyboard, type EmojiType } from "rn-emoji-keyboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import * as Haptics from "@/compat/haptics";
import { ProductCard } from "@/components/ProductCard";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { getSocket } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import type { Message, Product } from "@/types";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatPostDate(ts: string) {
  const d = new Date(ts);
  return `Added on ${d.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  })} at ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatMsgTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

// A unified feed item is either a product card or a channel message
type FeedItem =
  | { kind: "product"; data: Product }
  | { kind: "message"; data: Message };

function buildFeedKey(item: FeedItem) {
  return item.kind === "product" ? `prod:${item.data.id}` : `msg:${item.data.id}`;
}


export default function ChannelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    getChannel, followChannel, sendChannelMessage,
    toggleWishlist, isWishlisted,
  } = useData();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();

  // Tab: "timeline" (unified feed) | "updates" (repost-only)
  const [tab, setTab] = useState<"timeline" | "updates">("timeline");

  // Compose bar
  const [postText, setPostText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<TextInput>(null);

  // FEATURE 11 — slide-down channel search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 250);
  const searchHeight = useSharedValue(0);
  const searchAnim = useAnimatedStyle(() => ({
    height: searchHeight.value,
    overflow: "hidden",
  }));

  // FEATURE 8 — live subscriber count from socket
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);

  // Updates search
  const [updatesQuery, setUpdatesQuery] = useState("");
  const debouncedUpdates = useDebounce(updatesQuery, 250);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showEmojiPicker) { setShowEmojiPicker(false); return true; }
      if (searchOpen) { closeSearch(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [showEmojiPicker, searchOpen]);

  // FEATURE 8: subscribe to channel subscriber updates via Socket.IO
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !params.id) return;
    socket.emit("join:channel", params.id);
    const onSubscriberUpdate = (data: { channelId: string; count: number }) => {
      if (data.channelId === params.id) setSubscriberCount(data.count);
    };
    socket.on("channel:subscriber:update", onSubscriberUpdate);
    return () => {
      socket.off("channel:subscriber:update", onSubscriberUpdate);
      socket.emit("leave:channel", params.id);
    };
  }, [params.id]);

  const openSearch = () => {
    setSearchOpen(true);
    searchHeight.value = withTiming(48, { duration: 220 });
    setTimeout(() => inputRef.current?.focus(), 250);
  };

  const closeSearch = () => {
    Keyboard.dismiss();
    searchHeight.value = withTiming(0, { duration: 180 });
    setSearchOpen(false);
    setSearchQuery("");
  };

  const toggleEmojiPicker = () => {
    if (showEmojiPicker) { setShowEmojiPicker(false); return; }
    Keyboard.dismiss();
    setShowEmojiPicker(true);
  };

  const handleEmojiSelect = (emojiObj: EmojiType) => {
    const emoji = emojiObj.emoji;
    setPostText((prev) => {
      const before = prev.slice(0, cursorPosition);
      const after = prev.slice(cursorPosition);
      return before + emoji + after;
    });
    setCursorPosition((pos) => pos + emoji.length);
  };

  if (!user) return null;
  const channel = getChannel(params.id);
  if (!channel) return null;

  const isOwner = channel.ownerId === user.id;
  const isFollowing = channel.followers.includes(user.id);
  const displayCount = subscriberCount ?? channel.followers.length;


  // FEATURE 5 — build unified chronological feed (products + messages)
  const unifiedFeed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    channel.products.forEach((p) => {
      // Exclude reposted items from timeline (they go to Updates tab)
      if ((p as any).isRepost) return;
      items.push({ kind: "product", data: p });
    });
    channel.messages.forEach((m) => {
      // Exclude repost messages from timeline
      if ((m.metadata as any)?.isRepost) return;
      items.push({ kind: "message", data: m });
    });
    // Sort chronologically ascending (oldest first → reversed for display)
    items.sort((a, b) => {
      const ta = a.kind === "product"
        ? new Date((a.data as Product).createdAt).getTime()
        : new Date((a.data as Message).timestamp).getTime();
      const tb = b.kind === "product"
        ? new Date((b.data as Product).createdAt).getTime()
        : new Date((b.data as Message).timestamp).getTime();
      return tb - ta; // newest first (FlatList not inverted for channel)
    });
    return items;
  }, [channel.products, channel.messages]);

  // FEATURE 11 — filter unified feed by search query
  const filteredFeed = useMemo<FeedItem[]>(() => {
    const q = debouncedSearch.toLowerCase().trim();
    if (!q) return unifiedFeed;
    return unifiedFeed.filter((item) => {
      if (item.kind === "product") {
        return (
          item.data.name.toLowerCase().includes(q) ||
          (item.data.description ?? "").toLowerCase().includes(q) ||
          // product code stored in details as {name:'Code',value:'...'}
          item.data.details?.some(
            (d) => d.name.toLowerCase() === "code" && d.value.toLowerCase().includes(q)
          )
        );
      }
      return (item.data.text ?? "").toLowerCase().includes(q);
    });
  }, [unifiedFeed, debouncedSearch]);

  // FEATURE 6 — Updates tab: reposted products only, filtered by search
  const repostedProducts = useMemo(() => {
    const q = debouncedUpdates.toLowerCase().trim();
    return channel.products
      .filter((p) => (p as any).isRepost === true)
      .filter((p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.details?.some((d) => d.name.toLowerCase() === "code" && d.value.toLowerCase().includes(q))
      );
  }, [channel.products, debouncedUpdates]);

  const sendPost = () => {
    if (!postText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendChannelMessage(channel.id, {
      senderId: user.id,
      text: postText.trim(),
      timestamp: new Date().toISOString(),
      type: "text",
      channelId: channel.id,
    });
    setPostText("");
  };


  // ── render feed item (product card or message bubble) ──────────────────
  const renderFeedItem = useCallback(({ item }: { item: FeedItem }) => {
    if (item.kind === "product") {
      const p = item.data as Product;
      return (
        <View style={{ marginBottom: 4 }}>
          <ProductCard
            product={p}
            channel={channel}
            userId={user.id}
            userRole={user.role}
            isOwner={isOwner}
            isWishlisted={isWishlisted(user.id, p.id)}
            onWishlist={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleWishlist(user.id, p, channel);
            }}
            onRepost={() =>
              router.push({ pathname: "/channel/repost", params: { channelId: channel.id, productId: p.id } })
            }
          />
          {/* FEATURE 4 — timestamp below product card */}
          <Text style={[st.productTs, { color: colors.mutedForeground }]}>
            {formatPostDate(p.createdAt)}
          </Text>
        </View>
      );
    }
    // Message bubble
    const m = item.data as Message;
    return (
      <View style={[st.msgBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={st.msgHeader}>
          <View style={[st.msgAvatar, { backgroundColor: colors.accent }]}>
            <Feather name="radio" size={12} color={colors.primary} />
          </View>
          <Text style={[st.msgSender, { color: colors.foreground }]}>{channel.name}</Text>
          <Text style={[st.msgTime, { color: colors.mutedForeground }]}>{formatMsgTime(m.timestamp)}</Text>
        </View>
        <Text style={[st.msgText, { color: colors.foreground }]}>{m.text}</Text>
      </View>
    );
  }, [channel, user, isOwner, isWishlisted, toggleWishlist, colors]);

  // ── render reposted product (Updates tab) ──────────────────────────────
  const renderRepost = useCallback(({ item }: { item: Product }) => (
    <View style={{ marginBottom: 4 }}>
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
        onRepost={undefined}
      />
      <Text style={[st.productTs, { color: colors.mutedForeground }]}>
        {formatPostDate(item.createdAt)}
      </Text>
    </View>
  ), [channel, user, isOwner, isWishlisted, toggleWishlist, colors]);


  return (
    <KeyboardAvoidingView style={[st.root, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[st.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={st.headerInfo}
          onPress={() => router.push({ pathname: "/channel/info", params: { id: channel.id } })}
        >
          <Text style={[st.channelName, { color: colors.foreground }]} numberOfLines={1}>{channel.name}</Text>
          {/* FEATURE 8 — live subscriber count */}
          <Text style={[st.subCount, { color: colors.mutedForeground }]}>
            {displayCount.toLocaleString()} subscriber{displayCount !== 1 ? "s" : ""}
          </Text>
        </TouchableOpacity>

        {/* FEATURE 11 — search icon */}
        <TouchableOpacity onPress={searchOpen ? closeSearch : openSearch} style={st.iconBtn}>
          <Feather name={searchOpen ? "x" : "search"} size={20} color={colors.foreground} />
        </TouchableOpacity>

        {!isOwner ? (
          <TouchableOpacity
            style={[st.followBtn, { backgroundColor: isFollowing ? colors.muted : colors.primary }]}
            onPress={() => followChannel(channel.id, user.id)}
          >
            <Text style={[st.followText, { color: isFollowing ? colors.foreground : "#fff" }]}>
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[st.postBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push({ pathname: "/channel/post", params: { channelId: channel.id } })}
          >
            <Feather name="plus" size={15} color="#fff" />
            <Text style={st.postBtnText}>Post</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* FEATURE 11 — animated search bar */}
      <Animated.View style={[{ backgroundColor: colors.card }, searchAnim]}>
        <View style={[st.searchRow, { backgroundColor: colors.muted, marginHorizontal: 12, marginVertical: 6, borderRadius: 20 }]}>
          <Feather name="search" size={14} color={colors.mutedForeground} />
          <TextInput
            ref={inputRef}
            style={[st.searchInput, { color: colors.foreground }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search products, messages..."
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* ── Tabs: Timeline | Updates ── */}
      <View style={[st.tabs, { borderBottomColor: colors.border }]}>
        {(["timeline", "updates"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[st.tabBtn, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[st.tabText, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
              {t === "timeline" ? "Timeline" : "Updates"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>


      {/* ── FEATURE 5: Unified Timeline ── */}
      {tab === "timeline" && (
        <FlatList
          data={filteredFeed}
          keyExtractor={buildFeedKey}
          contentContainerStyle={{ padding: 16, paddingBottom: isOwner ? 100 : 40 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={st.empty}>
              <Feather name={debouncedSearch ? "search" : "package"} size={48} color={colors.border} />
              <Text style={[st.emptyText, { color: colors.mutedForeground }]}>
                {debouncedSearch ? `No results for "${debouncedSearch}"` : "No posts yet"}
              </Text>
              {isOwner && !debouncedSearch && (
                <TouchableOpacity
                  style={[st.emptyBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push({ pathname: "/channel/post", params: { channelId: channel.id } })}
                >
                  <Text style={st.emptyBtnText}>Add First Product</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={renderFeedItem}
        />
      )}

      {/* ── FEATURE 6: Updates (repost-only) with search ── */}
      {tab === "updates" && (
        <>
          {/* Updates search bar */}
          <View style={[st.updatesSearchRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <View style={[st.searchRow, { backgroundColor: colors.muted, flex: 1, borderRadius: 20 }]}>
              <Feather name="search" size={14} color={colors.mutedForeground} />
              <TextInput
                style={[st.searchInput, { color: colors.foreground }]}
                value={updatesQuery}
                onChangeText={setUpdatesQuery}
                placeholder="Search by product name or code..."
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="search"
              />
              {updatesQuery.length > 0 && (
                <TouchableOpacity onPress={() => setUpdatesQuery("")}>
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
            {isOwner && (
              <TouchableOpacity
                style={[st.repostSelectBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push({ pathname: "/channel/repost", params: { channelId: channel.id } })}
              >
                <Feather name="refresh-cw" size={15} color="#fff" />
                <Text style={st.repostSelectText}>Repost</Text>
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={repostedProducts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={st.empty}>
                <Feather name={debouncedUpdates ? "search" : "refresh-cw"} size={48} color={colors.border} />
                <Text style={[st.emptyText, { color: colors.mutedForeground }]}>
                  {debouncedUpdates ? `No results for "${debouncedUpdates}"` : "No reposts yet"}
                </Text>
                {isOwner && !debouncedUpdates && (
                  <TouchableOpacity
                    style={[st.emptyBtn, { backgroundColor: colors.primary }]}
                    onPress={() => router.push({ pathname: "/channel/repost", params: { channelId: channel.id } })}
                  >
                    <Text style={st.emptyBtnText}>Repost a Product</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
            renderItem={renderRepost}
          />
        </>
      )}


      {/* Owner compose bar — only on Timeline tab */}
      {tab === "timeline" && isOwner && (
        <>
          <View style={[st.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
            <TouchableOpacity onPress={toggleEmojiPicker} style={st.emojiBtn}>
              <Feather name={showEmojiPicker ? "keyboard" : "smile"} size={22} color={colors.primary} />
            </TouchableOpacity>
            <TextInput
              style={[st.textInput, { backgroundColor: colors.muted, color: colors.foreground }]}
              value={postText}
              onChangeText={setPostText}
              placeholder="Post an update..."
              placeholderTextColor={colors.mutedForeground}
              onFocus={() => { if (showEmojiPicker) setShowEmojiPicker(false); }}
              onSelectionChange={(e) => setCursorPosition(e.nativeEvent.selection.start)}
            />
            <TouchableOpacity
              style={[st.sendBtn, { backgroundColor: postText.trim() ? colors.primary : colors.muted }]}
              onPress={sendPost}
            >
              <Feather name="send" size={18} color={postText.trim() ? "#fff" : colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {showEmojiPicker && (
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
        </>
      )}

      {tab === "timeline" && !isOwner && (
        <View style={[st.readOnly, { backgroundColor: colors.muted, borderTopColor: colors.border }]}>
          <Feather name="lock" size={13} color={colors.mutedForeground} />
          <Text style={[st.readOnlyText, { color: colors.mutedForeground }]}>Only the channel owner can post</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}


const st = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerInfo: { flex: 1 },
  channelName: { fontSize: 16, fontWeight: "800" },
  subCount: { fontSize: 12, marginTop: 1 },
  iconBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  followBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  followText: { fontSize: 13, fontWeight: "700" },
  postBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  postBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Search bar (FEATURE 11)
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 36 },
  searchInput: { flex: 1, fontSize: 13 },

  // Tabs
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabText: { fontSize: 14, fontWeight: "600" },

  // Feed items
  productTs: { fontSize: 11, textAlign: "right", paddingRight: 8, paddingBottom: 10, marginTop: -4 },
  msgBubble: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  msgHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  msgAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  msgSender: { flex: 1, fontSize: 13, fontWeight: "700" },
  msgTime: { fontSize: 11 },
  msgText: { fontSize: 14, lineHeight: 20 },

  // Updates tab
  updatesSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  repostSelectBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  repostSelectText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Empty state
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  emptyBtnText: { color: "#fff", fontWeight: "700" },

  // Compose bar
  inputBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, gap: 8 },
  textInput: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  emojiBtn: { padding: 4 },
  readOnly: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderTopWidth: 1 },
  readOnlyText: { fontSize: 13 },
});
