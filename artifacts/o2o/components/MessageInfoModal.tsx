/**
 * MessageInfoModal — shows delivery/read receipt details for a single message.
 *
 * Displays: message ID, sent time, delivered time, seen time, sender, status.
 */
import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@/compat/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { Message } from "@/types";

interface MessageInfoModalProps {
  visible: boolean;
  message: Message | null;
  senderName?: string;
  onClose: () => void;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function fmt(ts: string | undefined) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function MessageInfoModal({
  visible,
  message,
  senderName,
  onClose,
}: MessageInfoModalProps) {
  const colors = useColors();
  if (!message) return null;

  const readBy = (message.metadata?.readBy as string[] | undefined) ?? [];
  const seenAt = (message.metadata?.seenAt as string | undefined);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>Message Info</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView>
            <InfoRow label="Message ID" value={message.id} />
            <InfoRow label="Type" value={message.type ?? "text"} />
            <InfoRow label="Sender" value={senderName ?? message.senderId} />
            <InfoRow label="Sent" value={fmt(message.timestamp)} />
            <InfoRow label="Status" value={message.status ?? "—"} />
            {message.editedAt && (
              <InfoRow label="Edited" value={fmt(message.editedAt)} />
            )}
            {seenAt && (
              <InfoRow label="Seen" value={fmt(seenAt)} />
            )}
            {readBy.length > 0 && (
              <InfoRow label="Read by" value={`${readBy.length} participant${readBy.length !== 1 ? "s" : ""}`} />
            )}
            {message.metadata?.fileName && (
              <InfoRow label="File name" value={String(message.metadata.fileName)} />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: "75%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: "700" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.15)",
    gap: 12,
  },
  label: { fontSize: 13, fontWeight: "600", flexShrink: 0 },
  value: { fontSize: 13, flex: 1, textAlign: "right" },
});
