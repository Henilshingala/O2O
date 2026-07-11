import React from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@/compat/vector-icons";
import { ChatBubble } from "@/components/ChatBubble";
import { MediaAlbum } from "@/components/MediaAlbum";
import { MessageStatusIcon } from "@/components/MessageStatusIcon";
import { UploadProgressBubble } from "@/components/UploadProgressBubble";
import { useColors } from "@/hooks/useColors";
import { openLocation } from "@/lib/openLocation";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import type { UploadProgress } from "@/lib/uploadMedia";
import type { Message } from "@/types";

interface MessageContentProps {
  item: Message;
  isMine: boolean;
  senderName?: string;
  onPollVote?: (messageId: string, optionIndex: number) => void;
  onRetryUpload?: (messageId: string) => void;
  /** Long-press to enter selection mode */
  onLongPress?: () => void;
  /** Tap handler (for toggling selection in selection mode) */
  onPress?: () => void;
  /** Whether this message is currently selected */
  selected?: boolean;
  /** Whether the chat is in selection mode (affects tap behavior) */
  selectionMode?: boolean;
}

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function parseProgressFromUrl(url: string): UploadProgress | null {
  const prefix = "__progress__";
  if (!url.startsWith(prefix)) return null;
  try {
    return JSON.parse(url.slice(prefix.length)) as UploadProgress;
  } catch {
    return null;
  }
}

