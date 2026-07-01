import { router, useLocalSearchParams } from "@/compat/router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import * as Haptics from "@/compat/haptics";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { customFetch } from "@workspace/api-client-react";
import { launchImageLibrary } from "react-native-image-picker";
import type { ProductDetail } from "@/types";

export default function CreateProductPost() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { createProduct } = useData();
  const params = useLocalSearchParams<{ channelId: string }>();

  const [form, setForm] = useState({ name: "", description: "", price: "" });
  const [details, setDetails] = useState<ProductDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailName, setDetailName] = useState("");
  const [detailValue, setDetailValue] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [localImageUri, setLocalImageUri] = useState("");
  const [uploading, setUploading] = useState(false);

  if (!user) return null;

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handlePost = async () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Product name is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.price.trim() || isNaN(Number(form.price))) e.price = "Valid price required";
    if (uploading) e.name = "Please wait for image upload to finish";
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setLoading(true);
    try {
      await createProduct(params.channelId, {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        details,
        image: imageUrl || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setLoading(false);
    }
  };

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
        name: asset.fileName || "product_image.jpg",
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

  const addDetail = () => {
    if (!detailName.trim() || !detailValue.trim()) return;
    setDetails((d) => [...d, { name: detailName.trim(), value: detailValue.trim() }]);
    setDetailName("");
    setDetailValue("");
    setShowDetailModal(false);
  };

  const removeDetail = (idx: number) => setDetails((d) => d.filter((_, i) => i !== idx));

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
        <Text style={[styles.title, { color: colors.foreground }]}>Create Product Post</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.imageContainer}>
          <TouchableOpacity 
            style={[
              styles.imagePicker, 
              { 
                backgroundColor: colors.card, 
                borderColor: previewUri ? colors.primary : colors.border,
                borderStyle: previewUri ? "solid" : "dashed" 
              }
            ]} 
            onPress={handlePickImage}
            activeOpacity={0.7}
          >
            {previewUri ? (
              <View style={styles.previewWrapper}>
                <Image source={{ uri: previewUri }} style={styles.imagePreview} resizeMode="cover" />
                {uploading && (
                  <View style={styles.uploadOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.uploadText}>Uploading...</Text>
                  </View>
                )}
                <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
                  <Feather name="edit-2" size={14} color="#fff" />
                </View>
              </View>
            ) : (
              <View style={styles.imagePlaceholder}>
                <View style={[styles.iconWrapper, { backgroundColor: colors.primary + "20" }]}>
                  <Feather name="camera" size={28} color={colors.primary} />
                </View>
                <Text style={[styles.imageLabel, { color: colors.foreground }]}>Product Image</Text>
                <Text style={[styles.imageHint, { color: colors.mutedForeground }]}>Tap to upload (optional)</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <AppInput label="Product Name" value={form.name} onChangeText={set("name")} placeholder="Enter product name" error={errors.name} />
        <AppInput label="Product Description" value={form.description} onChangeText={set("description")} placeholder="Describe your product" multiline style={{ height: 90, textAlignVertical: "top", paddingTop: 10 }} error={errors.description} />
        <AppInput label="Product Price (₹)" value={form.price} onChangeText={set("price")} placeholder="Enter price" keyboardType="numeric" error={errors.price} />

        {/* Product Details */}
        <Text style={[styles.detailsLabel, { color: colors.foreground }]}>Product Details</Text>
        {details.map((d, idx) => (
          <View key={idx} style={[styles.detailRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Text style={[styles.detailText, { color: colors.foreground }]}>
              <Text style={{ fontWeight: "700" }}>{d.name}: </Text>{d.value}
            </Text>
            <TouchableOpacity onPress={() => removeDetail(idx)}>
              <Feather name="x" size={16} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.addDetailBtn, { borderColor: colors.primary }]}
          onPress={() => setShowDetailModal(true)}
        >
          <Feather name="plus" size={16} color={colors.primary} />
          <Text style={[styles.addDetailText, { color: colors.primary }]}>Add Detail</Text>
        </TouchableOpacity>

        <AppButton title="POST PRODUCT" onPress={handlePost} loading={loading} style={styles.btn} />
      </ScrollView>

      {/* Add Detail Modal */}
      <Modal visible={showDetailModal} transparent animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Product Detail</Text>
            <AppInput label="Detail Name" value={detailName} onChangeText={setDetailName} placeholder="e.g. Material" />
            <AppInput label="Detail Value" value={detailValue} onChangeText={setDetailValue} placeholder="e.g. Cotton" />
            <View style={styles.modalBtns}>
              <AppButton title="Cancel" variant="outline" onPress={() => setShowDetailModal(false)} style={{ flex: 1 }} />
              <AppButton title="ADD DETAIL" onPress={addDetail} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 17, fontWeight: "700" },
  content: { padding: 20, gap: 16 },
  imageContainer: { marginBottom: 4 },
  imagePicker: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    overflow: "hidden",
  },
  imagePlaceholder: { alignItems: "center", justifyContent: "center", gap: 4 },
  iconWrapper: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  imageLabel: { fontSize: 13, fontWeight: "600" },
  imageHint: { fontSize: 12 },
  previewWrapper: { width: "100%", height: "100%", position: "relative" },
  imagePreview: { width: "100%", height: "100%", borderRadius: 12 },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  uploadText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  editBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  detailsLabel: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
  detailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  detailText: { fontSize: 13, flex: 1 },
  addDetailBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderRadius: 10, padding: 12, borderStyle: "dashed" },
  addDetailText: { fontSize: 14, fontWeight: "600" },
  btn: { marginTop: 8 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 8 },
});
