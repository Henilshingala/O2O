import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "@/compat/router";
import { Feather } from "@/compat/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useFriends, FriendUser, FriendRequestHistoryItem } from "@/context/FriendsContext";
import { useAuth } from "@/context/AuthContext";

function formatDate(dateStr?: string | Date) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Avatar({ user, size = 44, colors }: { user: { fullName?: string; avatar?: string }; size?: number; colors: any }) {
  const initials =
    user.fullName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??";
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primary + "22",
        },
      ]}
    >
      <Text style={[styles.avatarText, { color: colors.primary, fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

export default function FriendsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const {
    friends,
    incoming,
    outgoing,
    history,
    isLoading,
    removeFriend,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    sendRequest,
    searchUsers,
  } = useFriends();

  const [activeTab, setActiveTab] = useState<"add" | "requests">("add");

  // Search state for "Add a Friend" tab
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const pendingCount = incoming.length;

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (!text.trim() || text.trim().length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      const timer = setTimeout(async () => {
        setIsSearching(true);
        try {
          const res = await searchUsers(text);
          setSearchResults(res);
        } catch {
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 350);
      setDebounceTimer(timer);
    },
    [searchUsers, debounceTimer]
  );

  const handleSendRequest = async (targetUser: FriendUser) => {
    if (targetUser.id === currentUser?.id) {
      Alert.alert("Invalid Action", "You cannot send a friend request to yourself.");
      return;
    }
    setActionLoadingId(targetUser.id);
    try {
      await sendRequest(targetUser.id);
      setSearchResults((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, relationship: "pending_sent" } : u))
      );
    } catch (e: any) {
      Alert.alert("Error", e?.data?.error || e?.message || "Failed to send friend request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelRequest = async (targetUser: FriendUser) => {
    setActionLoadingId(targetUser.id);
    try {
      await cancelRequest(targetUser.id);
      setSearchResults((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, relationship: "none" } : u))
      );
    } catch {
      // ignore
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAccept = async (requesterId: string) => {
    setActionLoadingId(requesterId);
    try {
      await acceptRequest(requesterId);
    } catch (e: any) {
      Alert.alert("Error", e?.data?.error || e?.message || "Failed to accept request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (requesterId: string) => {
    setActionLoadingId(requesterId);
    try {
      await rejectRequest(requesterId);
    } catch (e: any) {
      Alert.alert("Error", e?.data?.error || e?.message || "Failed to reject request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveFriend = (f: FriendUser) => {
    Alert.alert("Remove Friend", `Are you sure you want to remove ${f.fullName} from your friends?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeFriend(f.id) },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Friends</Text>
      </View>

      {/* 2 Main Tabs: Add a Friend | Friend Requests */}
      <View style={[styles.tabsRow, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "add" && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab("add")}
        >
          <Feather name="user-plus" size={16} color={activeTab === "add" ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.tabLabel, { color: activeTab === "add" ? colors.primary : colors.mutedForeground }]}>
            Add a Friend
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "requests" && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab("requests")}
        >
          <View style={styles.tabIconBadgeRow}>
            <Feather name="inbox" size={16} color={activeTab === "requests" ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.tabLabel, { color: activeTab === "requests" ? colors.primary : colors.mutedForeground }]}>
              Friend Requests
            </Text>
            {pendingCount > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{pendingCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Tab 1: Add a Friend */}
      {activeTab === "add" && (
        <View style={styles.tabContent}>
          {/* Search Input Bar */}
          <View style={[styles.searchBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search by name or username..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(""); setSearchResults([]); }}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {isSearching ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : searchQuery.trim().length >= 2 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Feather name="user-x" size={44} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>No users found</Text>
                  <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                    No matching users found for "{searchQuery}"
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isLoadingRow = actionLoadingId === item.id;
                return (
                  <View style={[styles.userRow, { borderBottomColor: colors.border }]}>
                    <Avatar user={item} colors={colors} />
                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, { color: colors.foreground }]}>{item.fullName}</Text>
                      <Text style={[styles.userSub, { color: colors.mutedForeground }]}>
                        @{item.username} {item.role ? `· ${item.role}` : ""} {item.city ? `· ${item.city}` : ""}
                      </Text>
                    </View>

                    {item.relationship === "friends" ? (
                      <View style={[styles.statusBadge, { backgroundColor: "#10B9811A", borderColor: "#10B98144" }]}>
                        <Feather name="check" size={12} color="#10B981" />
                        <Text style={[styles.statusBadgeText, { color: "#10B981" }]}>Friends</Text>
                      </View>
                    ) : item.relationship === "pending_sent" ? (
                      <TouchableOpacity
                        style={[styles.statusBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}
                        onPress={() => handleCancelRequest(item)}
                        disabled={isLoadingRow}
                      >
                        {isLoadingRow ? (
                          <ActivityIndicator size={12} color={colors.mutedForeground} />
                        ) : (
                          <Text style={[styles.statusBadgeText, { color: colors.mutedForeground }]}>Requested (Cancel)</Text>
                        )}
                      </TouchableOpacity>
                    ) : item.relationship === "pending_received" ? (
                      <View style={styles.actionBtnsGroup}>
                        <TouchableOpacity
                          style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
                          onPress={() => handleAccept(item.id)}
                          disabled={isLoadingRow}
                        >
                          <Text style={styles.btnPrimaryText}>Accept</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
                        onPress={() => handleSendRequest(item)}
                        disabled={isLoadingRow}
                      >
                        {isLoadingRow ? (
                          <ActivityIndicator size={12} color="#fff" />
                        ) : (
                          <>
                            <Feather name="user-plus" size={13} color="#fff" />
                            <Text style={styles.btnPrimaryText}>Send Request</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
              <View style={styles.promptCard}>
                <Feather name="search" size={38} color={colors.primary} />
                <Text style={[styles.promptTitle, { color: colors.foreground }]}>Find People on O2O</Text>
                <Text style={[styles.promptSub, { color: colors.mutedForeground }]}>
                  Type a name or username above to discover new people and send friend requests.
                </Text>
              </View>

              {friends.length > 0 && (
                <View style={styles.friendsSection}>
                  <Text style={[styles.sectionHeading, { color: colors.mutedForeground }]}>MY FRIENDS ({friends.length})</Text>
                  {friends.map((f) => (
                    <View key={f.id} style={[styles.userRow, { borderBottomColor: colors.border }]}>
                      <Avatar user={f} colors={colors} />
                      <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: colors.foreground }]}>{f.fullName}</Text>
                        <Text style={[styles.userSub, { color: colors.mutedForeground }]}>@{f.username}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.btnOutline, { borderColor: colors.destructive + "44", backgroundColor: colors.destructive + "10" }]}
                        onPress={() => handleRemoveFriend(f)}
                      >
                        <Text style={[styles.btnOutlineText, { color: colors.destructive }]}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* Tab 2: Friend Requests */}
      {activeTab === "requests" && (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
          {/* Section 1: Pending Requests */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Feather name="clock" size={15} color={colors.primary} />
              <Text style={[styles.sectionHeading, { color: colors.foreground }]}>
                PENDING REQUESTS ({incoming.length})
              </Text>
            </View>

            {incoming.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="inbox" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyCardText, { color: colors.mutedForeground }]}>No pending friend requests</Text>
              </View>
            ) : (
              incoming.map((req) => {
                const isLoadingRow = actionLoadingId === req.id;
                return (
                  <View key={req.id} style={[styles.requestCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Avatar user={req} size={48} colors={colors} />
                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, { color: colors.foreground }]}>{req.fullName}</Text>
                      <Text style={[styles.userSub, { color: colors.mutedForeground }]}>@{req.username}</Text>
                      {req.city ? <Text style={[styles.userSub, { color: colors.mutedForeground }]}>{req.city}</Text> : null}
                    </View>

                    <View style={styles.actionBtnsGroupVertical}>
                      <TouchableOpacity
                        style={[styles.btnPrimary, { backgroundColor: colors.primary, minWidth: 80 }]}
                        onPress={() => handleAccept(req.id)}
                        disabled={isLoadingRow}
                      >
                        {isLoadingRow ? (
                          <ActivityIndicator size={12} color="#fff" />
                        ) : (
                          <Text style={styles.btnPrimaryText}>Accept</Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.btnOutline, { borderColor: colors.border, marginTop: 6, minWidth: 80 }]}
                        onPress={() => handleReject(req.id)}
                        disabled={isLoadingRow}
                      >
                        <Text style={[styles.btnOutlineText, { color: colors.mutedForeground }]}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Section 2: Request History */}
          <View style={[styles.sectionContainer, { marginTop: 24 }]}>
            <View style={styles.sectionHeaderRow}>
              <Feather name="history" size={15} color={colors.primary} />
              <Text style={[styles.sectionHeading, { color: colors.foreground }]}>REQUEST HISTORY</Text>
            </View>

            {history.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="calendar" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyCardText, { color: colors.mutedForeground }]}>No request history yet</Text>
              </View>
            ) : (
              history.map((item) => {
                const isAccepted = item.status === "accepted";
                return (
                  <View key={item.id} style={[styles.historyRow, { borderBottomColor: colors.border }]}>
                    <Avatar user={item.user} colors={colors} />
                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, { color: colors.foreground }]}>{item.user.fullName}</Text>
                      <Text style={[styles.userSub, { color: colors.mutedForeground }]}>@{item.user.username}</Text>
                      <Text style={[styles.timeText, { color: colors.mutedForeground }]}>{formatDate(item.updatedAt)}</Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        isAccepted
                          ? { backgroundColor: "#10B9811A", borderColor: "#10B98144" }
                          : { backgroundColor: "#EF44441A", borderColor: "#EF444444" },
                      ]}
                    >
                      <Feather name={isAccepted ? "check" : "x"} size={12} color={isAccepted ? "#10B981" : "#EF4444"} />
                      <Text style={[styles.statusBadgeText, { color: isAccepted ? "#10B981" : "#EF4444" }]}>
                        {isAccepted ? "Accepted" : "Rejected"}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: "800" },
  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  tabLabel: { fontSize: 14, fontWeight: "700" },
  tabIconBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  countBadge: {
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  countText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  tabContent: { flex: 1 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  promptCard: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 36,
    gap: 8,
  },
  promptTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  promptSub: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  friendsSection: { marginTop: 8 },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sectionContainer: { paddingHorizontal: 16, paddingTop: 16 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  emptyCardText: { fontSize: 14, fontWeight: "600" },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 15, fontWeight: "700" },
  userSub: { fontSize: 12, marginTop: 2 },
  timeText: { fontSize: 11, marginTop: 2 },
  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "800" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 12, fontWeight: "700" },
  actionBtnsGroup: { flexDirection: "row", gap: 8 },
  actionBtnsGroupVertical: { alignItems: "flex-end" },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  btnPrimaryText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  btnOutline: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnOutlineText: { fontSize: 12, fontWeight: "700" },
  emptyContainer: { alignItems: "center", marginTop: 50, gap: 8, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptySub: { fontSize: 13, textAlign: "center" },
});
