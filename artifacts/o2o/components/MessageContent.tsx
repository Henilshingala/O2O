import React from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ReactNativeBlobUtil from "react-native-blob-util";
import { Feather } from "@/compat/vector-icons";
import { AudioPlayer } from "@/components/AudioPlayer";
import { ChatBubble } from "@/components/ChatBubble";
import { MediaAlbum } from "@/components/MediaAlbum";
import { MessageStatusIcon } from "@/components/MessageStatusIcon";
import { UploadProgressBubble } from "@/components/UploadProgressBubble";
import { useColors } from "@/hooks/useColors";
import { openLocation } from "@/lib/openLocation";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import type { UploadProgress } from "@/lib/uploadMedia";
import { getBaseUrl } from "@workspace/api-client-react";
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

/** Map file extension → MIME type for Android intent */
function getMimeType(fileName: string): string {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    csv: "text/csv",
    zip: "application/zip",
    rar: "application/x-rar-compressed",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    mov: "video/quicktime",
  };
  return map[ext] ?? "application/octet-stream";
}

/** Shows a loading indicator state - tracks ongoing operations */
let _downloadingMap: Record<string, boolean> = {};

/**
 * Download a remote file to the device Downloads folder then open it
 * with the Android native app chooser. For Cloudinary raw files (PDFs, docs)
 * the URL is directly accessible — try Linking first, fall back to blob download.
 */
async function openDocument(url: string, fileName: string): Promise<void> {
  if (_downloadingMap[url]) return;
  _downloadingMap[url] = true;

  try {
    let nameToUse = fileName;
    if (!nameToUse.includes(".")) {
      const urlExt = url.split("?")[0].split(".").pop();
      if (urlExt && urlExt.length <= 5) nameToUse = `${nameToUse}.${urlExt}`;
    }

    const mimeType = getMimeType(nameToUse);
    const safeFileName = nameToUse.replace(/[^a-zA-Z0-9._\-]/g, "_");
    const destDir = ReactNativeBlobUtil.fs.dirs.CacheDir;
    const destPath = `${destDir}/${Date.now()}_${safeFileName}`;

    let finalPath: string;

    if (url.startsWith("file://")) {
      finalPath = url.replace("file://", "");
    } else if (url.startsWith("/")) {
      finalPath = url;
    } else {
      let fetchUrl = url;
      if (url.includes("cloudinary.com")) {
        const base = getBaseUrl();
        fetchUrl = `${base}/api/proxy/download?url=${encodeURIComponent(url)}`;
      }

      const res = await ReactNativeBlobUtil.config({
        path: destPath,
        overwrite: true,
      }).fetch("GET", fetchUrl, { "Cache-Control": "no-store" });

      const status = res.info().status;
      if (status !== 200) {
        // Fallback to direct URL if proxy fails
        const directRes = await ReactNativeBlobUtil.config({
          path: destPath,
          overwrite: true,
        }).fetch("GET", url, { "Cache-Control": "no-store" });
        if (directRes.info().status !== 200) {
          throw new Error(`Server returned HTTP ${status}. Cannot open file.`);
        }
      }

      finalPath = res.path();

      const fileInfo = await ReactNativeBlobUtil.fs.stat(finalPath);
      if (!fileInfo || fileInfo.size === 0) {
        throw new Error("Downloaded file is empty. Please check your connection and try again.");
      }
    }

    if (Platform.OS === "android") {
      try {
        await ReactNativeBlobUtil.android.actionViewIntent(finalPath, mimeType);
      } catch (intentErr) {
        // Fallback to Google Docs Viewer online if no native app installed
        const gviewUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
        const canOpen = await Linking.canOpenURL(gviewUrl).catch(() => false);
        if (canOpen) {
          await Linking.openURL(gviewUrl);
        } else {
          throw intentErr;
        }
      }
    } else {
      await ReactNativeBlobUtil.ios.openDocument(finalPath);
    }
  } catch (error: any) {
    console.error("openDocument error:", error);
    Alert.alert(
      "Could Not Open File",
      error?.message ?? "An unknown error occurred while trying to open this file.",
      [{ text: "OK" }]
    );
  } finally {
    delete _downloadingMap[url];
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
        <View style={[styles.wrapper, { alignSelf: isMine ? "flex-end" : "flex-start" }]}>
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
        <View style={[styles.wrapper, { alignSelf: isMine ? "flex-end" : "flex-start" }]}>
          {!isMine && senderName && (
            <Text style={[styles.sender, { color: colors.primary }]}>{senderName}</Text>
          )}
          <MediaAlbum urls={[url]} types={[item.type as "image" | "video"]} />
          {statusFooter}
        </View>
      );
    }
  }

  // ── Audio (in-app player) ─────────────────────────────────────────────────
  else if (item.type === "audio") {
    const url = resolveMediaUrl(String(item.metadata?.url || ""));
    const duration = item.metadata?.duration as string | undefined;
    const fileName = item.metadata?.fileName ? String(item.metadata.fileName) : undefined;

    content = (
      <View style={[styles.wrapper, { alignSelf: isMine ? "flex-end" : "flex-start" }]}>
        {!isMine && senderName && (
          <Text style={[styles.sender, { color: colors.primary }]}>{senderName}</Text>
        )}
        <AudioPlayer
          uri={url}
          fileName={fileName}
          duration={duration}
          isMine={isMine}
          onLongPress={onLongPress}
        />
        {statusFooter}
      </View>
    );
  }

  // ── File / Document (download + open with system viewer, no browser) ──────
  else if (item.type === "file") {
    const url = resolveMediaUrl(String(item.metadata?.url || ""));
    const fileName = String(item.metadata?.fileName || "Document");

    content = (
      <View style={[styles.wrapper, { alignSelf: isMine ? "flex-end" : "flex-start" }]}>
        {!isMine && senderName && (
          <Text style={[styles.sender, { color: colors.primary }]}>{senderName}</Text>
        )}
        <TouchableOpacity
          style={[styles.fileMsg, { backgroundColor: colors.muted, borderColor: colors.border }]}
          onPress={() => { if (url) openDocument(url, fileName); }}
          onLongPress={onLongPress}
        >
          <Feather name="file-text" size={24} color={colors.primary} />
          <Text style={{ color: colors.foreground, flex: 1 }} numberOfLines={2}>
            {fileName}
          </Text>
          <Feather name="external-link" size={18} color={colors.primary} />
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
      <View style={[styles.wrapper, { alignSelf: isMine ? "flex-end" : "flex-start" }]}>
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
      <View style={[styles.wrapper, { alignSelf: isMine ? "flex-end" : "flex-start" }]}>
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
      <>
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
      </>
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
      <View style={{ flex: 1, alignItems: isMine ? "flex-end" : "flex-start" }}>
        {content}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  selectionWrap: { flexDirection: "row", alignItems: "center", width: "100%" },
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
