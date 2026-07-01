import { router, useLocalSearchParams } from "@/compat/router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
  const [localImageUri, setLocalImageUri] = useState("");
  const [uploading, setUploading] = useState(false);

  if (!user) return null;

  const handlePickImage = async () => {
    try {
      const response = await launchImageLibrary({ mediaType: "photo", quality: 0.7 });
      if (response.didCancel || !response.assets?.[0]) return;
      const asset = response.assets[0];
      if (!asset.uri) return;

      // Show local preview immediately
      setLocalImageUri(asset.uri);
      setUploading(true);

      const formData = new FormData();
      formData.append("file", {
        uri: Platform.OS === "android" && !asset.uri.startsWith("file://") ? `file://${asset.uri}` : asset.uri,
        type: asset.type || "image/jpeg",
        name: asset.fileName || "group_photo.jpg",
      } as any);

      const data = await customFetch<any>("/api/upload", {
        method: "POST",
        body: formData,
        timeoutMs: 60000,
      });
      setImageUrl(data.url);
      setUploading(false);
    } catch (e) {
      console.error("Upload error", e);
      setUploading(false);
      // Keep local preview but clear remote URL
      setImageUrl("");
    }
  };

  const previewUri = imageUrl || localImageUri;

  const handleCreate = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Group name is required";
    if (!description.trim()) e.description = "Description is required";
    if (uploading) e.name = "Please wait for image upload to finish";
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
            style={[styles.logoPicker, { backgroundColor: colors.card, borderColor: previewUri ? colors.primary : colors.border }]} 
            onPress={handlePickImage}
            activeOpacity={0.7}
          >
            {previewUri ? (
              <View style={styles.previewWrapper}>
                <Image source={{ uri: previewUri }} style={styles.imagePreview} />
                {uploading && (
                  <View style={styles.uploadOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
                <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
                  <Feather name="edit-2" size={12} color="#fff" />
                </View>
              </View>
            ) : (
              <View style={styles.logoPlaceholder}>
                <View style={[styles.iconWrapper, { backgroundColor: colors.primary + "20" }]}>
                  <Feather name="camera" size={24} color={colors.primary} />
                </View>
                <Text style={[styles.logoLabel, { color: colors.foreground }]}>Group Photo</Text>
                <Text style={[styles.logoHint, { color: colors.mutedForeground }]}>Tap to upload</Text>
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
  logoPicker: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    overflow: "hidden",
  },
  logoPlaceholder: { alignItems: "center", justifyContent: "center", gap: 4 },
  iconWrapper: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  logoLabel: { fontSize: 12, fontWeight: "600" },
  logoHint: { fontSize: 10 },
  previewWrapper: { width: 120, height: 120, position: "relative" },
  imagePreview: { width: 120, height: 120, borderRadius: 60 },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 60,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  editBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  memberText: { fontSize: 14, fontWeight: "600" },
  btn: { marginTop: 8 },
});
