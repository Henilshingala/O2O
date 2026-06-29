import { router, useLocalSearchParams } from "@/compat/router";
import React, { useRef, useState } from "react";
import { FlatList, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import * as Haptics from "@/compat/haptics";
import { AppButton } from "@/components/ui/AppButton";
import { Badge } from "@/components/ui/Badge";
import { ChatBubble } from "@/components/ChatBubble";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

export default function OrderChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getOrder, sendOrderMessage, updateOrderStatus } = useData();
  const params = useLocalSearchParams<{ id: string }>();
  const [text, setText] = useState("");
  const order = getOrder(params.id);

  if (!user || !order) return null;
  const messages = [...order.messages].reverse();
  const isBuyer = order.buyerId === user.id;
  const statusBadge = { pending: "warning", confirmed: "primary", delivered: "success" }[order.status] as any;

  const send = () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendOrderMessage(order.id, { senderId: user.id, text: text.trim(), timestamp: new Date().toISOString() });
    setText("");
  };

  const handleMarkDelivered = () => {
    updateOrderStatus(order.id, "delivered");
    router.push({ pathname: "/review/[id]", params: { id: order.id } });
  };

  const handleConfirm = () => updateOrderStatus(order.id, "confirmed");

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior="padding" keyboardVerticalOffset={0}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{order.sellerName}</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Order Chat</Text>
        </View>
        <Badge label={order.status.toUpperCase()} variant={statusBadge} />
      </View>

      {/* Order summary bar */}
      <View style={[styles.summaryBar, { backgroundColor: colors.secondary }]}>
        <Feather name="package" size={14} color={colors.primary} />
        <Text style={[styles.summaryText, { color: colors.foreground }]}>
          {order.productName} × {order.quantity} — ₹{order.offerPrice}/unit
        </Text>
        {!isBuyer && order.status === "pending" && (
          <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.primary }]} onPress={handleConfirm}>
            <Text style={styles.confirmText}>Confirm</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.messages}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={[styles.emptyChatText, { color: colors.mutedForeground }]}>
              {isBuyer ? `You accepted ${order.sellerName}'s offer. Send them a message to start.` : "Buyer has selected you. Respond to confirm the order."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ChatBubble text={item.text} timestamp={item.timestamp} isMine={item.senderId === user.id} />
        )}
      />

      {order.status === "confirmed" && isBuyer && (
        <View style={[styles.deliveredBanner, { backgroundColor: "#D1FAE5", borderTopColor: "#A7F3D0" }]}>
          <AppButton title="Mark as Delivered & Rate" onPress={handleMarkDelivered} size="sm" style={{ flex: 1 }} />
        </View>
      )}

      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 8) }]}>
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.muted, color: colors.foreground }]}
          value={text}
          onChangeText={setText}
          placeholder="Message..."
          placeholderTextColor={colors.mutedForeground}
          multiline
        />
        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.muted }]} onPress={send} disabled={!text.trim()}>
          <Feather name="send" size={18} color={text.trim() ? "#fff" : colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: "700" },
  headerSub: { fontSize: 12 },
  summaryBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  summaryText: { flex: 1, fontSize: 13, fontWeight: "500" },
  confirmBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  confirmText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  messages: { paddingVertical: 12 },
  emptyChat: { padding: 24, alignItems: "center" },
  emptyChatText: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  deliveredBanner: { flexDirection: "row", padding: 12, borderTopWidth: 1 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, gap: 8 },
  textInput: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", marginBottom: 2 },
});
