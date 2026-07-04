import { LinearGradient } from "@/compat/linear-gradient";
import { router } from "@/compat/router";
import React from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton } from "@/components/ui/AppButton";
import { useColors } from "@/hooks/useColors";

const { width } = Dimensions.get("window");

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#1E3A8A", "#2563EB"]}
        style={[styles.header, { paddingTop: insets.top + 40 }]}
      >
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>O2O</Text>
        </View>
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, i === 0 && styles.dotActive]} />
          ))}
        </View>
      </LinearGradient>

      <View style={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Welcome to O2O App
        </Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          O2O helps buyers and sellers connect, chat, group, bid, and trade
          products in one place.{"\n\n"}Simple. Fast. Smart.
        </Text>

        <View style={styles.features}>
          {[
            { icon: "💬", label: "Chat with sellers directly" },
            { icon: "📢", label: "Follow channels & discover products" },
            { icon: "⚡", label: "Create bids & get best offers" },
          ].map((f) => (
            <View key={f.label} style={[styles.featureRow, { backgroundColor: colors.secondary }]}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={[styles.featureLabel, { color: colors.foreground }]}>{f.label}</Text>
            </View>
          ))}
        </View>

        <AppButton
          title="Continue →"
          onPress={() => router.push("/login")}
          style={styles.btn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: "center",
    paddingBottom: 48,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  logoText: { fontSize: 30, fontWeight: "900", color: "#fff" },
  dotsRow: { flexDirection: "row", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { width: 20, backgroundColor: "#fff" },
  body: { flex: 1, padding: 28, justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 14, letterSpacing: 0.3 },
  description: { fontSize: 15, lineHeight: 24, marginBottom: 28 },
  features: { gap: 10, marginBottom: 36 },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
  },
  featureIcon: { fontSize: 20 },
  featureLabel: { fontSize: 14, fontWeight: "500" },
  btn: { borderRadius: 14 },
});
