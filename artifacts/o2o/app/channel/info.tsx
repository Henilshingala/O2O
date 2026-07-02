import { router, useLocalSearchParams } from "@/compat/router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import { launchImageLibrary } from "react-native-image-picker";
import { Avatar } from "@/components/ui/Avatar";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { uploadFile } from "@/lib/uploadMedia";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export default function ChannelInfoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getUserById } = useAuth();
  const {
    getChannel,
    updateChannel,
    deleteChannel,
    transferChannelOwnership,
    removeChannelFollower,
  } = useData();
  const params = useLocalSearchParams<{ id: string }>();
  const channel = getChannel(params.id);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(channel?.name ?? "");
  const [description, setDescription] = useState(channel?.description ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!user || !channel) return null;
  const isOwner = channel.ownerId === user.id;
  const owner = getUserById(channel.ownerId);
  const logo = channel.logo ?? (channel as any).image;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateChannel(channel.id, { name: name.trim(), description: description.trim() });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = async () => {
    if (!isOwner) return;
    const response = await launchImageLibrary({ mediaType: "photo", quality: 0.7 });
    if (!response.assets?.[0]?.uri) return;
    setUploading(true);
    try {
      const url = await uploadFile(response.assets[0], "channel_logo.jpg");
      await updateChannel(channel.id, { logo: url });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete Channel", "This will permanently delete the channel.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteChannel(channel.id);
          router.replace("/(tabs)/channels");
        },
      },
    ]);
  };

  const handleTransfer = (followerId: string) => {
    Alert.alert("Transfer Ownership", "Make this follower the new channel owner?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Transfer",
        onPress: async () => {
          await transferChannelOwnership(channel.id, followerId);
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Channel Info</Text>
        {isOwner && !editing ? (
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Feather name="edit-2" size={20} color={colors.primary} />
          </TouchableOpacity>
        ) : editing ? (
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>{saving ? "..." : "Save"}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={handlePickImage} disabled={!isOwner || uploading}>
            {logo ? (
              <Image source={{ uri: resolveMediaUrl(logo) }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profilePlaceholder, { backgroundColor: colors.accent }]}>
                <Feather name="radio" size={40} color={colors.primary} />
              </View>
            )}
            {uploading && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            {isOwner && (
              <View style={[styles.cameraBadge, { backgroundColor: colors.primary }]}>
                <Feather name="camera" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          {editing ? (
            <>
              <AppInput label="Channel Name" value={name} onChangeText={setName} style={{ marginTop: 16, width: "100%" }} />
              <AppInput label="Description" value={description} onChangeText={setDescription} multiline style={{ height: 80, marginTop: 8, width: "100%" }} />
            </>
          ) : (
            <>
              <Text style={[styles.channelName, { color: colors.foreground }]}>{channel.name}</Text>
              <Text style={[styles.channelDesc, { color: colors.mutedForeground }]}>{channel.description}</Text>
              <Text style={[styles.category, { color: colors.primary }]}>{channel.category} · {channel.visibility}</Text>
              <View style={[styles.ownerBadge, { backgroundColor: colors.secondary }]}>
                <Feather name="shield" size={14} color={colors.primary} />
                <Text style={[styles.ownerText, { color: colors.foreground }]}>
                  Owner: {owner?.fullName ?? "Unknown"}
                </Text>
              </View>
            </>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Followers ({channel.followers.length})
        </Text>

        {channel.followers.length === 0 ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>No followers yet</Text>
        ) : (
          channel.followers.map((followerId) => {
            const follower = getUserById(followerId);
            return (
              <View key={followerId} style={[styles.followerRow, { borderBottomColor: colors.border }]}>
                <Avatar name={follower?.fullName ?? "?"} size={44} />
                <View style={styles.followerInfo}>
                  <Text style={[styles.followerName, { color: colors.foreground }]}>
                    {follower?.fullName ?? followerId}
                    {followerId === user.id ? " (You)" : ""}
                  </Text>
                </View>
                {isOwner && followerId !== user.id && (
                  <View style={styles.followerActions}>
                    <TouchableOpacity onPress={() => handleTransfer(followerId)} style={styles.actionBtn}>
                      <Feather name="award" size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeChannelFollower(channel.id, followerId)} style={styles.actionBtn}>
                      <Feather name="user-minus" size={16} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}

        {isOwner && (
          <AppButton title="DELETE CHANNEL" variant="destructive" onPress={handleDelete} style={styles.deleteBtn} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 17, fontWeight: "700" },
  content: { padding: 16 },
  profileSection: { alignItems: "center", marginBottom: 24 },
  profileImage: { width: 120, height: 120, borderRadius: 60 },
  profilePlaceholder: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center" },
  uploadOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 60, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  cameraBadge: { position: "absolute", bottom: 4, right: 4, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  channelName: { fontSize: 22, fontWeight: "800", marginTop: 16, textAlign: "center" },
  channelDesc: { fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
  category: { fontSize: 13, fontWeight: "600", marginTop: 8 },
  ownerBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 12 },
  ownerText: { fontSize: 13, fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  empty: { fontSize: 14, marginBottom: 16 },
  followerRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  followerInfo: { flex: 1 },
  followerName: { fontSize: 15, fontWeight: "600" },
  followerActions: { flexDirection: "row", gap: 8 },
  actionBtn: { padding: 6 },
  deleteBtn: { marginTop: 32 },
});
