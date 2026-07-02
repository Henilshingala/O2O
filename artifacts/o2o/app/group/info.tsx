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
import { useFriends } from "@/context/FriendsContext";
import { useColors } from "@/hooks/useColors";
import { uploadFile } from "@/lib/uploadMedia";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export default function GroupInfoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getUserById } = useAuth();
  const { friends } = useFriends();
  const {
    getGroup,
    updateGroup,
    addGroupMember,
    removeGroupMember,
    deleteGroup,
    transferGroupOwnership,
  } = useData();
  const params = useLocalSearchParams<{ id: string }>();
  const group = getGroup(params.id);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);

  if (!user || !group) return null;
  const isOwner = group.createdBy === user.id;
  const owner = getUserById(group.createdBy);
  const nonMembers = friends.filter((f) => !group.members.includes(f.id));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateGroup(group.id, { name: name.trim(), description: description.trim() });
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
      const url = await uploadFile(response.assets[0], "group_photo.jpg");
      await updateGroup(group.id, { image: url });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete Group", "This will permanently delete the group.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteGroup(group.id);
          router.replace("/(tabs)/groups");
        },
      },
    ]);
  };

  const handleTransfer = (memberId: string) => {
    Alert.alert("Transfer Ownership", "Make this member the new group owner?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Transfer",
        onPress: async () => {
          await transferGroupOwnership(group.id, memberId);
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
        <Text style={[styles.title, { color: colors.foreground }]}>Group Info</Text>
        {isOwner && !editing && (
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Feather name="edit-2" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
        {editing ? (
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
            {group.image ? (
              <Image source={{ uri: resolveMediaUrl(group.image) }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profilePlaceholder, { backgroundColor: colors.accent }]}>
                <Feather name="users" size={40} color={colors.primary} />
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
              <AppInput label="Group Name" value={name} onChangeText={setName} style={{ marginTop: 16 }} />
              <AppInput label="Description" value={description} onChangeText={setDescription} multiline style={{ height: 80, marginTop: 8 }} />
            </>
          ) : (
            <>
              <Text style={[styles.groupName, { color: colors.foreground }]}>{group.name}</Text>
              <Text style={[styles.groupDesc, { color: colors.mutedForeground }]}>{group.description}</Text>
              <View style={[styles.ownerBadge, { backgroundColor: colors.secondary }]}>
                <Feather name="shield" size={14} color={colors.primary} />
                <Text style={[styles.ownerText, { color: colors.foreground }]}>
                  Owner: {owner?.fullName ?? "Unknown"}
                </Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Members ({group.members.length})
          </Text>
          {isOwner && (
            <TouchableOpacity onPress={() => setShowAddMembers(!showAddMembers)}>
              <Feather name="user-plus" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {showAddMembers && nonMembers.length > 0 && (
          <View style={[styles.addPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {nonMembers.slice(0, 10).map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[styles.memberRow, { borderBottomColor: colors.border }]}
                onPress={async () => {
                  await addGroupMember(group.id, f.id);
                  setShowAddMembers(false);
                }}
              >
                <Avatar name={f.fullName} size={40} />
                <Text style={[styles.memberName, { color: colors.foreground }]}>{f.fullName}</Text>
                <Feather name="plus" size={18} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {group.members.map((memberId) => {
          const member = getUserById(memberId);
          const isMemberOwner = memberId === group.createdBy;
          return (
            <View key={memberId} style={[styles.memberRow, { borderBottomColor: colors.border }]}>
              <Avatar name={member?.fullName ?? "?"} size={44} />
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: colors.foreground }]}>
                  {member?.fullName ?? "Unknown"}
                  {memberId === user.id ? " (You)" : ""}
                </Text>
                {isMemberOwner && (
                  <Text style={[styles.adminLabel, { color: colors.primary }]}>Group Admin</Text>
                )}
              </View>
              {isOwner && memberId !== user.id && (
                <View style={styles.memberActions}>
                  {!isMemberOwner && (
                    <TouchableOpacity onPress={() => handleTransfer(memberId)} style={styles.actionBtn}>
                      <Feather name="award" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => removeGroupMember(group.id, memberId)}
                    style={styles.actionBtn}
                  >
                    <Feather name="user-minus" size={16} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              )}
              {!isOwner && memberId === user.id && (
                <TouchableOpacity onPress={() => removeGroupMember(group.id, user.id)}>
                  <Text style={{ color: colors.destructive, fontSize: 13 }}>Leave</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {isOwner && (
          <AppButton title="DELETE GROUP" variant="destructive" onPress={handleDelete} style={styles.deleteBtn} />
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
  groupName: { fontSize: 22, fontWeight: "800", marginTop: 16, textAlign: "center" },
  groupDesc: { fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
  ownerBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 12 },
  ownerText: { fontSize: 13, fontWeight: "600" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  addPanel: { borderRadius: 12, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: "600" },
  adminLabel: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  memberActions: { flexDirection: "row", gap: 8 },
  actionBtn: { padding: 6 },
  deleteBtn: { marginTop: 32 },
});
