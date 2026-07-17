import { router } from "@/compat/router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import * as Haptics from "@/compat/haptics";
import { launchImageLibrary } from "react-native-image-picker";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { uploadFile } from "@/lib/uploadMedia";

function MenuItem({
  icon,
  label,
  onPress,
  colors,
  danger = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  colors: any;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
      onPress={onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: danger ? "#FEE2E2" : colors.muted }]}>
        <Feather name={icon as any} size={18} color={danger ? colors.destructive : colors.foreground} />
      </View>
      <Text style={[styles.menuLabel, { color: danger ? colors.destructive : colors.foreground }]}>{label}</Text>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function EditProfileModal({
  visible,
  onClose,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  colors: any;
}) {
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    launchImageLibrary(
      { mediaType: "photo", quality: 0.8, includeBase64: false },
      async (response) => {
        if (response.didCancel || response.errorCode) return;
        const asset = response.assets?.[0];
        if (!asset?.uri) return;
        setUploading(true);
        try {
          const url = await uploadFile({
            uri: asset.uri,
            type: asset.type ?? "image/jpeg",
            fileName: asset.fileName ?? "avatar.jpg",
          });
          setAvatarUri(url);
        } catch (e: any) {
          Alert.alert("Upload failed", e?.message ?? "Could not upload image. Try again.");
        } finally {
          setUploading(false);
        }
      }
    );
  };

  const handleSave = async () => {
    if (!fullName.trim()) { Alert.alert("Name required", "Full name cannot be empty."); return; }
    if (!username.trim()) { Alert.alert("Username required", "Username cannot be empty."); return; }
    setSaving(true);
    const updates: Record<string, unknown> = {};
    if (fullName !== user?.fullName) updates.fullName = fullName.trim();
    if (username !== user?.username) updates.username = username.trim();
    if (city !== user?.city) updates.city = city.trim();
    if (avatarUri !== user?.avatar) updates.avatar = avatarUri;

    if (Object.keys(updates).length === 0) { onClose(); setSaving(false); return; }

    const result = await updateProfile(updates as any);
    setSaving(false);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } else {
      Alert.alert("Update failed", result.error ?? "Could not update profile.");
    }
  };

  const handleRemoveAvatar = () => {
    Alert.alert("Remove photo", "Remove your profile photo?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setAvatarUri(null) },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
        {/* Modal Header */}
        <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={onClose} style={styles.modalCancel}>
            <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.modalSave}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.modalSaveText, { color: colors.primary }]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent}>
          {/* Avatar picker */}
          <View style={styles.avatarSection}>
            <View style={{ position: "relative" }}>
              <Avatar name={fullName || user?.fullName || "?"} size={88} uri={avatarUri} />
              {uploading && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
            <View style={styles.avatarActions}>
              <TouchableOpacity
                style={[styles.avatarBtn, { backgroundColor: colors.primary }]}
                onPress={pickImage}
                disabled={uploading}
              >
                <Feather name="camera" size={14} color="#fff" />
                <Text style={styles.avatarBtnText}>Change Photo</Text>
              </TouchableOpacity>
              {avatarUri && (
                <TouchableOpacity
                  style={[styles.avatarBtn, { backgroundColor: colors.muted }]}
                  onPress={handleRemoveAvatar}
                  disabled={uploading}
                >
                  <Feather name="trash-2" size={14} color={colors.destructive} />
                  <Text style={[styles.avatarBtnText, { color: colors.destructive }]}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Fields */}
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>FULL NAME</Text>
          <TextInput
            style={[styles.field, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your full name"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            maxLength={80}
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>USERNAME</Text>
          <TextInput
            style={[styles.field, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder="username"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
          />
          <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
            Letters, numbers and underscores only.
          </Text>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CITY</Text>
          <TextInput
            style={[styles.field, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            value={city}
            onChangeText={setCity}
            placeholder="Your city"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            maxLength={60}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function SettingsTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { getMyOrders, getMyBids, channels } = useData();
  const queryClient = useQueryClient();
  const [editProfileVisible, setEditProfileVisible] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["user-settings"],
    queryFn: () => customFetch<any>("/api/users/me/settings"),
    enabled: !!user,
  });

  const updateSettingsMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      customFetch("/api/users/me/settings", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-settings"] }),
  });

  if (!user) return null;

  const myOrders = getMyOrders(user.id, user.role);
  const myBids = getMyBids(user.id);
  const myChannels = channels.filter((c) => c.ownerId === user.id);

  const handleLogout = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await logout();
    router.replace("/welcome");
  };

  return (
    <>
      <ScrollView
        style={[styles.root, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 90 }}
      >
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
              paddingTop: insets.top + 8,
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
        </View>

        {/* Profile Card */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setEditProfileVisible(true)}
          activeOpacity={0.8}
        >
          <Avatar name={user.fullName} size={64} uri={user.avatar} />
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.foreground }]}>{user.fullName}</Text>
            <Text style={[styles.profileUsername, { color: colors.mutedForeground }]}>@{user.username}</Text>
            <View style={styles.profileMeta}>
              <Badge label={user.role.toUpperCase()} variant={user.role === "seller" ? "primary" : "success"} />
              <Text style={[styles.profileCity, { color: colors.mutedForeground }]}>{user.city}</Text>
            </View>
          </View>
          <View style={[styles.editBadge, { backgroundColor: colors.muted }]}>
            <Feather name="edit-2" size={14} color={colors.foreground} />
          </View>
        </TouchableOpacity>

        {/* Stats */}
        <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: colors.primary }]}>{myOrders.length}</Text>
            <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Orders</Text>
          </View>
          {user.role === "buyer" && (
            <View style={styles.stat}>
              <Text style={[styles.statVal, { color: colors.primary }]}>{myBids.length}</Text>
              <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Bids</Text>
            </View>
          )}
          {user.role === "seller" && (
            <View style={styles.stat}>
              <Text style={[styles.statVal, { color: colors.primary }]}>{myChannels.length}</Text>
              <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Channels</Text>
            </View>
          )}
        </View>

        {/* Preferences */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PREFERENCES</Text>
        <View style={[styles.menuGroup, { borderColor: colors.border }]}>
          <View style={[styles.menuItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <View style={[styles.menuIcon, { backgroundColor: colors.muted }]}>
              <Feather name="bell" size={18} color={colors.foreground} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.foreground }]}>Notifications</Text>
            <Switch
              value={settings?.notificationsEnabled ?? true}
              onValueChange={(v) => updateSettingsMut.mutate({ notificationsEnabled: v })}
            />
          </View>
          <MenuItem
            icon="shield"
            label={`Privacy: ${settings?.privacyLevel ?? "public"}`}
            onPress={() => {
              const next =
                settings?.privacyLevel === "public"
                  ? "friends"
                  : settings?.privacyLevel === "friends"
                  ? "private"
                  : "public";
              updateSettingsMut.mutate({ privacyLevel: next });
            }}
            colors={colors}
          />
        </View>

        {/* Account Section */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACCOUNT</Text>
        <View style={[styles.menuGroup, { borderColor: colors.border }]}>
          <MenuItem icon="user" label="Edit Profile" onPress={() => setEditProfileVisible(true)} colors={colors} />
          <MenuItem icon="mail" label={user.email} onPress={() => router.push("/notifications")} colors={colors} />
          <MenuItem icon="phone" label={user.mobile} onPress={() => {}} colors={colors} />
          <MenuItem icon="map-pin" label={user.city} onPress={() => {}} colors={colors} />
        </View>

        {/* Role-specific */}
        {user.role === "buyer" && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>BUYER</Text>
            <View style={[styles.menuGroup, { borderColor: colors.border }]}>
              <MenuItem icon="heart" label="My Wishlist" onPress={() => router.push("/wishlist")} colors={colors} />
              <MenuItem icon="trending-up" label="My Bids" onPress={() => router.push("/my-bids")} colors={colors} />
              <MenuItem icon="package" label="My Orders" onPress={() => router.push("/my-orders")} colors={colors} />
            </View>
          </>
        )}

        {user.role === "seller" && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SELLER</Text>
            <View style={[styles.menuGroup, { borderColor: colors.border }]}>
              <MenuItem icon="radio" label="My Channels" onPress={() => router.push("/(tabs)/channels")} colors={colors} />
              <MenuItem icon="bar-chart-2" label="Analytics" onPress={() => router.push("/analytics")} colors={colors} />
              <MenuItem icon="trending-up" label="Bid Requests" onPress={() => router.push("/seller-bids")} colors={colors} />
              <MenuItem icon="package" label="My Orders" onPress={() => router.push("/my-orders")} colors={colors} />
            </View>
          </>
        )}

        {/* Logout */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DANGER ZONE</Text>
        <View style={[styles.menuGroup, { borderColor: colors.border }]}>
          <MenuItem icon="log-out" label="Log Out" onPress={handleLogout} colors={colors} danger />
        </View>
      </ScrollView>

      <EditProfileModal
        visible={editProfileVisible}
        onClose={() => setEditProfileVisible(false)}
        colors={colors}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 22, fontWeight: "800" },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 18, fontWeight: "800" },
  profileUsername: { fontSize: 13 },
  profileMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  profileCity: { fontSize: 12 },
  editBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  stat: { flex: 1, alignItems: "center" },
  statVal: { fontSize: 22, fontWeight: "800" },
  statLbl: { fontSize: 12, marginTop: 2 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    letterSpacing: 0.5,
  },
  menuGroup: { borderTopWidth: 1, borderBottomWidth: 1, backgroundColor: "transparent" },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { flex: 1, fontSize: 15 },
  // Modal
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  modalCancel: { minWidth: 60 },
  modalCancelText: { fontSize: 16 },
  modalSave: { minWidth: 60, alignItems: "flex-end" },
  modalSaveText: { fontSize: 16, fontWeight: "600" },
  modalContent: { padding: 20, gap: 4 },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 16,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 44,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarActions: { flexDirection: "row", gap: 10 },
  avatarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  avatarBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 6,
  },
  field: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  fieldHint: { fontSize: 12, marginTop: 4 },
});
