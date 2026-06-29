import { router, useLocalSearchParams } from "@/compat/router";
import React, { useEffect, useState } from "react";
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
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function VerifyOtpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { verifyOtp, sendOtp } = useAuth();
  const params = useLocalSearchParams<{ email: string; otp: string }>();
  const [otpInput, setOtpInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [debugOtp] = useState(params.otp ?? "");

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSubmit = async () => {
    if (!otpInput.trim() || otpInput.length < 4) {
      setError("Enter the OTP code");
      return;
    }
    setLoading(true);
    const result = await verifyOtp(params.email, otpInput.trim());
    setLoading(false);
    if (result.success) {
      router.push({ pathname: "/reset-password", params: { email: params.email } });
    } else {
      setError(result.error ?? "Invalid OTP");
    }
  };

  const handleResend = async () => {
    setCountdown(60);
    await sendOtp(params.email);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.foreground }]}>VERIFY OTP</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          We sent a code to {"\n"}
          <Text style={{ color: colors.primary }}>{params.email}</Text>
        </Text>

        {debugOtp ? (
          <View style={[styles.debugBox, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.debugText, { color: colors.mutedForeground }]}>
              Demo OTP: <Text style={{ color: colors.primary, fontWeight: "700" }}>{debugOtp}</Text>
            </Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <AppInput
            label="Enter OTP Code"
            value={otpInput}
            onChangeText={(v) => { setOtpInput(v); setError(""); }}
            placeholder="6-digit code"
            keyboardType="number-pad"
            maxLength={6}
            error={error}
          />

          {countdown > 0 ? (
            <Text style={[styles.countdownText, { color: colors.mutedForeground }]}>
              Resend OTP in {countdown}s
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend}>
              <Text style={[styles.resendText, { color: colors.primary }]}>Resend OTP</Text>
            </TouchableOpacity>
          )}

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
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 24 },
  debugBox: { padding: 12, borderRadius: 10, marginBottom: 20 },
  debugText: { fontSize: 13 },
  form: { gap: 16 },
  countdownText: { fontSize: 13, textAlign: "center" },
  resendText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
});
