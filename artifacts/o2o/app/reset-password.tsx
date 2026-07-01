import { router, useLocalSearchParams } from "@/compat/router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/compat/vector-icons";
import * as Haptics from "@/compat/haptics";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function ResetPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { resetPassword } = useAuth();
  const params = useLocalSearchParams<{ email: string }>();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    const result = await resetPassword(params.email, password);
    setLoading(false);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/login");
    } else {
      setError(result.error ?? "Failed to reset");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "web" ? "padding" : "height"}
    >
      <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.foreground }]}>RESET PASSWORD</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Create a new password for your account
        </Text>

        <View style={styles.form}>
          <AppInput
            label="New Password"
            value={password}
            onChangeText={(v) => { setPassword(v); setError(""); }}
            placeholder="Min 6 characters"
            secureTextEntry={!showPassword}
            rightIcon={showPassword ? "eye-off" : "eye"}
            onRightIconPress={() => setShowPassword(!showPassword)}
          />
          <AppInput
            label="Confirm Password"
            value={confirm}
            onChangeText={(v) => { setConfirm(v); setError(""); }}
            placeholder="Re-enter new password"
            secureTextEntry={!showPassword}
          />

          {error ? (
            <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
          ) : null}

          <AppButton title="SUBMIT" onPress={handleSubmit} loading={loading} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  backBtn: { marginBottom: 28 },
  title: { fontSize: 24, fontWeight: "900", letterSpacing: 1.5, marginBottom: 8 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 32 },
  form: { gap: 16 },
  error: { fontSize: 13 },
});
