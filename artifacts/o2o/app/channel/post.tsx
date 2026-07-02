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
import { launchImageLibrary } from "react-native-image-picker";
import { uploadFile, uploadFiles } from "@/lib/uploadMedia";
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
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [localPreviews, setLocalPreviews] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [localVideoUri, setLocalVideoUri] = useState("");
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
        image: imageUrls[0] || undefined,
        images: imageUrls,
        videoUrl: videoUrl || undefined,
      } as any);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handlePickImages = async () => {
    try {
      const response = await launchImageLibrary({ mediaType: "photo", quality: 0.7, selectionLimit: 10 });
      if (response.didCancel || !response.assets?.length) return;
      setUploading(true);
      const previews = response.assets.map((a) => a.uri!).filter(Boolean);
      setLocalPreviews((prev) => [...prev, ...previews]);
      const urls = await uploadFiles(response.assets.map((a) => ({ uri: a.uri!, type: a.type, fileName: a.fileName })));
      setImageUrls((prev) => [...prev, ...urls]);
    } catch (e) {
      console.error("Upload error", e);
    } finally {
      setUploading(false);
    }
  };

  const handlePickVideo = async () => {
    try {
      const response = await launchImageLibrary({ mediaType: "video", quality: 0.8 });
      if (response.didCancel || !response.assets?.[0]?.uri) return;
      const asset = response.assets[0];
      setLocalVideoUri(asset.uri!);
      setUploading(true);
      const url = await uploadFile(asset, "product_video.mp4");
      setVideoUrl(url);
    } catch (e) {
      console.error("Video upload error", e);
      setVideoUrl("");
    } finally {
      setUploading(false);
    }
  };

  const previews = imageUrls.length > 0 ? imageUrls : localPreviews;
  const videoPreview = videoUrl || localVideoUri;

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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {previews.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
            ))}
            <TouchableOpacity
              style={[styles.addImageBtn, { borderColor: colors.primary, backgroundColor: colors.card }]}
              onPress={handlePickImages}
            >
              <Feather name="plus" size={28} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 11, marginTop: 4 }}>Add Images</Text>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity
            style={[styles.videoPicker, { backgroundColor: colors.card, borderColor: videoPreview ? colors.primary : colors.border }]}
            onPress={handlePickVideo}
          >
            {videoPreview ? (
              <View style={styles.videoPreview}>
                <Feather name="play-circle" size={40} color={colors.primary} />
                <Text style={{ color: colors.foreground, marginTop: 8 }}>Video selected</Text>
              </View>
            ) : (
              <>
                <Feather name="video" size={28} color={colors.primary} />
                <Text style={[styles.imageLabel, { color: colors.foreground }]}>Add Product Video (optional)</Text>
              </>
            )}
            {uploading && <ActivityIndicator style={{ marginTop: 8 }} color={colors.primary} />}
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
  thumbImage: { width: 100, height: 100, borderRadius: 10, marginRight: 10 },
  addImageBtn: { width: 100, height: 100, borderRadius: 10, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  videoPicker: { width: "100%", height: 100, borderRadius: 12, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  videoPreview: { alignItems: "center", justifyContent: "center" },
  imageLabel: { fontSize: 13, fontWeight: "600" },
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
