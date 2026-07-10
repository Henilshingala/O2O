import React, { useCallback, useRef, useState } from "react";
import {
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, Ionicons } from "@/compat/vector-icons";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import Geolocation from "react-native-geolocation-service";
import DocumentPicker from "react-native-document-picker";
import { useColors } from "@/hooks/useColors";
import {
  uploadFileWithProgress,
  type UploadAsset,
  type UploadHandle,
  type UploadProgress,
  type UploadState,
} from "@/lib/uploadMedia";
import type { Message } from "@/types";

interface ActiveUpload {
  tempId: string;
  fileName: string;
  progress: UploadProgress | null;
  state: UploadState;
  handle: UploadHandle;
  type: "image" | "video" | "audio" | "file";
  label: string;
  extraMeta: Record<string, unknown>;
}

interface ChatAttachMenuProps {
  visible: boolean;
  onClose: () => void;
  /** Called when a media message is fully assembled and ready to send */
  onSend: (msg: Omit<Message, "id">) => void;
  /** Called to immediately show a "sending" placeholder in the chat */
  onSendPlaceholder: (tempId: string, msg: Omit<Message, "id">) => void;
  /** Called to replace or remove a placeholder by tempId */
  onResolvePlaceholder: (
    tempId: string,
    result: { url: string } | { error: string }
  ) => void;
  senderId: string;
  chatId?: string;
  groupId?: string;
  channelId?: string;
  bottomInset?: number;
  onShowPoll?: () => void;
}

