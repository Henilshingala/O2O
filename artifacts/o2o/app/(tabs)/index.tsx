import { router } from "@/compat/router";
import React from "react";
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useFriends } from "@/context/FriendsContext";
import { useColors } from "@/hooks/useColors";

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return d.toLocaleDateString();
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getUserById } = useAuth();
  const { chats, groups, channels, counts } = useData();

  const unreadNotifs = counts.notifications;

  if (!user) return null;

  const unifiedList = ( [
    ...chats.filter((c) => c.participants.includes(user.id)).map((chat) => {
      const otherId = chat.participants.find((p) => p !== user.id) ?? "";
      const other = otherId ? getUserById(otherId) : undefined;
      const chatMsgs = Array.isArray(chat.messages) ? chat.messages : [];
      const last = chatMsgs[chatMsgs.length - 1];
      return {
        id: chat.id,
        type: "chat",
        title: other?.fullName ?? "Unknown",
        subtitle: last?.text ?? "No messages yet",
        timestamp: last?.timestamp ?? chat.updatedAt,
        avatarName: other?.fullName ?? "?",
        onPress: () => router.push({ pathname: "/chat/[id]", params: { id: chat.id } }),
      };
    }),
    ...groups.filter((g) => g.members.includes(user.id)).map((grp) => {
      const grpMessages = Array.isArray(grp.messages) ? grp.messages : [];
      const last = grpMessages[grpMessages.length - 1];
      return {
        id: grp.id,
        type: "group",
        title: grp.name,
        subtitle: last ? `${(last.text ?? "").slice(0, 30)}` : `${grp.members.length} members`,
        timestamp: last?.timestamp ?? grp.updatedAt,
        icon: "users",
        onPress: () => router.push({ pathname: "/group/[id]", params: { id: grp.id } }),
      };
    }),
    ...channels.filter((c) => c.followers.includes(user.id) || c.ownerId === user.id).map((ch) => {
      return {
        id: ch.id,
        type: "channel",
        title: ch.name,
        subtitle: `${ch.followers.length} followers • ${ch.products.length} products`,
        timestamp: (ch as any).updatedAt || ch.createdAt,
        icon: "radio",
        isOwner: ch.ownerId === user.id,
        onPress: () => router.push({ pathname: "/channel/[id]", params: { id: ch.id } }),
      };
    })
  ] as any[] ).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const paddingBottom = 90;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
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
        <TouchableOpacity
          style={[styles.searchBar, { backgroundColor: colors.muted }]}
          onPress={() => router.push("/search")}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <Text style={[styles.searchPlaceholder, { color: colors.mutedForeground }]}>
            Search chats, groups, channels...
          </Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.muted }]}
            onPress={() => router.push("/notifications")}
          >
            <Feather name="bell" size={18} color={colors.foreground} />
            {unreadNotifs > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadNotifs > 9 ? "9+" : unreadNotifs}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(tabs)/settings")}>
            <Avatar name={user.fullName} size={36} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom, paddingTop: 12 }}
      >
        {unifiedList.length === 0 ? (
          <EmptyRow label="No conversations yet" colors={colors} />
        ) : (
          unifiedList.map((item) => (
            <TouchableOpacity
              key={`${item.type}-${item.id}`}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={item.onPress}
            >
              {item.type === "chat" ? (
                <Avatar name={item.avatarName} size={48} />
              ) : (
                <View style={[styles.groupAvatar, { backgroundColor: item.type === "group" ? colors.accent : "#EFF6FF" }]}>
                  <Feather name={item.icon as any} size={22} color={colors.primary} />
                </View>
              )}
              
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
                <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              </View>
              
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={[styles.cardTime, { color: colors.mutedForeground }]}>
                  {formatTime(item.timestamp)}
                </Text>
                {item.isOwner && (
                  <View style={[styles.ownerBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.ownerText}>Owner</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <FabMenu role={user.role} colors={colors} />
    </View>
  );
}

function FabMenu({ role, colors }: { role: string; colors: any }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const animation = React.useRef(new Animated.Value(0)).current;

  const toggleMenu = () => {
    const toValue = isOpen ? 0 : 1;
    Animated.spring(animation, {
      toValue,
      useNativeDriver: true,
      friction: 6,
      tension: 60,
    }).start();
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    if (isOpen) toggleMenu();
  };

  const rotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  const bgOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });

  const options = [
    { label: "Add New Friend", icon: "user-plus", route: "/people-search" },
    { label: "Create Group", icon: "users", route: "/group/create" },
  ];
  if (role === "seller") {
    options.push({ label: "Create Channel", icon: "radio", route: "/channel/create" });
  }

  return (
    <>
      {isOpen && (
        <TouchableWithoutFeedback onPress={closeMenu}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: bgOpacity, zIndex: 10 }]} />
        </TouchableWithoutFeedback>
      )}

      <View style={styles.fabContainer}>
        <View style={styles.fabOptions}>
          {options.map((opt, i) => {
            const translateY = animation.interpolate({
              inputRange: [0, 1],
              outputRange: [20 * (options.length - i), 0],
            });
            return (
              <Animated.View
                key={opt.label}
                style={[
                  styles.fabOptionRow,
                  { opacity: animation, transform: [{ translateY }] },
                ]}
                pointerEvents={isOpen ? "auto" : "none"}
              >
                <Text style={[styles.fabOptionLabel, { color: colors.foreground, backgroundColor: colors.card }]}>
                  {opt.label}
                </Text>
                <TouchableOpacity
                  style={[styles.fabOptionBtn, { backgroundColor: colors.card }]}
                  onPress={() => {
                    closeMenu();
                    router.push(opt.route as any);
                  }}
                  activeOpacity={0.8}
                >
                  <Feather name={opt.icon as any} size={20} color={colors.primary} />
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        <TouchableOpacity activeOpacity={0.8} onPress={toggleMenu} style={[styles.fabMain, { backgroundColor: colors.primary }]}>
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Feather name="plus" size={26} color="#fff" />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </>
  );
}

function EmptyRow({ label, colors }: { label: string; colors: any }) {
  return (
    <View style={[emptyStyles.row, { backgroundColor: colors.muted }]}>
      <Text style={[emptyStyles.text, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  searchPlaceholder: { fontSize: 14 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", position: "relative" },
  badge: { position: "absolute", top: -2, right: -2, backgroundColor: "#EF4444", minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  greetingBox: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 16 },
  greeting: { fontSize: 20, fontWeight: "700" },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  roleText: { fontSize: 11, fontWeight: "700" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  cardSub: { fontSize: 13 },
  cardTime: { fontSize: 12 },
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  ownerText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  friendCard: { padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "center", width: 120, marginBottom: 12 },
  friendName: { fontSize: 13, fontWeight: "600", marginTop: 8, marginBottom: 8, textAlign: "center" },
  acceptBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  acceptText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  friendListText: { fontSize: 12, fontWeight: "600", marginTop: 6, textAlign: "center" },
  fabContainer: {
    position: "absolute",
    bottom: 24,
    right: 20,
    alignItems: "flex-end",
    zIndex: 11,
  },
  fabOptions: {
    alignItems: "flex-end",
    marginBottom: 16,
    gap: 16,
  },
  fabOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fabOptionLabel: {
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  fabOptionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  fabMain: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
});

const shStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 16, fontWeight: "700" },
  view: { fontSize: 13, fontWeight: "600" },
});

const emptyStyles = StyleSheet.create({
  row: { marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 12, alignItems: "center" },
  text: { fontSize: 13 },
});
