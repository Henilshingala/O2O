import { router } from "@/compat/router";
import React from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => customFetch("/api/notifications"),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => customFetch(`/api/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllMut = useMutation({
    mutationFn: () => customFetch("/api/notifications/read-all", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (!user) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={() => markAllMut.mutate()}>
            <Text style={[styles.markAll, { color: colors.primary }]}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="bell-off" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {isLoading ? "Loading..." : "No notifications yet"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.row,
              {
                backgroundColor: item.isRead ? colors.card : colors.secondary,
                borderBottomColor: colors.border,
              },
            ]}
            onPress={() => !item.isRead && markReadMut.mutate(item.id)}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
              <Feather name="bell" size={16} color={colors.primary} />
            </View>
            <View style={styles.content}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>{item.title}</Text>
              <Text style={[styles.rowBody, { color: colors.mutedForeground }]}>{item.body}</Text>
              <Text style={[styles.rowTime, { color: colors.mutedForeground }]}>
                {new Date(item.createdAt).toLocaleString()}
              </Text>
            </View>
            {!item.isRead && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  title: { flex: 1, fontSize: 20, fontWeight: "800" },
  markAll: { fontSize: 13, fontWeight: "600" },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14 },
  row: { flexDirection: "row", alignItems: "flex-start", padding: 16, borderBottomWidth: 1, gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  content: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  rowBody: { fontSize: 13, marginBottom: 4 },
  rowTime: { fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
