import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@/compat/vector-icons";
import { ChatBubble } from "@/components/ChatBubble";
import { MessageStatusIcon } from "@/components/MessageStatusIcon";
import { useColors } from "@/hooks/useColors";
import { openLocation } from "@/lib/openLocation";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import type { Message } from "@/types";

interface MessageContentProps {
  item: Message;
  isMine: boolean;
  senderName?: string;
  onPollVote?: (messageId: string, optionIndex: number) => void;
}

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function MessageContent({ item, isMine, senderName, onPollVote }: MessageContentProps) {
  const colors = useColors();

  const statusFooter = (
    <View style={styles.statusRow}>
      <Text style={[styles.time, { color: isMine ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>
        {formatTime(item.timestamp)}
      </Text>
      <MessageStatusIcon status={item.status} isMine={isMine} />
      {item.status === "failed" && <Text style={styles.failedText}>Failed</Text>}
    </View>
  );

  if (item.type === "image" || item.type === "video") {
    const url = resolveMediaUrl(String(item.metadata?.url || item.text));
    return (
      <View style={[styles.wrapper, isMine ? styles.mine : styles.theirs]}>
        {!isMine && senderName && (
          <Text style={[styles.sender, { color: colors.primary }]}>{senderName}</Text>
        )}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => { if (url) Linking.openURL(url).catch(() => {}); }}
        >
          <View style={styles.mediaMsg}>
            {item.status === "sending" && (
              <View style={styles.sendingOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            <Image source={{ uri: url }} style={styles.chatMedia} />
            {item.type === "video" && (
              <View style={styles.videoOverlay}>
                <Feather name="play-circle" size={32} color="#fff" />
              </View>
            )}
          </View>
        </TouchableOpacity>
        {statusFooter}
      </View>
    );
  }

  if (item.type === "audio") {
    const url = resolveMediaUrl(String(item.metadata?.url || ""));
    return (
      <View style={[styles.wrapper, isMine ? styles.mine : styles.theirs]}>
        {!isMine && senderName && (
          <Text style={[styles.sender, { color: colors.primary }]}>{senderName}</Text>
        )}
        <TouchableOpacity
          style={[styles.audioMsg, { backgroundColor: isMine ? colors.senderBubble : colors.receiverBubble }]}
          onPress={() => { if (url) Linking.openURL(url).catch(() => {}); }}
        >
          <Feather name="mic" size={20} color={isMine ? "#fff" : colors.primary} />
          <Text style={{ color: isMine ? "#fff" : colors.foreground, flex: 1 }}>Voice message</Text>
          <Feather name="play" size={18} color={isMine ? "#fff" : colors.primary} />
        </TouchableOpacity>
        {statusFooter}
      </View>
    );
  }

  if (item.type === "file") {
    const url = resolveMediaUrl(String(item.metadata?.url || ""));
    const fileName = String(item.metadata?.fileName || "Document");
    return (
      <View style={[styles.wrapper, isMine ? styles.mine : styles.theirs]}>
        {!isMine && senderName && (
          <Text style={[styles.sender, { color: colors.primary }]}>{senderName}</Text>
        )}
        <TouchableOpacity
          style={[styles.fileMsg, { backgroundColor: colors.muted, borderColor: colors.border }]}
          onPress={() => { if (url) Linking.openURL(url).catch(() => {}); }}
        >
          <Feather name="file-text" size={24} color={colors.primary} />
          <Text style={{ color: colors.foreground, flex: 1 }} numberOfLines={2}>{fileName}</Text>
          <Feather name="download" size={18} color={colors.primary} />
        </TouchableOpacity>
        {statusFooter}
      </View>
    );
  }

  if (item.type === "location") {
    const lat = Number(item.metadata?.lat);
    const lng = Number(item.metadata?.lng);
    return (
      <View style={[styles.wrapper, isMine ? styles.mine : styles.theirs]}>
        {!isMine && senderName && (
          <Text style={[styles.sender, { color: colors.primary }]}>{senderName}</Text>
        )}
        <TouchableOpacity
          style={[styles.locationMsg, { backgroundColor: colors.muted }]}
          onPress={() => openLocation(lat, lng, item.text)}
          activeOpacity={0.7}
        >
          <Feather name="map-pin" size={24} color={colors.primary} />
          <Text style={{ color: colors.foreground, marginTop: 8, fontWeight: "600" }}>{item.text}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>Tap to open in Maps</Text>
          {!Number.isNaN(lat) && !Number.isNaN(lng) && (
            <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
              {lat.toFixed(4)}, {lng.toFixed(4)}
            </Text>
          )}
        </TouchableOpacity>
        {statusFooter}
      </View>
    );
  }

  if (item.type === "poll") {
    return (
      <View style={[styles.wrapper, isMine ? styles.mine : styles.theirs]}>
        <View style={[styles.pollMsg, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.pollQuestion, { color: colors.foreground }]}>📊 {item.text}</Text>
          {(item.metadata?.options as { text: string; votes?: string[] }[])?.map((opt, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.pollOption, { backgroundColor: colors.muted }]}
              onPress={() => onPollVote?.(item.id, idx)}
            >
              <Text style={{ color: colors.foreground }}>{opt.text}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{opt.votes?.length || 0} votes</Text>
            </TouchableOpacity>
          ))}
        </View>
        {statusFooter}
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, isMine ? styles.mine : styles.theirs]}>
      <ChatBubble text={item.text} timestamp={item.timestamp} isMine={isMine} senderName={senderName} />
      {isMine && item.status && (
        <View style={[styles.statusRow, styles.textStatus]}>
          <MessageStatusIcon status={item.status} isMine={isMine} />
          {item.status === "failed" && <Text style={styles.failedText}>Failed to send</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: 4, maxWidth: "82%" },
  mine: { alignSelf: "flex-end" },
  theirs: { alignSelf: "flex-start" },
  sender: { fontSize: 11, fontWeight: "700", marginBottom: 4, marginLeft: 4 },
  mediaMsg: { position: "relative", borderRadius: 16, overflow: "hidden" },
  chatMedia: { width: 220, height: 220, borderRadius: 16 },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 16,
  },
  sendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 1,
    borderRadius: 16,
  },
  locationMsg: { padding: 16, borderRadius: 16, alignItems: "center", minWidth: 180 },
  pollMsg: { padding: 16, borderRadius: 16, borderWidth: 1, width: 260 },
  pollQuestion: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  pollOption: {
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  audioMsg: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, minWidth: 200 },
  fileMsg: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, minWidth: 200 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 4, gap: 2 },
  textStatus: { paddingRight: 16 },
  time: { fontSize: 10 },
  failedText: { fontSize: 10, color: "#FCA5A5", marginLeft: 4 },
});