export function MessageContent({
  item,
  isMine,
  senderName,
  onPollVote,
  onRetryUpload,
  onLongPress,
  onPress,
  selected,
  selectionMode,
}: MessageContentProps) {
  const colors = useColors();

  // Filter: message deleted for this user locally
  if (item.metadata?.deletedForMe === true) return null;

  const statusFooter = (
    <View style={styles.statusRow}>
      <Text
        style={[
          styles.time,
          { color: isMine ? "rgba(255,255,255,0.7)" : colors.mutedForeground },
        ]}
      >
        {formatTime(item.timestamp)}
      </Text>
      <MessageStatusIcon status={item.status} isMine={isMine} />
      {item.status === "failed" && (
        <Text style={styles.failedText}>Failed</Text>
      )}
    </View>
  );

  // Build the inner content
  let content: React.ReactNode;

  // ── Uploading placeholder ─────────────────────────────────────────────────
  if (item.metadata?.uploading === true) {
    const rawUrl = String(item.metadata?.url || "");
    const progress = parseProgressFromUrl(rawUrl);
    const uploadFailed = item.status === "failed";
    const uploadCancelled = item.metadata?.cancelled === true;

    content = (
      <UploadProgressBubble
        fileName={String(item.metadata?.fileName || item.text || "Uploading…")}
        progress={progress}
        state={uploadFailed ? "failed" : uploadCancelled ? "cancelled" : "uploading"}
        onRetry={
          (uploadFailed || uploadCancelled) && onRetryUpload
            ? () => onRetryUpload(item.id)
            : undefined
        }
      />
    );
  }

  // ── Upload failed (permanent) ─────────────────────────────────────────────
  else if (item.metadata?.uploadError && isMine) {
    content = (
      <UploadProgressBubble
        fileName={String(item.metadata?.fileName || item.text || "Upload")}
        progress={null}
        state="failed"
        onRetry={onRetryUpload ? () => onRetryUpload(item.id) : undefined}
      />
    );
  }

  // ── Image / Video (single or album) ──────────────────────────────────────
  else if (item.type === "image" || item.type === "video") {
    const albumUrls = item.metadata?.urls as string[] | undefined;
    const albumTypes = item.metadata?.types as ("image" | "video")[] | undefined;

    if (albumUrls && albumUrls.length > 0) {
      const validUrls = albumUrls.filter(Boolean);
      content = (
        <View style={[styles.wrapper, isMine ? styles.mine : styles.theirs]}>
          {!isMine && senderName && (
            <Text style={[styles.sender, { color: colors.primary }]}>{senderName}</Text>
          )}
          <MediaAlbum
            urls={validUrls}
            types={albumTypes?.filter((_, i) => albumUrls[i]) || validUrls.map(() => "image")}
          />
          {statusFooter}
        </View>
      );
    } else {
      const url = resolveMediaUrl(String(item.metadata?.url || item.text));
      content = (
        <View style={[styles.wrapper, isMine ? styles.mine : styles.theirs]}>
          {!isMine && senderName && (
            <Text style={[styles.sender, { color: colors.primary }]}>{senderName}</Text>
          )}
          <MediaAlbum urls={[url]} types={[item.type as "image" | "video"]} />
          {statusFooter}
        </View>
      );
    }
  }

  // ── Audio ────────────────────────────────────────────────────────────────
  else if (item.type === "audio") {
    const url = resolveMediaUrl(String(item.metadata?.url || ""));
    content = (
      <View style={[styles.wrapper, isMine ? styles.mine : styles.theirs]}>
        {!isMine && senderName && (
          <Text style={[styles.sender, { color: colors.primary }]}>{senderName}</Text>
        )}
        <TouchableOpacity
          style={[
            styles.audioMsg,
            { backgroundColor: isMine ? colors.senderBubble : colors.receiverBubble },
          ]}
          onPress={() => { if (url) Linking.openURL(url).catch(() => {}); }}
          onLongPress={onLongPress}
        >
          <Feather name="mic" size={20} color={isMine ? "#fff" : colors.primary} />
          <Text style={{ color: isMine ? "#fff" : colors.foreground, flex: 1 }}>
            {item.metadata?.fileName ? String(item.metadata.fileName) : "Voice message"}
          </Text>
          <Feather name="play" size={18} color={isMine ? "#fff" : colors.primary} />
        </TouchableOpacity>
        {statusFooter}
      </View>
    );
  }

  // ── File / Document ───────────────────────────────────────────────────────
  else if (item.type === "file") {
    const url = resolveMediaUrl(String(item.metadata?.url || ""));
    const fileName = String(item.metadata?.fileName || "Document");
    content = (
      <View style={[styles.wrapper, isMine ? styles.mine : styles.theirs]}>
        {!isMine && senderName && (
          <Text style={[styles.sender, { color: colors.primary }]}>{senderName}</Text>
        )}
        <TouchableOpacity
          style={[styles.fileMsg, { backgroundColor: colors.muted, borderColor: colors.border }]}
          onPress={() => { if (url) Linking.openURL(url).catch(() => {}); }}
          onLongPress={onLongPress}
        >
          <Feather name="file-text" size={24} color={colors.primary} />
          <Text style={{ color: colors.foreground, flex: 1 }} numberOfLines={2}>
            {fileName}
          </Text>
          <Feather name="download" size={18} color={colors.primary} />
        </TouchableOpacity>
        {statusFooter}
      </View>
    );
  }

  // ── Location ─────────────────────────────────────────────────────────────
  else if (item.type === "location") {
    const lat = Number(item.metadata?.lat);
    const lng = Number(item.metadata?.lng);
    content = (
      <View style={[styles.wrapper, isMine ? styles.mine : styles.theirs]}>
        {!isMine && senderName && (
          <Text style={[styles.sender, { color: colors.primary }]}>{senderName}</Text>
        )}
        <TouchableOpacity
          style={[styles.locationMsg, { backgroundColor: colors.muted }]}
          onPress={() => openLocation(lat, lng, item.text)}
          onLongPress={onLongPress}
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

  // ── Poll ─────────────────────────────────────────────────────────────────
  else if (item.type === "poll") {
    const options = (item.metadata?.options ?? []) as { text: string; votes?: string[] }[];
    const totalVotes = options.reduce((s, o) => s + (o.votes?.length ?? 0), 0);

    content = (
      <View style={[styles.wrapper, isMine ? styles.mine : styles.theirs]}>
        <View style={[styles.pollMsg, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.pollQuestion, { color: colors.foreground }]}>📊 {item.text}</Text>
          {options.map((opt, idx) => {
            const votes = opt.votes?.length ?? 0;
            const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.pollOption, { backgroundColor: colors.muted }]}
                onPress={() => onPollVote?.(item.id, idx)}
              >
                <View style={[styles.pollBar, { width: `${pct}%` as any, backgroundColor: colors.primary, opacity: 0.25 }]} />
                <Text style={{ color: colors.foreground, flex: 1, zIndex: 1 }}>{opt.text}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, zIndex: 1 }}>
                  {votes} ({pct}%)
                </Text>
              </TouchableOpacity>
            );
          })}
          <Text style={[styles.pollTotal, { color: colors.mutedForeground }]}>{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</Text>
        </View>
        {statusFooter}
      </View>
    );
  }

  // ── Text (default) ────────────────────────────────────────────────────────
  else {
    content = (
      <View style={{ width: "100%" }}>
        <ChatBubble
          text={item.text}
          timestamp={item.timestamp}
          isMine={isMine}
          senderName={senderName}
        />
        {isMine && item.status && (
          <View style={[styles.statusRow, styles.textStatus, { alignSelf: "flex-end", marginRight: 16 }]}>
            <MessageStatusIcon status={item.status} isMine={isMine} />
            {item.status === "failed" && <Text style={styles.failedText}>Failed to send</Text>}
          </View>
        )}
      </View>
    );
  }

  // ── Selection wrapper ─────────────────────────────────────────────────────
  return (
    <TouchableOpacity
      activeOpacity={selectionMode ? 0.6 : 1}
      onLongPress={onLongPress}
      onPress={selectionMode ? onPress : undefined}
      delayLongPress={350}
      style={[styles.selectionWrap, selected && { backgroundColor: colors.primary + "22" }]}
    >
      {selectionMode && (
        <View style={styles.selectionIndicatorWrap}>
          <View
            style={[
              styles.selectionCircle,
              { borderColor: selected ? colors.primary : colors.border },
              selected && { backgroundColor: colors.primary },
            ]}
          >
            {selected && <Feather name="check" size={12} color="#fff" />}
          </View>
        </View>
      )}
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  selectionWrap: { flexDirection: "row", alignItems: "center" },
  selectionIndicatorWrap: { paddingHorizontal: 8, alignSelf: "center" },
  selectionCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  wrapper: { marginVertical: 4, maxWidth: "82%", marginHorizontal: 16 },
  mine: { alignSelf: "flex-end" },
  theirs: { alignSelf: "flex-start" },
  sender: { fontSize: 11, fontWeight: "700", marginBottom: 4, marginLeft: 4 },
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
    overflow: "hidden",
  },
  pollBar: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
  },
  pollTotal: { fontSize: 11, marginTop: 4, textAlign: "right" },
  audioMsg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    minWidth: 200,
  },
  fileMsg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 200,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    gap: 2,
  },
  textStatus: { paddingRight: 16 },
  time: { fontSize: 10 },
  failedText: { fontSize: 10, color: "#FCA5A5", marginLeft: 4 },
});
