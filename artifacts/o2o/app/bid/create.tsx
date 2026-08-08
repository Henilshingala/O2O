/**
 * Create Bid Screen — redesigned (BUG 2, 3, 4)
 *
 * Changes:
 * - Removed "Budget Per Product" field (BUG 3)
 * - Multi-media upload: 5 images + 5 videos (BUG 2)
 * - Full UI redesign with #2e7d32 green theme (BUG 4)
 * - Unit Type pill toggle (Carton / Loose) (FEATURE 10 partial)
 * - Quantity + Unit Type section (FEATURE 10 partial)
 */
import { router, useLocalSearchParams } from "@/compat/router";
import React, { useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "@/compat/image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import { launchImageLibrary } from "react-native-image-picker";
import * as Haptics from "@/compat/haptics";
import { useAuth } from "@/context/AuthContext";
import { uploadFile, uploadFiles } from "@/lib/uploadMedia";

const PRIMARY = "#2e7d32";
const BG = "#f5f5f5";
const CARD_BG = "#ffffff";
const BORDER_DEFAULT = "#e0e0e0";
const BORDER_FOCUS = "#2e7d32";
const MAX_IMAGES = 5;
const MAX_VIDEOS = 5;

interface MediaItem {
  uri: string;
  type: "image" | "video";
  uploadedUrl?: string;
  uploading?: boolean;
  error?: string;
}

function FocusableInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  inputStyle,
  error,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric";
  multiline?: boolean;
  inputStyle?: object;
  error?: string;
  editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={fi.wrapper}>
      <Text style={fi.label}>{label}</Text>
      <TextInput
        style={[
          fi.input,
          multiline && { height: 88, textAlignVertical: "top", paddingTop: 10 },
          { borderColor: error ? "#d32f2f" : focused ? BORDER_FOCUS : BORDER_DEFAULT },
          inputStyle,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9e9e9e"
        keyboardType={keyboardType ?? "default"}
        multiline={multiline}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {!!error && <Text style={fi.error}>{error}</Text>}
    </View>
  );
}

const fi = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "700", color: "#212121", marginBottom: 6 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#212121",
  },
  error: { color: "#d32f2f", fontSize: 12, marginTop: 4 },
});

