import { router } from "@/compat/router";
import React, { useState } from "react";
import { FlatList, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

export default function NewChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getFriends } = useAuth();
  const { createChat } = useData();
  const [search, setSearch] = useState("");

  if (!user) return null;
  const friends = getFriends().filter((f: any) =>
    f.fullName.toLowerCase().includes(search.toLowerCase()) ||
    f.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>New Chat</Text>
        <View style={{ width: 22 }} />
      </View>
      <View style={[styles.searchBar, { backgroundColor: colors.muted, margin: 16 }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput style={[styles.searchInput, { color: colors.foreground }]} value={search} onChangeText={setSearch} placeholder="Search users..." placeholderTextColor={colors.mutedForeground} />
      </View>
      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => { const chat = createChat(user.id, item.id); if (chat) router.replace({ pathname: "/chat/[id]", params: { id: chat.id } }); }}
          >
            <Avatar name={item.fullName} size={46} />
            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.foreground }]}>{item.fullName}</Text>
              <Text style={[styles.username, { color: colors.mutedForeground }]}>@{item.username} • {item.role}</Text>
            </View>
            <Feather name="message-circle" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: "800" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, height: 42, borderRadius: 12 },
  searchInput: { flex: 1, fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700" },
  username: { fontSize: 12, marginTop: 2 },
});
