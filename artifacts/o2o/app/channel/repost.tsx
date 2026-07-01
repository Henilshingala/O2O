import { router, useLocalSearchParams } from "@/compat/router";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
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
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import type { ProductDetail } from "@/types";

export default function RepostProductScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getChannel, repostProduct } = useData();
  const params = useLocalSearchParams<{ channelId: string; productId: string }>();
  const channel = getChannel(params.channelId);
  const product = channel?.products.find((p) => p.id === params.productId);

  const [form, setForm] = useState({ name: "", description: "", price: "" });
  const [details, setDetails] = useState<ProductDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailName, setDetailName] = useState("");
  const [detailValue, setDetailValue] = useState("");

  useEffect(() => {
    if (product) {
      setForm({ name: product.name, description: product.description, price: String(product.price) });
      setDetails(product.details);
    }
  }, [product?.id]);

  if (!product || !channel) return null;

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleRepost = async () => {
    setLoading(true);
    try {
      await repostProduct(params.channelId, params.productId, {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        details,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const addDetail = () => {
    if (!detailName.trim() || !detailValue.trim()) return;
    setDetails((d) => [...d, { name: detailName.trim(), value: detailValue.trim() }]);
    setDetailName("");
    setDetailValue("");
    setShowDetailModal(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "web" ? "padding" : "height"}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Repost Product</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.imageBox, { backgroundColor: colors.muted }]}>
          <Feather name="image" size={28} color={colors.mutedForeground} />
          <Text style={[styles.imageLabel, { color: colors.mutedForeground }]}>Already Loaded</Text>
        </View>

        <AppInput label="Product Name" value={form.name} onChangeText={set("name")} />
        <AppInput label="Product Description" value={form.description} onChangeText={set("description")} multiline style={{ height: 90, textAlignVertical: "top", paddingTop: 10 }} />
        <AppInput label="Product Price (₹)" value={form.price} onChangeText={set("price")} keyboardType="numeric" />

        <Text style={[styles.detailsLabel, { color: colors.foreground }]}>Product Details</Text>
        {details.map((d, idx) => (
          <View key={idx} style={[styles.detailRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Text style={[styles.detailText, { color: colors.foreground }]}>
              <Text style={{ fontWeight: "700" }}>{d.name}: </Text>{d.value}
            </Text>
            <TouchableOpacity onPress={() => setDetails((dts) => dts.filter((_, i) => i !== idx))}>
              <Feather name="x" size={16} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={[styles.addDetailBtn, { borderColor: colors.primary }]} onPress={() => setShowDetailModal(true)}>
          <Feather name="plus" size={16} color={colors.primary} />
          <Text style={[styles.addDetailText, { color: colors.primary }]}>Add Detail</Text>
        </TouchableOpacity>

        <AppButton title="REPUBLISH POST" onPress={handleRepost} loading={loading} />
      </ScrollView>

      <Modal visible={showDetailModal} transparent animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Product Detail</Text>
            <AppInput label="Detail Name" value={detailName} onChangeText={setDetailName} placeholder="e.g. Material" />
            <AppInput label="Detail Value" value={detailValue} onChangeText={setDetailValue} placeholder="e.g. Cotton" />
            <View style={styles.modalBtns}>
              <AppButton title="Cancel" variant="outline" onPress={() => setShowDetailModal(false)} style={{ flex: 1 }} />
              <AppButton title="ADD" onPress={addDetail} style={{ flex: 1 }} />
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
  content: { padding: 20, gap: 4 },
  imageBox: { height: 120, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 20, gap: 8 },
  imageLabel: { fontSize: 12 },
  detailsLabel: { fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 4 },
  detailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  detailText: { fontSize: 13, flex: 1 },
  addDetailBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderRadius: 10, padding: 12, marginBottom: 20, borderStyle: "dashed" },
  addDetailText: { fontSize: 14, fontWeight: "600" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 4 },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 16 },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 8 },
});
