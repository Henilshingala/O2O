import { router } from "@/compat/router";
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

const CATEGORIES = ["Electronics", "Fashion", "Food", "Beauty", "Home", "Books", "Sports", "Automotive", "Other"];

export default function CreateChannelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { createChannel } = useData();
  const [form, setForm] = useState({ name: "", description: "", category: "", visibility: "public" as "public" | "private" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [localImageUri, setLocalImageUri] = useState("");
  const [uploading, setUploading] = useState(false);

  if (!user || user.role !== "seller") return null;

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

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
        name: asset.fileName || "channel_logo.jpg",
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
      setImageUrl("");
    }
  };

  const previewUri = imageUrl || localImageUri;

  const handleCreate = async () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Channel name is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.category) e.category = "Please select a category";
    if (uploading) e.name = "Please wait for image upload to finish";
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setLoading(true);
    try {
      const channel = await createChannel({
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        visibility: form.visibility,
        ownerId: user.id,
        image: imageUrl || undefined,
      } as any);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: "/channel/[id]", params: { id: channel.id } });
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
        <Text style={[styles.title, { color: colors.foreground }]}>Create Channel</Text>
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
                <Text style={[styles.logoLabel, { color: colors.foreground }]}>Channel Logo</Text>
                <Text style={[styles.logoHint, { color: colors.mutedForeground }]}>Tap to upload</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <AppInput label="Channel Name" value={form.name} onChangeText={set("name")} placeholder="Enter channel name" error={errors.name} />
        <AppInput label="Channel Description" value={form.description} onChangeText={set("description")} placeholder="Describe your channel" multiline style={{ height: 90, textAlignVertical: "top", paddingTop: 10 }} error={errors.description} />

        <Text style={[styles.label, { color: colors.foreground }]}>Category</Text>
        <TouchableOpacity
          style={[styles.dropdown, { borderColor: errors.category ? colors.destructive : colors.border, backgroundColor: colors.card }]}
          onPress={() => setShowCategories(!showCategories)}
        >
          <Text style={[styles.dropdownText, { color: form.category ? colors.foreground : colors.mutedForeground }]}>
            {form.category || "Select Category"}
          </Text>
          <Feather name={showCategories ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
        {errors.category && <Text style={[styles.fieldError, { color: colors.destructive }]}>{errors.category}</Text>}
        {showCategories && (
          <View style={[styles.categoryList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryItem, { borderBottomColor: colors.border }]}
                onPress={() => { set("category")(cat); setShowCategories(false); setErrors((e) => ({ ...e, category: "" })); }}
              >
                <Text style={[styles.categoryText, { color: colors.foreground }]}>{cat}</Text>
                {form.category === cat && <Feather name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={[styles.label, { color: colors.foreground, marginTop: 8 }]}>Visibility</Text>
        <View style={styles.radioRow}>
          {(["public", "private"] as const).map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.radioOption, { borderColor: form.visibility === v ? colors.primary : colors.border, backgroundColor: form.visibility === v ? colors.secondary : colors.card }]}
              onPress={() => set("visibility")(v)}
            >
              <View style={[styles.radio, { borderColor: form.visibility === v ? colors.primary : colors.border }]}>
                {form.visibility === v && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
              </View>
              <Text style={[styles.radioText, { color: colors.foreground }]}>{v.charAt(0).toUpperCase() + v.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <AppButton title="CREATE CHANNEL" onPress={handleCreate} loading={loading} style={styles.btn} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
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
  label: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  dropdown: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, height: 48, marginBottom: 4 },
  dropdownText: { fontSize: 15 },
  fieldError: { fontSize: 12, marginBottom: 8 },
  categoryList: { borderWidth: 1, borderRadius: 10, overflow: "hidden", marginBottom: 8 },
  categoryItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  categoryText: { fontSize: 14 },
  radioRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  radioOption: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1.5 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  radioText: { fontSize: 14, fontWeight: "600" },
  btn: { marginTop: 8 },
});
