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
}

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

/** Parse the special progress sentinel value embedded by ChatAttachMenu */
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
}: MessageContentProps) {
  const colors = useColors();

  console.log(`[MESSAGE_RENDER] id=${item.id} type=${item.type} uploading=${item.metadata?.uploading}`);

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

  // ── Uploading placeholder ─────────────────────────────────────────────────
  if (item.metadata?.uploading === true) {
    const rawUrl = String(item.metadata?.url || "");
    const progress = parseProgressFromUrl(rawUrl);
    const uploadFailed = item.status === "failed";
    const uploadCancelled = item.metadata?.cancelled === true;

    return (
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
  if (item.metadata?.uploadError && isMine) {
    return (
      <UploadProgressBubble
        fileName={String(item.metadata?.fileName || item.text || "Upload")}
        progress={null}
        state="failed"
        onRetry={onRetryUpload ? () => onRetryUpload(item.id) : undefined}
      />
    );
  }

  // ── Image / Video (single or album) ──────────────────────────────────────
  if (item.type === "image" || item.type === "video") {
    // Album (multiple)
    const albumUrls = item.metadata?.urls as string[] | undefined;
    const albumTypes = item.metadata?.types as ("image" | "video")[] | undefined;

    if (albumUrls && albumUrls.length > 0) {
      const validUrls = albumUrls.filter(Boolean);
      return (
        <View style={[styles.wrapper, isMine ? styles.mine : styles.theirs]}>
          {!isMine && senderName && (
            <Text style={[styles.sender, { color: colors.primary }]}>
              {senderName}
            </Text>
          )}
          <MediaAlbum
            urls={validUrls}
            types={albumTypes?.filter((_, i) => albumUrls[i]) || validUrls.map(() => "image")}
          />
          {statusFooter}
        </View>
      );
    }

    // Single image/video
    const url = resolveMediaUrl(String(item.metadata?.url || item.text));
    console.log(`[IMAGE_RENDERED] id=${item.id} url=${(url || "").slice(0, 80)} type=${item.type}`);
    return (
      <View style={[styles.wrapper, isMine ? styles.mine : styles.theirs]}>
        {!isMine && senderName && (
          <Text style={[styles.sender, { color: colors.primary }]}>
            {senderName}
          </Text>
        )}
        <MediaAlbum
          urls={[url]}
          types={[item.type as "image" | "video"]}
        />
        {statusFooter}
      </View>
    );
  }

  // ── Audio ────────────────────────────────────────────────────────────────

  if (item.type === "audio") {
    const url = resolveMediaUrl(String(item.metadata?.url || ""));
    return (
      <View style={[styles.wrapper, isMine ? styles.mine : styles.theirs]}>
        {!isMine && senderName && (
          <Text style={[styles.sender, { color: colors.primary }]}>{senderName}</Text>
        )}
        <TouchableOpacity
          style={[
            styles.audioMsg,
            { backgroundColor: isMine ? colors.senderBubble : colors.receiverBubble },
          ]}
          onPress={() => {
            if (url) Linking.openURL(url).catch(() => {});
          }}
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
  if (item.type === "file") {
    const url = resolveMediaUrl(String(item.metadata?.url || ""));
    const fileName = String(item.metadata?.fileName || "Document");
    return (
      <View style={[styles.wrapper, isMine ? styles.mine : styles.theirs]}>
        {!isMine && senderName && (
          <Text style={[styles.sender, { color: colors.primary }]}>{senderName}</Text>
        )}
        <TouchableOpacity
          style={[
            styles.fileMsg,
            { backgroundColor: colors.muted, borderColor: colors.border },
          ]}
          onPress={() => {
            if (url) Linking.openURL(url).catch(() => {});
          }}
        >
          <Feather name="file-text" size={24} color={colors.primary} />
          <Text
            style={{ color: colors.foreground, flex: 1 }}
            numberOfLines={2}
          >
            {fileName}
          </Text>
          <Feather name="download" size={18} color={colors.primary} />
        </TouchableOpacity>
        {statusFooter}
      </View>
    );
  }

  // ── Location ─────────────────────────────────────────────────────────────
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
          <Text style={{ color: colors.foreground, marginTop: 8, fontWeight: "600" }}>
            {item.text}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
            Tap to open in Maps
          </Text>
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
  if (item.type === "poll") {
    return (
      <View style={[styles.wrapper, isMine ? styles.mine : styles.theirs]}>
        <View
          style={[
            styles.pollMsg,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.pollQuestion, { color: colors.foreground }]}>
            📊 {item.text}
          </Text>
          {(
            item.metadata?.options as { text: string; votes?: string[] }[]
          )?.map((opt, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.pollOption, { backgroundColor: colors.muted }]}
              onPress={() => onPollVote?.(item.id, idx)}
            >
              <Text style={{ color: colors.foreground }}>{opt.text}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                {opt.votes?.length || 0} votes
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {statusFooter}
      </View>
    );
  }

  // ── Text (default) ────────────────────────────────────────────────────────
  return (
    <View style={{ width: "100%" }}>
      <ChatBubble
        text={item.text}
        timestamp={item.timestamp}
        isMine={isMine}
        senderName={senderName}
      />
      {isMine && item.status && (
        <View
          style={[
            styles.statusRow,
            styles.textStatus,
            { alignSelf: "flex-end", marginRight: 16 },
          ]}
        >
          <MessageStatusIcon status={item.status} isMine={isMine} />
          {item.status === "failed" && (
            <Text style={styles.failedText}>Failed to send</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
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
