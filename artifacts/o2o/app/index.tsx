/**
 * index.tsx — Minimal redirect screen.
 *
 * The video splash is handled entirely in _layout.tsx (outside the Stack),
 * so by the time this screen is navigated to, splash is already done.
 * This screen is a safety net: it immediately replaces itself with the correct
 * destination based on auth state.
 */
import { router } from "@/compat/router";
import React, { useEffect } from "react";
import { View } from "react-native";
import { useAuth } from "@/context/AuthContext";

export default function IndexScreen() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      router.replace("/(tabs)");
    } else {
      router.replace("/welcome");
    }
  }, [isLoading, user]);

  // Transparent while auth resolves (splash video is covering it anyway)
  return <View style={{ flex: 1, backgroundColor: "#044D2A" }} />;
}
