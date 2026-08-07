import { router, useLocalSearchParams } from "@/compat/router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { launchImageLibrary } from "react-native-image-picker";
import { uploadFiles } from "@/lib/uploadMedia";
import type { ProductDetail } from "@/types";

const MAX_IMAGES = 5;
const MAX_VIDEOS = 3;

export default function CreateProductPost() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { createProduct } = useData();
  const params = useLocalSearchParams<{ channelId: string }>();

  const mounted = useRef(true);
  useEffect(() => {
    return () => { mounted.current = false; };
  }, []);

  const [form, setForm] = useState({ name: "", description: "", price: "", productCode: "" });
  const [details, setDetails] = useState<ProductDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailName, setDetailName] = useState("");
  const [detailValue, setDetailValue] = useState("");

  // Images
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [localPreviews, setLocalPreviews] = useState<string[]>([]);

  // Videos
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [localVideoUris, setLocalVideoUris] = useState<string[]>([]);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  if (!user) return null;

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handlePickImages = async () => {
    const remaining = MAX_IMAGES - localPreviews.length;
    if (remaining <= 0) {
      Alert.alert("Limit Reached", `Maximum ${MAX_IMAGES} images allowed.`);
      return;
    }
    try {
      const response = await launchImageLibrary({
        mediaType: "photo",
        quality: 0.8,
        selectionLimit: remaining,
      });
      if (response.didCancel || !response.assets?.length) return;

      const newAssets = response.assets.filter((a) => a.uri);
      if (!mounted.current) return;

      const newPreviews = newAssets.map((a) => a.uri!);
      setLocalPreviews((prev) => [...prev, ...newPreviews]);
      setUploading(true);
      setUploadProgress("Uploading images…");

      const uploadAssets = newAssets.map((a) => ({ uri: a.uri!, type: a.type, fileName: a.fileName }));
      const urls = await uploadFiles(uploadAssets, {
        concurrency: 3,
        onProgress: (i, p) => {
          if (mounted.current) setUploadProgress(`Image ${i + 1}: ${p.percent}%`);
        },
      });

      if (!mounted.current) return;
      setImageUrls((prev) => [...prev, ...urls]);
      setUploadProgress("");
    } catch (e: any) {
      if (mounted.current) {
        Alert.alert("Upload Failed", e?.message ?? "Could not upload images. Please try again.");
        setUploadProgress("");
      }
    } finally {
      if (mounted.current) setUploading(false);
    }
  };

  const handlePickVideos = async () => {
    const remaining = MAX_VIDEOS - localVideoUris.length;
    if (remaining <= 0) {
      Alert.alert("Limit Reached", `Maximum ${MAX_VIDEOS} videos allowed.`);
      return;
    }
    try {
      const response = await launchImageLibrary({
        mediaType: "video",
        quality: 0.8,
        selectionLimit: remaining,
      });
      if (response.didCancel || !response.assets?.length) return;

      const newAssets = response.assets.filter((a) => a.uri);
      if (!mounted.current) return;

      const newUris = newAssets.map((a) => a.uri!);
      setLocalVideoUris((prev) => [...prev, ...newUris]);
      setUploading(true);
      setUploadProgress("Uploading videos…");

      const uploadAssets = newAssets.map((a) => ({ uri: a.uri!, type: a.type ?? "video/mp4", fileName: a.fileName ?? "video.mp4" }));
      const urls = await uploadFiles(uploadAssets, {
        concurrency: 2,
        onProgress: (i, p) => {
          if (mounted.current) setUploadProgress(`Video ${i + 1}: ${p.percent}%`);
        },
      });

      if (!mounted.current) return;
      setVideoUrls((prev) => [...prev, ...urls]);
      setUploadProgress("");
    } catch (e: any) {
      if (mounted.current) {
        Alert.alert("Upload Failed", e?.message ?? "Could not upload videos. Please try again.");
        setUploadProgress("");
      }
    } finally {
      if (mounted.current) setUploading(false);
    }
  };

  const removeImage = (idx: number) => {
    setLocalPreviews((prev) => prev.filter((_, i) => i !== idx));
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeVideo = (idx: number) => {
    setLocalVideoUris((prev) => prev.filter((_, i) => i !== idx));
    setVideoUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePost = async () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Product name is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.price.trim() || isNaN(Number(form.price))) e.price = "Valid price required";
    if (localPreviews.length === 0 && localVideoUris.length === 0) e.media = "At least 1 image or video is required";
    if (uploading) e.media = "Please wait for uploads to finish";
    if (imageUrls.length < localPreviews.length) e.media = "Some images are still uploading, please wait";
    if (videoUrls.length < localVideoUris.length) e.media = "Some videos are still uploading, please wait";
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setLoading(true);
    setErrors({});
    try {
      const allDetails = form.productCode.trim()
        ? [{ name: "Code", value: form.productCode.trim() }, ...details]
        : details;

      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        details: allDetails,
        image: imageUrls[0] ?? undefined,
        images: imageUrls,
        videoUrl: videoUrls[0] ?? undefined,
      };

      console.log("[CreateProduct] Request Payload:", JSON.stringify(payload, null, 2));

      await createProduct(params.channelId, payload as any);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (mounted.current) router.back();
    } catch (err: any) {
      console.log("[CreateProduct] Request Failed - Error:", err, err?.message);
      if (err?.cause) console.log("[CreateProduct] Error Cause:", err.cause);
      if (err?.response) console.log("[CreateProduct] Error Response:", err.response);

      if (mounted.current) {
        Alert.alert("Post Failed", err?.message ?? "Could not create product. Please try again.");
        setLoading(false);
      }
    }
  };

  const addDetail = () => {
    if (!detailName.trim() || !detailValue.trim()) return;
    setDetails((d) => [...d, { name: detailName.trim(), value: detailValue.trim() }]);
    setDetailName("");
    setDetailValue("");
    setShowDetailModal(false);
  };

  const removeDetail = (idx: number) => setDetails((d) => d.filter((_, i) => i !== idx));

  const imagePreviews = localPreviews;
  const videoPreviews = localVideoUris;
  const allUploaded = imageUrls.length >= localPreviews.length && videoUrls.length >= localVideoUris.length;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="height">
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Create Product Post</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Images ── */}
        <View>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              Images ({imagePreviews.length}/{MAX_IMAGES})
            </Text>
            {imagePreviews.length < MAX_IMAGES && (
              <TouchableOpacity onPress={handlePickImages} disabled={uploading}>
                <Text style={[styles.addLink, { color: colors.primary }]}>+ Add</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {imagePreviews.map((uri, idx) => (
              <View key={idx} style={styles.thumbWrap}>
                <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
                {imageUrls[idx] == null && (
                  <View style={styles.thumbOverlay}>
                    <ActivityIndicator color="#fff" size="small" />
                  </View>
                )}
                <TouchableOpacity style={styles.thumbRemove} onPress={() => removeImage(idx)}>
                  <Feather name="x" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {imagePreviews.length < MAX_IMAGES && (
              <TouchableOpacity
                style={[styles.addImageBtn, { borderColor: colors.primary, backgroundColor: colors.card }]}
                onPress={handlePickImages}
                disabled={uploading}
              >
                <Feather name="image" size={24} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 11, marginTop: 4 }}>Add Images</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* ── Videos ── */}
        <View>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              Videos ({videoPreviews.length}/{MAX_VIDEOS})
            </Text>
            {videoPreviews.length < MAX_VIDEOS && (
              <TouchableOpacity onPress={handlePickVideos} disabled={uploading}>
                <Text style={[styles.addLink, { color: colors.primary }]}>+ Add</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {videoPreviews.map((_, idx) => (
              <View key={idx} style={styles.thumbWrap}>
                <View style={[styles.thumbImage, { backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }]}>
                  <Feather name="play-circle" size={32} color={colors.primary} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 4 }}>Video {idx + 1}</Text>
                </View>
                {videoUrls[idx] == null && (
                  <View style={styles.thumbOverlay}>
                    <ActivityIndicator color="#fff" size="small" />
                  </View>
                )}
                <TouchableOpacity style={styles.thumbRemove} onPress={() => removeVideo(idx)}>
                  <Feather name="x" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {videoPreviews.length < MAX_VIDEOS && (
              <TouchableOpacity
                style={[styles.addImageBtn, { borderColor: colors.primary, backgroundColor: colors.card }]}
                onPress={handlePickVideos}
                disabled={uploading}
              >
                <Feather name="video" size={24} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 11, marginTop: 4 }}>Add Video</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* Upload progress */}
        {uploading && (
          <View style={[styles.progressRow, { backgroundColor: colors.muted }]}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={{ color: colors.mutedForeground, fontSize: 13, marginLeft: 10 }}>
              {uploadProgress || "Uploading…"}
            </Text>
          </View>
        )}
        {!!errors.media && <Text style={{ color: colors.destructive, fontSize: 12, marginBottom: 8 }}>{errors.media}</Text>}

        <AppInput label="Product Code" value={form.productCode} onChangeText={set("productCode")} placeholder="e.g. SKU-001 (optional)" />
        <AppInput label="Product Name *" value={form.name} onChangeText={set("name")} placeholder="Enter product name" error={errors.name} />
        <AppInput label="Product Description *" value={form.description} onChangeText={set("description")} placeholder="Describe your product" multiline style={{ height: 90, textAlignVertical: "top", paddingTop: 10 }} error={errors.description} />
        <AppInput label="Product Price (₹) *" value={form.price} onChangeText={set("price")} placeholder="Enter price" keyboardType="numeric" error={errors.price} />

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

        <TouchableOpacity style={[styles.addDetailBtn, { borderColor: colors.primary }]} onPress={() => setShowDetailModal(true)}>
          <Feather name="plus" size={16} color={colors.primary} />
          <Text style={[styles.addDetailText, { color: colors.primary }]}>Add Detail</Text>
        </TouchableOpacity>

        <AppButton
          title={uploading ? "UPLOADING…" : "POST PRODUCT"}
          onPress={handlePost}
          loading={loading}
          disabled={uploading || (!allUploaded && (localPreviews.length > 0 || localVideoUris.length > 0))}
          style={styles.btn}
        />
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
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionLabel: { fontSize: 13, fontWeight: "700" },
  addLink: { fontSize: 13, fontWeight: "600" },
  thumbWrap: { position: "relative", marginRight: 10 },
  thumbImage: { width: 100, height: 100, borderRadius: 10 },
  thumbOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  thumbRemove: { position: "absolute", top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 8, width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  addImageBtn: { width: 100, height: 100, borderRadius: 10, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  progressRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, marginBottom: 4 },
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
