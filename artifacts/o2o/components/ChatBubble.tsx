import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface ChatBubbleProps {
  text: string;
  timestamp: string;
  isMine: boolean;
  senderName?: string;
}

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function ChatBubble({ text, timestamp, isMine, senderName }: ChatBubbleProps) {
  const colors = useColors();

  return (
    <View style={[styles.row, isMine && styles.rowMine]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isMine ? colors.senderBubble : colors.receiverBubble,
            maxWidth: "78%",
          },
        ]}
      >
        {!isMine && senderName && (
          <Text style={[styles.sender, { color: colors.primary }]}>{senderName}</Text>
        )}
        <Text style={[styles.text, { color: isMine ? "#fff" : colors.foreground }]}>
          {text}
        </Text>
        <Text style={[styles.time, { color: isMine ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>
          {formatTime(timestamp)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", marginVertical: 4, paddingHorizontal: 16 },
  rowMine: { justifyContent: "flex-end" },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sender: { fontSize: 11, fontWeight: "700", marginBottom: 2 },
  text: { fontSize: 14, lineHeight: 20 },
  time: { fontSize: 10, marginTop: 4, textAlign: "right" },
});
