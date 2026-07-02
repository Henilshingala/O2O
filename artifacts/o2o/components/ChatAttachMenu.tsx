import React, { useState } from "react";
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
import { useColors } from "@/hooks/useColors";
import { uploadFile } from "@/lib/uploadMedia";
import type { Message } from "@/types";

interface ChatAttachMenuProps {
  visible: boolean;
  onClose: () => void;
  onSend: (msg: Omit<Message, "id">) => void;
  senderId: string;
  bottomInset?: number;
  onShowPoll?: () => void;
}

export function ChatAttachMenu({
  visible,
  onClose,
  onSend,
  senderId,
  bottomInset = 16,
  onShowPoll,
}: ChatAttachMenuProps) {
  const colors = useColors();
  const [uploading, setUploading] = useState(false);

  if (!visible) return null;

  const now = () => new Date().toISOString();

  const uploadAndSend = async (
    asset: { uri?: string | null; type?: string | null; fileName?: string | null },
    type: "image" | "video" | "audio" | "file",
    label: string,
    extraMeta: Record<string, unknown> = {}
  ) => {
    if (!asset.uri) return;
    onClose();
    setUploading(true);
    try {
      const url = await uploadFile(asset, asset.fileName || "upload");
      onSend({
        senderId,
        text: label,
        timestamp: now(),
        type,
        metadata: { url, ...extraMeta },
      });
    } catch (e) {
      console.error("Upload error", e);
    } finally {
      setUploading(false);
    }
  };

  const handlePickMedia = async () => {
    const response = await launchImageLibrary({ mediaType: "mixed", quality: 0.8 });
    if (response.assets?.[0]) {
      const asset = response.assets[0];
      const type = asset.type?.startsWith("video") ? "video" : "image";
      await uploadAndSend(asset, type, type === "video" ? "Video message" : "Photo message");
    }
  };

  const handleCamera = async () => {
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
    }
    const response = await launchCamera({ mediaType: "mixed", quality: 0.8 });
    if (response.assets?.[0]) {
      const asset = response.assets[0];
      const type = asset.type?.startsWith("video") ? "video" : "image";
      await uploadAndSend(asset, type, type === "video" ? "Video message" : "Photo message");
    }
  };

  const handleLocation = async () => {
    onClose();
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
    }
    Geolocation.getCurrentPosition(
      (position) => {
        onSend({
          senderId,
          text: "📍 Shared Location",
          timestamp: now(),
          type: "location",
          metadata: { lat: position.coords.latitude, lng: position.coords.longitude },
        });
      },
      (error) => console.log(error.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const handleDocument = async () => {
    const response = await launchImageLibrary({ mediaType: "mixed", quality: 1 });
    if (response.assets?.[0]) {
      const asset = response.assets[0];
      await uploadAndSend(
        asset,
        "file",
        asset.fileName || "Document",
        { fileName: asset.fileName || "Document" }
      );
    } else {
      onClose();
    }
  };

  const handleVoice = async () => {
    const response = await launchImageLibrary({ mediaType: "video", quality: 0.8 });
    if (response.assets?.[0]) {
      await uploadAndSend(response.assets[0], "audio", "Voice message", { mimeType: "audio" });
    } else {
      onClose();
    }
  };

  return (
    <View style={[styles.menu, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomInset }]}>
      {uploading && (
        <Text style={[styles.uploading, { color: colors.mutedForeground }]}>Uploading...</Text>
      )}
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
        <TouchableOpacity style={styles.item} onPress={() => { onClose(); onShowPoll(); }}>
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
  menu: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", paddingVertical: 16, borderTopWidth: 1 },
  item: { alignItems: "center", gap: 8, width: "20%", minWidth: 72, marginVertical: 8 },
  iconBg: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  uploading: { width: "100%", textAlign: "center", fontSize: 12, marginBottom: 8 },
});
