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
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

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
  const [sellerMode, setSellerMode] = useState<"all" | "selected">("all");
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!user) return null;
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleNext = () => {
    const e: Record<string, string> = {};
    if (!form.productName.trim()) e.productName = "Product name required";
    if (!form.quantity.trim() || isNaN(Number(form.quantity))) e.quantity = "Valid quantity required";
    if (!form.budget.trim() || isNaN(Number(form.budget))) e.budget = "Valid budget required";
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    if (sellerMode === "selected") {
      router.push({
        pathname: "/bid/select-sellers",
        params: { ...form, sellerMode, budget: form.budget, quantity: form.quantity },
      });
    } else {
      const endTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      router.push({
        pathname: "/bid/select-sellers",
        params: { ...form, sellerMode, budget: form.budget, quantity: form.quantity },
      });
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
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

        <View style={[styles.imageBox, { backgroundColor: colors.muted }]}>
          <Feather name="image" size={28} color={colors.mutedForeground} />
          <Text style={[styles.imageLabel, { color: colors.mutedForeground }]}>Product Image (Auto Filled)</Text>
        </View>

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
  imageBox: { height: 120, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 20, gap: 8 },
  imageLabel: { fontSize: 12 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 10 },
  radioRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  radioOption: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1.5 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  radioText: { fontSize: 13, fontWeight: "600" },
  timerInfo: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, marginBottom: 20 },
});
