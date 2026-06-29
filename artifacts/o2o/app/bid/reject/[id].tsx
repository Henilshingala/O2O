import { router, useLocalSearchParams } from "@/compat/router";
import React, { useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import * as Haptics from "@/compat/haptics";
import { AppButton } from "@/components/ui/AppButton";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

const REASONS = ["Budget Too Low", "Product Unavailable", "Quantity Too Large", "Other"];

export default function RejectBidScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { rejectBid } = useData();
  const params = useLocalSearchParams<{ id: string; channelId: string }>();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleReject = () => {
    setLoading(true);
    rejectBid(params.id, { sellerId: user.id, channelId: params.channelId, reason });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setLoading(false);
    router.back();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Reject Bid?</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.warningBox, { backgroundColor: "#FEF3C7" }]}>
          <Feather name="alert-triangle" size={18} color="#D97706" />
          <Text style={{ color: "#92400E", fontSize: 13, flex: 1 }}>
            After rejecting, you won't be able to submit an offer for this bid.
          </Text>
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Reason (Optional)</Text>
        {REASONS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.option, { borderColor: reason === r ? colors.primary : colors.border, backgroundColor: reason === r ? colors.secondary : colors.card }]}
            onPress={() => setReason(r === reason ? "" : r)}
          >
            <View style={[styles.radio, { borderColor: reason === r ? colors.primary : colors.border }]}>
              {reason === r && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
            </View>
            <Text style={[styles.optionText, { color: colors.foreground }]}>{r}</Text>
          </TouchableOpacity>
        ))}

        <AppButton title="CONFIRM REJECT" variant="destructive" onPress={handleReject} loading={loading} style={styles.btn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 17, fontWeight: "700" },
  content: { padding: 20, gap: 12 },
  warningBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12 },
  label: { fontSize: 14, fontWeight: "700", marginTop: 8 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  optionText: { fontSize: 14 },
  btn: { marginTop: 8 },
});