export function ChatAttachMenu({
  visible,
  onClose,
  onSend,
  onSendPlaceholder,
  onResolvePlaceholder,
  senderId,
  chatId,
  groupId,
  channelId,
  bottomInset = 16,
  onShowPoll,
}: ChatAttachMenuProps) {
  const colors = useColors();

  const now = () => new Date().toISOString();

  const roomMeta = {
    ...(chatId ? { chatId } : {}),
    ...(groupId ? { groupId } : {}),
    ...(channelId ? { channelId } : {}),
  };

  /**
   * Core upload-and-send for a single asset.
   * 1. Immediately places a "sending" placeholder in the UI.
   * 2. Starts the XHR upload, reporting progress in real time.
   * 3. On success → resolves placeholder → calls onSend (triggers actual socket send).
   * 4. On failure → marks placeholder as failed with error.
   */
  const uploadAndSend = useCallback(
    async (
      asset: UploadAsset,
      type: "image" | "video" | "audio" | "file",
      label: string,
      extraMeta: Record<string, unknown> = {}
    ) => {
      if (!asset.uri) return;

      const tempId = `temp_upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const fallback = asset.fileName || `upload.${type === "video" ? "mp4" : type === "audio" ? "m4a" : "jpg"}`;

      console.log(`[UPLOAD_START] tempId=${tempId} type=${type} file=${fallback}`);

      // Show placeholder immediately
      onSendPlaceholder(tempId, {
        senderId,
        text: label,
        timestamp: now(),
        type,
        status: "sending" as const,
        metadata: { fileName: asset.fileName || fallback, uploading: true, ...extraMeta },
        ...roomMeta,
      });

      onClose();

      let lastProgress: UploadProgress | null = null;

      const handle = uploadFileWithProgress(
        asset,
        fallback,
        (progress) => {
          lastProgress = progress;
          // Forward progress to placeholder (onResolvePlaceholder with no url = progress update)
          onResolvePlaceholder(tempId, { url: `__progress__${JSON.stringify(progress)}` });
        }
      );

      try {
        const url = await handle.result;
        console.log(`[UPLOAD_SUCCESS] url=${url}`);
        console.log(`[UPLOAD_RESPONSE] parsed correctly`);
        // Replace placeholder with real message
        onResolvePlaceholder(tempId, { url });
        console.log(`[MESSAGE_CREATE_REQUEST] calling onSend`);
        onSend({
          senderId,
          text: label,
          timestamp: now(),
          type,
          status: "sent" as const,
          metadata: { url, fileName: asset.fileName || fallback, ...extraMeta },
          ...roomMeta,
        });
      } catch (err: any) {
        const errMsg = err?.message ?? "Upload failed";
        console.error(`[UPLOAD_FAILED] ${errMsg}`);
        onResolvePlaceholder(tempId, { error: errMsg });
      }
    },
    [senderId, onClose, onSend, onSendPlaceholder, onResolvePlaceholder, chatId, groupId, channelId]
  );

  // ── Gallery (multi-select up to 100) ──────────────────────────────────────
  const handlePickMedia = async () => {
    const response = await launchImageLibrary({
      mediaType: "mixed",
      quality: 0.85,
      selectionLimit: 100, // multi-select
    });

    if (!response.assets?.length) return;
    onClose();

    if (response.assets.length === 1) {
      const asset = response.assets[0];
      const type = asset.type?.startsWith("video") ? "video" : "image";
      await uploadAndSend(asset, type, type === "video" ? "Video" : "Photo");
    } else {
      // Multiple: upload concurrently as an album, use a single message with multiple URLs
      const tempId = `temp_album_${Date.now()}`;
      const allAssets = response.assets;
      const urls: string[] = new Array(allAssets.length).fill("");
      const types = allAssets.map((a) =>
        a.type?.startsWith("video") ? "video" : ("image" as "image" | "video")
      );

      onSendPlaceholder(tempId, {
        senderId,
        text: `${allAssets.length} photos/videos`,
        timestamp: now(),
        type: "image",
        status: "sending" as const,
        metadata: {
          uploading: true,
          albumCount: allAssets.length,
          urls: [],
          types,
        },
        ...roomMeta,
      });

      // Upload all concurrently (limit 3 at a time)
      let completed = 0;
      let failed = 0;
      const sem = 3;
      let idx = 0;

      const worker = async () => {
        while (idx < allAssets.length) {
          const i = idx++;
          const asset = allAssets[i];
          const fallback = asset.fileName || `photo_${i}.${types[i] === "video" ? "mp4" : "jpg"}`;
          try {
            const url = await uploadFileWithProgress(asset, fallback).result;
            urls[i] = url;
          } catch {
            urls[i] = "";
            failed++;
          }
          completed++;
          // Update progress
          onResolvePlaceholder(tempId, {
            url: `__progress__${JSON.stringify({ loaded: completed, total: allAssets.length, percent: Math.round((completed / allAssets.length) * 100), loadedStr: `${completed}`, totalStr: `${allAssets.length}`, remainingStr: `${allAssets.length - completed}`, etaSeconds: NaN })}`,
          });
        }
      };

      const workers = Array.from({ length: Math.min(sem, allAssets.length) }, worker);
      await Promise.all(workers);

      const validUrls = urls.filter(Boolean);
      if (validUrls.length === 0) {
        onResolvePlaceholder(tempId, { error: "All uploads failed" });
        return;
      }

      onResolvePlaceholder(tempId, { url: validUrls[0] });
      onSend({
        senderId,
        text: allAssets.length === 1 ? "Photo" : `${allAssets.length} photos/videos`,
        timestamp: now(),
        type: "image",
        status: "sent" as const,
        metadata: { urls, types, url: validUrls[0] },
        ...roomMeta,
      });
    }
  };

  // ── Camera ────────────────────────────────────────────────────────────────
  const handleCamera = async () => {
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
    }
    const response = await launchCamera({ mediaType: "mixed", quality: 0.85 });
    if (response.assets?.[0]) {
      const asset = response.assets[0];
      const type = asset.type?.startsWith("video") ? "video" : "image";
      await uploadAndSend(asset, type, type === "video" ? "Video" : "Photo");
    }
  };

  // ── Location ──────────────────────────────────────────────────────────────
  const handleLocation = async () => {
    onClose();
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
    }
    Geolocation.getCurrentPosition(
      (position: any) => {
        onSend({
          senderId,
          text: "📍 Shared Location",
          timestamp: now(),
          type: "location",
          metadata: { lat: position.coords.latitude, lng: position.coords.longitude },
          ...roomMeta,
        });
      },
      (error: any) => console.error("Location error:", error.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  // ── Document (real file picker) ───────────────────────────────────────────
  const handleDocument = async () => {
    try {
      const response = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.allFiles],
      });
      if (response) {
        await uploadAndSend(
          { uri: response.uri, type: response.type, fileName: response.name },
          "file",
          response.name || "Document",
          { fileName: response.name || "Document" }
        );
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        console.error("Document picking error:", err);
      }
      onClose();
    }
  };

  // ── Audio / Voice ─────────────────────────────────────────────────────────
  const handleVoice = async () => {
    try {
      const response = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.audio],
      });
      if (response) {
        await uploadAndSend(
          { uri: response.uri, type: response.type, fileName: response.name },
          "audio",
          response.name || "Voice message",
          { mimeType: response.type || "audio" }
        );
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        console.error("Audio picking error:", err);
      }
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <View
      style={[
        styles.menu,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: bottomInset,
        },
      ]}
    >
      <TouchableOpacity style={styles.item} onPress={handleCamera}>
        <View style={[styles.iconBg, { backgroundColor: "#EF4444" }]}>
          <Feather name="camera" size={24} color="#fff" />
        </View>
        <Text style={[styles.label, { color: colors.foreground }]}>Camera</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={handlePickMedia}>
        <View style={[styles.iconBg, { backgroundColor: "#8B5CF6" }]}>
          <Feather name="image" size={24} color="#fff" />
        </View>
        <Text style={[styles.label, { color: colors.foreground }]}>Gallery</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={handleVoice}>
        <View style={[styles.iconBg, { backgroundColor: "#06B6D4" }]}>
          <Feather name="mic" size={24} color="#fff" />
        </View>
        <Text style={[styles.label, { color: colors.foreground }]}>Audio</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={handleLocation}>
        <View style={[styles.iconBg, { backgroundColor: "#10B981" }]}>
          <Feather name="map-pin" size={24} color="#fff" />
        </View>
        <Text style={[styles.label, { color: colors.foreground }]}>Location</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={handleDocument}>
        <View style={[styles.iconBg, { backgroundColor: "#3B82F6" }]}>
          <Feather name="file-text" size={24} color="#fff" />
        </View>
        <Text style={[styles.label, { color: colors.foreground }]}>Document</Text>
      </TouchableOpacity>

      {onShowPoll && (
        <TouchableOpacity
          style={styles.item}
          onPress={() => {
            onClose();
            onShowPoll();
          }}
        >
          <View style={[styles.iconBg, { backgroundColor: "#F59E0B" }]}>
            <Ionicons name="bar-chart-outline" size={24} color="#fff" />
          </View>
          <Text style={[styles.label, { color: colors.foreground }]}>Poll</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  item: {
    alignItems: "center",
    gap: 8,
    width: "18%",
    minWidth: 64,
    marginVertical: 8,
  },
  iconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 11, fontWeight: "600", textAlign: "center" },
});