export default function CreateBidScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ productName?: string; productImage?: string }>();

  const [productName, setProductName] = useState(params.productName ?? "");
  const [quantity, setQuantity] = useState("");
  const [unitType, setUnitType] = useState<"carton" | "loose">("carton");
  const [description, setDescription] = useState("");
  const [sellerMode, setSellerMode] = useState<"all" | "selected">("all");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [globalUploading, setGlobalUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!user) return null;

  const images = mediaItems.filter((m) => m.type === "image");
  const videos = mediaItems.filter((m) => m.type === "video");

  const handlePickMedia = async () => {
    const remainingImages = MAX_IMAGES - images.length;
    const remainingVideos = MAX_VIDEOS - videos.length;
    if (remainingImages <= 0 && remainingVideos <= 0) {
      Alert.alert("Limit Reached", "You have already selected the maximum number of media files.");
      return;
    }

    const result = await launchImageLibrary({
      mediaType: "mixed",
      selectionLimit: Math.min(remainingImages + remainingVideos, 10),
      quality: 0.7,
    });

    if (result.didCancel || !result.assets?.length) return;

    const newItems: MediaItem[] = [];
    let imgCount = images.length;
    let vidCount = videos.length;

    for (const asset of result.assets) {
      if (!asset.uri) continue;
      const isVideo = asset.type?.startsWith("video");
      if (isVideo) {
        if (vidCount >= MAX_VIDEOS) continue;
        vidCount++;
        newItems.push({ uri: asset.uri, type: "video" });
      } else {
        if (imgCount >= MAX_IMAGES) continue;
        imgCount++;
        newItems.push({ uri: asset.uri, type: "image" });
      }
    }

    if (newItems.length === 0) return;

    // Add placeholders immediately so user sees previews
    setMediaItems((prev) => [...prev, ...newItems.map((m) => ({ ...m, uploading: true }))]);
    setGlobalUploading(true);

    try {
      // Upload each in parallel
      await Promise.all(
        newItems.map(async (item, relIdx) => {
          const absIdx = mediaItems.length + relIdx;
          try {
            const ext = item.type === "video" ? ".mp4" : ".jpg";
            const mimeType = item.type === "video" ? "video/mp4" : "image/jpeg";
            const url = await uploadFile(
              { uri: item.uri, type: mimeType, fileName: `bid_${item.type}_${Date.now()}${ext}` },
              `bid_${item.type}${ext}`
            );
            setMediaItems((prev) =>
              prev.map((m, i) =>
                m.uri === item.uri && m.type === item.type
                  ? { ...m, uploadedUrl: url, uploading: false }
                  : m
              )
            );
          } catch (err: any) {
            setMediaItems((prev) =>
              prev.map((m) =>
                m.uri === item.uri && m.type === item.type
                  ? { ...m, uploading: false, error: "Upload failed" }
                  : m
              )
            );
          }
        })
      );
    } finally {
      setGlobalUploading(false);
    }
  };

  const removeMedia = (uri: string) => {
    setMediaItems((prev) => prev.filter((m) => m.uri !== uri));
  };

  const handleNext = () => {
    const e: Record<string, string> = {};
    if (!productName.trim()) e.productName = "Product name required";
    if (!quantity.trim() || isNaN(Number(quantity)) || Number(quantity) < 1)
      e.quantity = "Valid quantity required";
    if (!description.trim()) e.description = "Please add details (location, timeline, etc.)";
    if (globalUploading) e.media = "Please wait for uploads to finish";
    const failedUploads = mediaItems.filter((m) => m.error);
    if (failedUploads.length > 0) e.media = "Some uploads failed. Remove them and try again.";
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }

    const uploadedImages = mediaItems.filter((m) => m.type === "image" && m.uploadedUrl).map((m) => m.uploadedUrl!);
    const uploadedVideos = mediaItems.filter((m) => m.type === "video" && m.uploadedUrl).map((m) => m.uploadedUrl!);
    const firstImageUrl = uploadedImages[0] ?? "";

    router.push({
      pathname: "/bid/select-sellers",
      params: {
        productName,
        quantity,
        unitType,
        budget: "0", // Budget removed from form; keep field for API compatibility
        description,
        sellerMode,
        productImage: firstImageUrl,
        mediaImages: JSON.stringify(uploadedImages),
        mediaVideos: JSON.stringify(uploadedVideos),
      },
    });
  };

  const anyUploading = mediaItems.some((m) => m.uploading);

  return (
    <KeyboardAvoidingView style={styles.root} behavior="height">
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#212121" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Bid</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Feather name="info" size={15} color={PRIMARY} />
          <Text style={styles.infoText}>
            Create a bid to get competing offers from sellers. Best price wins!
          </Text>
        </View>

        {/* Media Upload Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Photos & Videos</Text>

          {/* Count badges */}
          <View style={styles.countRow}>
            <View style={[styles.countBadge, images.length >= MAX_IMAGES && styles.countBadgeFull]}>
              <Feather name="image" size={13} color={images.length >= MAX_IMAGES ? "#fff" : PRIMARY} />
              <Text style={[styles.countText, images.length >= MAX_IMAGES && styles.countTextFull]}>
                {images.length}/{MAX_IMAGES} Images
              </Text>
            </View>
            <View style={[styles.countBadge, videos.length >= MAX_VIDEOS && styles.countBadgeFull]}>
              <Feather name="video" size={13} color={videos.length >= MAX_VIDEOS ? "#fff" : PRIMARY} />
              <Text style={[styles.countText, videos.length >= MAX_VIDEOS && styles.countTextFull]}>
                {videos.length}/{MAX_VIDEOS} Videos
              </Text>
            </View>
          </View>

          {/* Media grid */}
          {mediaItems.length === 0 ? (
            <TouchableOpacity style={styles.emptyMediaBox} onPress={handlePickMedia}>
              <Feather name="camera" size={32} color={PRIMARY} />
              <Text style={styles.emptyMediaLabel}>Add Photos & Videos</Text>
              <Text style={styles.emptyMediaSub}>Up to 5 images and 5 videos</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mediaScroll}
            >
              {mediaItems.map((item) => (
                <View key={item.uri} style={styles.mediaThumb}>
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.mediaThumbImg}
                    contentFit="cover"
                  />
                  {/* Type badge */}
                  <View style={styles.mediaTypeBadge}>
                    <Feather
                      name={item.type === "video" ? "video" : "image"}
                      size={10}
                      color="#fff"
                    />
                  </View>
                  {/* Uploading overlay */}
                  {item.uploading && (
                    <View style={styles.mediaOverlay}>
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  )}
                  {/* Error overlay */}
                  {item.error && (
                    <View style={[styles.mediaOverlay, { backgroundColor: "rgba(211,47,47,0.7)" }]}>
                      <Feather name="alert-circle" size={16} color="#fff" />
                    </View>
                  )}
                  {/* Remove button */}
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeMedia(item.uri)}
                    hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                  >
                    <Feather name="x" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {/* Add more button */}
              {(images.length < MAX_IMAGES || videos.length < MAX_VIDEOS) && (
                <TouchableOpacity style={styles.addMoreBtn} onPress={handlePickMedia}>
                  <Feather name="plus" size={24} color={PRIMARY} />
                  <Text style={styles.addMoreLabel}>Add</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
          {!!errors.media && <Text style={styles.errorText}>{errors.media}</Text>}
        </View>

        {/* Product Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Product Details</Text>
          <FocusableInput
            label="Product Name"
            value={productName}
            onChangeText={setProductName}
            placeholder="What do you want to buy?"
            error={errors.productName}
            editable={!anyUploading}
          />
          <FocusableInput
            label="Bid Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Add delivery requirements, location, timeline..."
            multiline
            error={errors.description}
            editable={!anyUploading}
          />
        </View>

        {/* Quantity + Unit Type Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quantity & Unit</Text>
          <FocusableInput
            label="Quantity Needed"
            value={quantity}
            onChangeText={setQuantity}
            placeholder="How many units?"
            keyboardType="numeric"
            error={errors.quantity}
            editable={!anyUploading}
          />
          <Text style={fi.label}>Unit Type</Text>
          <View style={styles.pillRow}>
            {(["carton", "loose"] as const).map((u) => (
              <TouchableOpacity
                key={u}
                style={[
                  styles.pill,
                  unitType === u
                    ? styles.pillActive
                    : styles.pillInactive,
                ]}
                onPress={() => setUnitType(u)}
              >
                <Text
                  style={[
                    styles.pillText,
                    unitType === u ? styles.pillTextActive : styles.pillTextInactive,
                  ]}
                >
                  {u.charAt(0).toUpperCase() + u.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Select Sellers Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Sellers</Text>
          <View style={styles.sellerPillRow}>
            {(["all", "selected"] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.sellerPill,
                  sellerMode === mode ? styles.sellerPillActive : styles.sellerPillInactive,
                ]}
                onPress={() => setSellerMode(mode)}
              >
                <Text
                  style={[
                    styles.sellerPillText,
                    sellerMode === mode ? styles.sellerPillTextActive : styles.sellerPillTextInactive,
                  ]}
                >
                  {mode === "all" ? "All Sellers" : "Selected Sellers"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Timer info */}
        <View style={styles.timerBanner}>
          <Feather name="clock" size={15} color="#D97706" />
          <Text style={styles.timerText}>
            Bid will run for 30 minutes. Sellers will send offers during this time.
          </Text>
        </View>

        {/* Spacer for fixed button */}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Fixed NEXT button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.nextBtn, anyUploading && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={anyUploading}
        >
          {anyUploading ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.nextBtnText}>Uploading...</Text>
            </>
          ) : (
            <Text style={styles.nextBtnText}>NEXT →</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD_BG,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_DEFAULT,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#212121" },

  content: { padding: 16, gap: 0 },

  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#e8f5e9",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 13, color: "#1b5e20", lineHeight: 18 },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    // subtle shadow
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#212121",
    marginBottom: 14,
  },

  // Media
  countRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    backgroundColor: "#e8f5e9",
  },
  countBadgeFull: { backgroundColor: PRIMARY },
  countText: { fontSize: 12, fontWeight: "700", color: PRIMARY },
  countTextFull: { color: "#fff" },

  emptyMediaBox: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: PRIMARY,
    borderRadius: 12,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#f1f8e9",
  },
  emptyMediaLabel: { fontSize: 14, fontWeight: "700", color: PRIMARY },
  emptyMediaSub: { fontSize: 12, color: "#558b2f" },

  mediaScroll: { gap: 10, paddingBottom: 4 },
  mediaThumb: {
    width: 88,
    height: 88,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  mediaThumbImg: { width: "100%", height: "100%" },
  mediaTypeBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  mediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  addMoreBtn: {
    width: 88,
    height: 88,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f8e9",
    gap: 4,
  },
  addMoreLabel: { fontSize: 11, fontWeight: "700", color: PRIMARY },

  errorText: { color: "#d32f2f", fontSize: 12, marginTop: 6 },

  // Pill toggles (Unit Type)
  pillRow: { flexDirection: "row", gap: 10 },
  pill: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 2,
  },
  pillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  pillInactive: { backgroundColor: "#fff", borderColor: BORDER_DEFAULT },
  pillText: { fontSize: 14, fontWeight: "700" },
  pillTextActive: { color: "#fff" },
  pillTextInactive: { color: "#757575" },

  // Seller pills
  sellerPillRow: { flexDirection: "row", gap: 10 },
  sellerPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: "center",
  },
  sellerPillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  sellerPillInactive: { backgroundColor: "#fff", borderColor: BORDER_DEFAULT },
  sellerPillText: { fontSize: 14, fontWeight: "700" },
  sellerPillTextActive: { color: "#fff" },
  sellerPillTextInactive: { color: "#757575" },

  timerBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  timerText: { flex: 1, fontSize: 13, color: "#92400E", lineHeight: 18 },

  footer: {
    backgroundColor: CARD_BG,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER_DEFAULT,
  },
  nextBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  nextBtnDisabled: { backgroundColor: "#a5d6a7" },
  nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
