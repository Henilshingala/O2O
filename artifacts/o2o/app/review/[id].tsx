import { router, useLocalSearchParams } from "@/compat/router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import * as Haptics from "@/compat/haptics";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

export default function ReviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getOrder, submitReview } = useData();
  const params = useLocalSearchParams<{ id: string }>();
  const order = getOrder(params.id);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user || !order) return null;

  const handleSubmit = () => {
    if (rating === 0) return;
    setLoading(true);
    submitReview({
      orderId: order.id,
      buyerId: user.id,
      buyerName: user.fullName,
      sellerId: order.sellerId,
      productName: order.productName,
      rating,
      text: text.trim(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(false);
    router.replace("/(tabs)");
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Rate Your Purchase</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.sellerAvatar, { backgroundColor: colors.accent }]}>
            <Feather name="radio" size={24} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.sellerLabel, { color: colors.mutedForeground }]}>Seller</Text>
            <Text style={[styles.sellerName, { color: colors.foreground }]}>{order.sellerName}</Text>
            <Text style={[styles.productName, { color: colors.mutedForeground }]}>{order.productName}</Text>
          </View>
        </View>

        <Text style={[styles.ratingLabel, { color: colors.foreground }]}>Your Rating</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((s) => (
            <TouchableOpacity key={s} onPress={() => { setRating(s); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
              <Feather name="star" size={44} color={s <= rating ? "#F59E0B" : colors.border} style={styles.star} />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>
          {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
        </Text>

        <AppInput label="Write Review (Optional)" value={text} onChangeText={setText} placeholder="Share your experience..." multiline style={{ height: 100, textAlignVertical: "top", paddingTop: 10 }} />

        <AppButton title="SUBMIT REVIEW" onPress={handleSubmit} loading={loading} disabled={rating === 0} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 17, fontWeight: "700" },
  content: { padding: 24, gap: 16 },
  summaryCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, borderWidth: 1 },
  sellerAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  sellerLabel: { fontSize: 11, fontWeight: "600" },
  sellerName: { fontSize: 16, fontWeight: "700" },
  productName: { fontSize: 13, marginTop: 2 },
  ratingLabel: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 4 },
  star: {},
  ratingText: { textAlign: "center", fontSize: 14, fontWeight: "600" },
});
