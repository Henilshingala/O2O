import { router } from "@/compat/router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "@/compat/haptics";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function SignupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signup } = useAuth();
  const [form, setForm] = useState({
    username: "",
    fullName: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    city: "",
  });
  const [role, setRole] = useState<"buyer" | "seller" | "">("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.username.trim()) e.username = "Username is required";
    if (!form.fullName.trim()) e.fullName = "Full name is required";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid email required";
    if (!form.mobile.trim() || form.mobile.length < 10) e.mobile = "Valid mobile required";
    if (!form.password || form.password.length < 6) e.password = "Min 6 characters";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords don't match";
    if (!form.city.trim()) e.city = "City is required";
    if (!role) e.role = "Please select a role";
    return e;
  };

  const handleSignup = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setLoading(true);
    setErrors({});
    const result = await signup({
      username: form.username.trim(),
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      mobile: form.mobile.trim(),
      password: form.password,
      city: form.city.trim(),
      role: role as "buyer" | "seller",
    });
    setLoading(false);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrors({ general: result.error ?? "Signup failed" });
    }
  };

  const isFormValid =
    form.username && form.fullName && form.email && form.mobile &&
    form.password && form.confirmPassword && form.city && role;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>SIGN UP</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Create your account
        </Text>

        {errors.general && (
          <View style={[styles.errorBox, { backgroundColor: "#FEE2E2" }]}>
            <Text style={{ color: colors.destructive, fontSize: 13 }}>{errors.general}</Text>
          </View>
        )}

        <AppInput
          label="Username"
          value={form.username}
          onChangeText={set("username")}
          placeholder="Choose a unique username"
          autoCapitalize="none"
          error={errors.username}
        />
        <AppInput
          label="Full Name"
          value={form.fullName}
          onChangeText={set("fullName")}
          placeholder="Your full name"
          error={errors.fullName}
        />
        <AppInput
          label="Email"
          value={form.email}
          onChangeText={set("email")}
          placeholder="Your email address"
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.email}
        />
        <AppInput
          label="Mobile Number"
          value={form.mobile}
          onChangeText={set("mobile")}
          placeholder="10-digit mobile number"
          keyboardType="phone-pad"
          error={errors.mobile}
        />
        <AppInput
          label="Password"
          value={form.password}
          onChangeText={set("password")}
          placeholder="Min 6 characters"
          secureTextEntry={!showPassword}
          rightIcon={showPassword ? "eye-off" : "eye"}
          onRightIconPress={() => setShowPassword(!showPassword)}
          error={errors.password}
        />
        <AppInput
          label="Confirm Password"
          value={form.confirmPassword}
          onChangeText={set("confirmPassword")}
          placeholder="Re-enter your password"
          secureTextEntry={!showPassword}
          error={errors.confirmPassword}
        />
        <AppInput
          label="City"
          value={form.city}
          onChangeText={set("city")}
          placeholder="Your city"
          error={errors.city}
        />

        <Text style={[styles.roleLabel, { color: colors.foreground }]}>Select Role</Text>
        <View style={styles.roleRow}>
          {(["seller", "buyer"] as const).map((r) => (
            <TouchableOpacity
              key={r}
              style={[
                styles.roleOption,
                {
                  borderColor: role === r ? colors.primary : colors.border,
                  backgroundColor: role === r ? colors.secondary : colors.card,
                },
              ]}
              onPress={() => setRole(r)}
            >
              <View
                style={[
                  styles.radio,
                  { borderColor: role === r ? colors.primary : colors.border },
                ]}
              >
                {role === r && (
                  <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />
                )}
              </View>
              <Text style={[styles.roleText, { color: colors.foreground }]}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.role && (
          <Text style={[styles.fieldError, { color: colors.destructive }]}>{errors.role}</Text>
        )}

        <AppButton
          title="SIGN UP"
          onPress={handleSignup}
          loading={loading}
          disabled={!isFormValid}
          style={styles.btn}
        />

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            Already have account?{" "}
          </Text>
          <TouchableOpacity onPress={() => router.push("/login")}>
            <Text style={[styles.linkText, { color: colors.primary }]}>Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 24 },
  title: { fontSize: 26, fontWeight: "900", letterSpacing: 2, marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  errorBox: { borderRadius: 10, padding: 12, marginBottom: 16 },
  roleLabel: { fontSize: 13, fontWeight: "600", marginBottom: 10 },
  roleRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  roleOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  roleText: { fontSize: 14, fontWeight: "600" },
  fieldError: { fontSize: 12, marginBottom: 12, marginTop: -8 },
  btn: { marginTop: 8 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { fontSize: 14 },
  linkText: { fontSize: 14, fontWeight: "700" },
});
