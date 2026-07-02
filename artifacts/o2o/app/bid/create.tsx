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
import { launchImageLibrary } from "react-native-image-picker";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { uploadFile } from "@/lib/uploadMedia";

export default function CreateBidScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ productName?: string; productImage?: string }>();

  const [form, setForm] = useState({
    productName: params.productName ?? "",
    quantity: "",
    budget: "",
    description: "",
  });
  const [productImage, setProductImage] = useState(params.productImage ?? "");
  const [localImageUri, setLocalImageUri] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sellerMode, setSellerMode] = useState<"all" | "selected">("all");
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!user) return null;
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handlePickImage = async () => {
    const response = await launchImageLibrary({ mediaType: "photo", quality: 0.7 });
    if (response.didCancel || !response.assets?.[0]?.uri) return;
    const asset = response.assets[0];
    setLocalImageUri(asset.uri!);
    setUploading(true);
    try {
      const url = await uploadFile(asset, "bid_product.jpg");
      setProductImage(url);
    } catch (e) {
      console.error("Bid image upload failed", e);
      setProductImage("");
    } finally {
      setUploading(false);
    }
  };

  const previewUri = productImage || localImageUri;

  const handleNext = () => {
    const e: Record<string, string> = {};
    if (!form.productName.trim()) e.productName = "Product name required";
    if (!form.quantity.trim() || isNaN(Number(form.quantity))) e.quantity = "Valid quantity required";
    if (!form.budget.trim() || isNaN(Number(form.budget))) e.budget = "Valid budget required";
    if (uploading) e.productName = "Please wait for image upload";
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    router.push({
      pathname: "/bid/select-sellers",
      params: {
        ...form,
        sellerMode,
        productImage: productImage || "",
      },
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "web" ? "padding" : "height"}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Create Bid</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.infoBox, { backgroundColor: colors.secondary }]}>
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.foreground }]}>
            Create a bid to get competing offers from sellers. Best price wins!
          </Text>
        </View>

        <TouchableOpacity style={[styles.imageBox, { backgroundColor: colors.muted, borderColor: previewUri ? colors.primary : colors.border }]} onPress={handlePickImage}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <>
              <Feather name="camera" size={28} color={colors.mutedForeground} />
              <Text style={[styles.imageLabel, { color: colors.mutedForeground }]}>Tap to upload product image</Text>
            </>
          )}
          {uploading && <Text style={[styles.uploadLabel, { color: colors.primary }]}>Uploading...</Text>}
        </TouchableOpacity>

        <AppInput label="Product Name" value={form.productName} onChangeText={set("productName")} placeholder="What do you want to buy?" error={errors.productName} />
        <AppInput label="Quantity Needed" value={form.quantity} onChangeText={set("quantity")} placeholder="How many units?" keyboardType="numeric" error={errors.quantity} />
        <AppInput label="Budget Per Product (₹)" value={form.budget} onChangeText={set("budget")} placeholder="Your max price per unit" keyboardType="numeric" error={errors.budget} />
        <AppInput label="Bid Description" value={form.description} onChangeText={set("description")} placeholder="Add delivery requirements, location, timeline..." multiline style={{ height: 90, textAlignVertical: "top", paddingTop: 10 }} />

        <Text style={[styles.label, { color: colors.foreground }]}>Select Sellers</Text>
        <View style={styles.radioRow}>
          {(["all", "selected"] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.radioOption, { borderColor: sellerMode === mode ? colors.primary : colors.border, backgroundColor: sellerMode === mode ? colors.secondary : colors.card }]}
              onPress={() => setSellerMode(mode)}
            >
              <View style={[styles.radio, { borderColor: sellerMode === mode ? colors.primary : colors.border }]}>
                {sellerMode === mode && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
              </View>
              <Text style={[styles.radioText, { color: colors.foreground }]}>
                {mode === "all" ? "All Sellers" : "Selected Sellers"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.timerInfo, { backgroundColor: "#FEF3C7" }]}>
          <Feather name="clock" size={16} color="#D97706" />
          <Text style={{ color: "#92400E", fontSize: 13, flex: 1 }}>
            Bid will run for 30 minutes. Sellers will send offers during this time.
          </Text>
        </View>

        <AppButton title="NEXT →" onPress={handleNext} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 17, fontWeight: "700" },
  content: { padding: 20, gap: 4 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, marginBottom: 20 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  imageBox: { height: 160, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 20, gap: 8, borderWidth: 2, borderStyle: "dashed", overflow: "hidden" },
  productImage: { width: "100%", height: "100%" },
  imageLabel: { fontSize: 12 },
  uploadLabel: { position: "absolute", bottom: 8, fontSize: 12, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 10 },
  radioRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  radioOption: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1.5 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  radioText: { fontSize: 13, fontWeight: "600" },
  timerInfo: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, marginBottom: 20 },
});
