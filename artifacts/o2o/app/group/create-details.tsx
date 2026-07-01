import { router, useLocalSearchParams } from "@/compat/router";
import React, { useState } from "react";
import {
  Image,
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
import { launchImageLibrary } from "react-native-image-picker";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { customFetch } from "@workspace/api-client-react";

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
  const [imageUrl, setImageUrl] = useState("");

  if (!user) return null;

  const handlePickImage = async () => {
    try {
      const response = await launchImageLibrary({ mediaType: "photo", quality: 0.8 });
      if (response.assets?.[0]) {
        const asset = response.assets[0];
        const formData = new FormData();
        formData.append("file", {
          uri: Platform.OS === "android" && !asset.uri?.startsWith("file://") ? `file://${asset.uri}` : asset.uri,
          type: asset.type || "image/jpeg",
          name: asset.fileName || "upload.jpg",
        } as any);
        const data = await customFetch<any>("/api/upload", { method: "POST", body: formData });
        setImageUrl(data.url);
      }
    } catch (e) {
      console.error("Upload error", e);
    }
  };

  const handleCreate = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Group name is required";
    if (!description.trim()) e.description = "Description is required";
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setLoading(true);
    try {
      const group = await createGroup({
        name: name.trim(),
        description: description.trim(),
        members,
        createdBy: user.id,
        image: imageUrl || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: "/group/[id]", params: { id: group.id } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "web" ? "padding" : "height"}
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
        <View style={styles.imageContainer}>
          <TouchableOpacity 
            style={[styles.logoPicker, { backgroundColor: colors.card, borderColor: colors.primary }]} 
            onPress={handlePickImage}
          >
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <View style={[styles.iconWrapper, { backgroundColor: colors.primary + "20" }]}>
                  <Feather name="image" size={28} color={colors.primary} />
                </View>
                <Text style={[styles.logoLabel, { color: colors.foreground }]}>Group Photo</Text>
                <Text style={[styles.logoHint, { color: colors.mutedForeground }]}>Tap to upload (optional)</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

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
  content: { padding: 20, gap: 16 },
  imageContainer: { alignItems: "center", marginBottom: 8 },
  logoPicker: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center", borderWidth: 2, borderStyle: "dashed", overflow: "hidden" },
  logoPlaceholder: { alignItems: "center", justifyContent: "center", gap: 4 },
  iconWrapper: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  logoLabel: { fontSize: 12, fontWeight: "600" },
  logoHint: { fontSize: 10 },
  imagePreview: { width: 120, height: 120, borderRadius: 60 },
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
