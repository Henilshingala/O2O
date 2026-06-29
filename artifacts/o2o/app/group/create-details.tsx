import { router, useLocalSearchParams } from "@/compat/router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import * as Haptics from "@/compat/haptics";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

export default function CreateGroupStep2() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { createGroup } = useData();
  const params = useLocalSearchParams<{ members: string }>();
  const members: string[] = params.members ? JSON.parse(params.members) : [];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!user) return null;

  const handleCreate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Group name is required";
    if (!description.trim()) e.description = "Description is required";
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setLoading(true);
    const group = createGroup({
      name: name.trim(),
      description: description.trim(),
      members,
      createdBy: user.id,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(false);
    if (group) router.replace({ pathname: "/group/[id]", params: { id: group.id } });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
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
        <Text style={[styles.title, { color: colors.foreground }]}>Group Details</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Group Image Placeholder */}
        <TouchableOpacity style={[styles.imagePicker, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="camera" size={28} color={colors.mutedForeground} />
          <Text style={[styles.imageLabel, { color: colors.mutedForeground }]}>Group Image</Text>
          <Text style={[styles.imageHint, { color: colors.mutedForeground }]}>Tap to upload (optional)</Text>
        </TouchableOpacity>

        <AppInput
          label="Group Name"
          value={name}
          onChangeText={setName}
          placeholder="Enter group name"
          error={errors.name}
        />
        <AppInput
          label="Group Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What's this group about?"
          multiline
          style={{ height: 90, textAlignVertical: "top", paddingTop: 10 }}
          error={errors.description}
        />

        <View style={[styles.memberInfo, { backgroundColor: colors.secondary }]}>
          <Feather name="users" size={16} color={colors.primary} />
          <Text style={[styles.memberText, { color: colors.foreground }]}>
            Members Selected: {members.length}
          </Text>
        </View>

        <AppButton title="CREATE GROUP" onPress={handleCreate} loading={loading} style={styles.btn} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 17, fontWeight: "700" },
  content: { padding: 20, gap: 4 },
  imagePicker: {
    alignSelf: "center",
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    marginBottom: 24,
    gap: 4,
  },
  imageLabel: { fontSize: 11, fontWeight: "600" },
  imageHint: { fontSize: 10 },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  memberText: { fontSize: 14, fontWeight: "600" },
  btn: {},
});
