import { router } from "@/compat/router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { AppButton } from "@/components/ui/AppButton";
import { useAuth } from "@/context/AuthContext";
import { useFriends } from "@/context/FriendsContext";
import { useColors } from "@/hooks/useColors";

export default function CreateGroupStep1() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { friends } = useFriends();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  if (!user) return null;
  const filtered = friends.filter((f) =>
    f.fullName.toLowerCase().includes(search.toLowerCase()) ||
    f.username.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    if (selected.length === 0) return;
    router.push({
      pathname: "/group/create-details",
      params: { members: JSON.stringify([...selected, user.id]) },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
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
        <Text style={[styles.title, { color: colors.foreground }]}>Create Group</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.muted, margin: 16 }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search friends..."
          placeholderTextColor={colors.mutedForeground}
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SELECT MEMBERS</Text>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => {
          const isSelected = selected.includes(item.id);
          return (
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: colors.border }]}
              onPress={() => toggle(item.id)}
            >
              <Avatar name={item.fullName} size={44} />
              <View style={styles.info}>
                <Text style={[styles.name, { color: colors.foreground }]}>{item.fullName}</Text>
                <Text style={[styles.username, { color: colors.mutedForeground }]}>@{item.username}</Text>
              </View>
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: isSelected ? colors.primary : "transparent",
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
              >
                {isSelected && <Feather name="check" size={14} color="#fff" />}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <Text style={[styles.selectedCount, { color: colors.mutedForeground }]}>
          Selected: {selected.length} member{selected.length !== 1 ? "s" : ""}
        </Text>
        <AppButton
          title="NEXT →"
          onPress={handleNext}
          disabled={selected.length === 0}
          style={styles.nextBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 17, fontWeight: "700" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 12,
  },
  searchInput: { flex: 1, fontSize: 14 },
  sectionLabel: { fontSize: 11, fontWeight: "700", paddingHorizontal: 16, paddingBottom: 8, letterSpacing: 0.5 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600" },
  username: { fontSize: 12, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  selectedCount: { fontSize: 13, textAlign: "center" },
  nextBtn: {},
});
