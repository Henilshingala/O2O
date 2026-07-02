import { router, useLocalSearchParams } from "@/compat/router";
import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import * as Haptics from "@/compat/haptics";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function SellerOfferScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getBid, submitOffer, channels } = useData();
  const params = useLocalSearchParams<{ id: string; channelId: string }>();
  const [form, setForm] = useState({ price: "", deliveryTime: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const bid = getBid(params.id);
  const myOffer = bid?.offers.find((o) => o.sellerId === user?.id && o.channelId === params.channelId);

  useEffect(() => {
    if (myOffer) {
      setForm({
        price: String(myOffer.price),
        deliveryTime: myOffer.deliveryTime,
        message: myOffer.message,
      });
    }
  }, [myOffer?.id]);

  if (!user || !bid) return null;

  const myChannel = channels.find((c) => c.id === params.channelId && c.ownerId === user.id);
  const msLeft = new Date(bid.endTime).getTime() - Date.now();
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    const e: Record<string, string> = {};
    if (!form.price || isNaN(Number(form.price))) e.price = "Valid price required";
    if (!form.deliveryTime.trim()) e.deliveryTime = "Delivery time required";
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setLoading(true);
    try {
      await submitOffer(bid.id, {
        sellerId: user.id,
        sellerName: myChannel?.name ?? user.fullName,
        channelId: params.channelId,
        price: Number(form.price),
        deliveryTime: form.deliveryTime.trim(),
        message: form.message.trim(),
        rating: 4.5,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "web" ? "padding" : "height"}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>{myOffer ? "Update Offer" : "Submit Offer"}</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.bidSummary, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.bidProduct, { color: colors.foreground }]}>Product: {bid.productName}</Text>
          <Text style={[styles.bidDetail, { color: colors.mutedForeground }]}>Qty: {bid.quantity} units</Text>
          <Text style={[styles.bidDetail, { color: colors.mutedForeground }]}>Buyer Target: ₹{bid.budget}/unit</Text>
          <View style={[styles.timerRow, { backgroundColor: colors.secondary }]}>
            <Feather name="clock" size={14} color={colors.primary} />
            <Text style={[styles.timerText, { color: colors.primary }]}>Time Left: {formatCountdown(msLeft)}</Text>
          </View>
        </View>
        <AppInput label="Your Offer Price (₹)" value={form.price} onChangeText={set("price")} placeholder="Enter your price per unit" keyboardType="numeric" error={errors.price} />
        <AppInput label="Delivery Time" value={form.deliveryTime} onChangeText={set("deliveryTime")} placeholder="e.g. 7 days, 2 weeks" error={errors.deliveryTime} />
        <AppInput label="Message to Buyer" value={form.message} onChangeText={set("message")} placeholder="Any additional info..." multiline style={{ height: 80, textAlignVertical: "top", paddingTop: 10 }} />
        <AppButton title={myOffer ? "UPDATE OFFER" : "SUBMIT OFFER"} onPress={handleSubmit} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 17, fontWeight: "700" },
  content: { padding: 20, gap: 4 },
  bidSummary: { padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 20, gap: 4 },
  bidProduct: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  bidDetail: { fontSize: 13 },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: 8, marginTop: 8 },
  timerText: { fontSize: 13, fontWeight: "700" },
});
