import { LinearGradient } from "@/compat/linear-gradient";
import { router } from "@/compat/router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "@/context/AuthContext";

const { width, height } = Dimensions.get("window");

export default function SplashScreen() {
  const { user, isLoading } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2200,
      useNativeDriver: false,
    }).start();

    const timer = setTimeout(() => {
      if (!isLoading) {
        if (user) {
          router.replace("/(tabs)");
        } else {
          router.replace("/welcome");
        }
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [isLoading, user]);

  return (
    <LinearGradient
      colors={["#1E3A8A", "#2563EB", "#3B82F6"]}
      style={styles.container}
    >
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>O2O</Text>
        </View>
        <Text style={styles.appName}>O2O</Text>
        <Text style={styles.tagline}>Buy • Sell • Bid</Text>
      </Animated.View>

      <View style={styles.bottom}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { alignItems: "center" },
  logoBox: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  logoText: { fontSize: 32, fontWeight: "900", color: "#fff" },
  appName: { fontSize: 42, fontWeight: "900", color: "#fff", letterSpacing: 4 },
  tagline: { fontSize: 16, color: "rgba(255,255,255,0.8)", marginTop: 8, letterSpacing: 3 },
  bottom: { position: "absolute", bottom: 80, width: width * 0.6, alignItems: "center", gap: 12 },
  progressTrack: {
    width: "100%",
    height: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: { height: "100%", backgroundColor: "#fff", borderRadius: 2 },
  loadingText: { color: "rgba(255,255,255,0.6)", fontSize: 13 },
});
