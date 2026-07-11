/**
 * SelectionToolbar — appears at the top of the chat screen when messages
 * are selected (long-press selection mode).
 *
 * Actions shown:
 *  – Delete    always
 *  – Forward   always
 *  – Share     only when any selected message has media
 *  – Copy      only when ALL selected messages are plain text
 *  – Info      only when exactly 1 message is selected
 */
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { Message } from "@/types";

interface SelectionToolbarProps {
  selected: Message[];
  onCancel: () => void;
  onDelete: () => void;
  onForward: () => void;
  onShare: () => void;
  onCopy: () => void;
  onInfo: () => void;
}

export function SelectionToolbar({
  selected,
  onCancel,
  onDelete,
  onForward,
  onShare,
  onCopy,
  onInfo,
}: SelectionToolbarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const count = selected.length;
  const allText = selected.every((m) => !m.type || m.type === "text");
  const anyMedia = selected.some((m) =>
    m.type === "image" || m.type === "video" || m.type === "audio" || m.type === "file"
  );
  const canInfo = count === 1;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          paddingTop: insets.top + 4,
        },
      ]}
    >
      <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <Feather name="x" size={22} color={colors.foreground} />
      </TouchableOpacity>

      <Text style={[styles.count, { color: colors.foreground }]}>
        {count} selected
      </Text>

      <View style={styles.actions}>
        {canInfo && (
          <TouchableOpacity style={styles.actionBtn} onPress={onInfo} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Feather name="info" size={20} color={colors.foreground} />
          </TouchableOpacity>
        )}
        {allText && count > 0 && (
          <TouchableOpacity style={styles.actionBtn} onPress={onCopy} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Feather name="copy" size={20} color={colors.foreground} />
          </TouchableOpacity>
        )}
        {anyMedia && (
          <TouchableOpacity style={styles.actionBtn} onPress={onShare} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Feather name="share-2" size={20} color={colors.foreground} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionBtn} onPress={onForward} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Feather name="corner-up-right" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onDelete} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Feather name="trash-2" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  cancelBtn: { padding: 4 },
  count: { flex: 1, fontSize: 16, fontWeight: "600", marginLeft: 4 },
  actions: { flexDirection: "row", alignItems: "center", gap: 2 },
  actionBtn: { padding: 8 },
});
