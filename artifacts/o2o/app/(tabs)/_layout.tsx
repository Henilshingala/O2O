import { BlurView } from "@/compat/blur";
import { Tabs } from "@/compat/router";
import { Feather } from "@/compat/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useFriends } from "@/context/FriendsContext";

import IndexScreen from "./index";
import ChatScreen from "./chat";
import GroupsScreen from "./groups";
import ChannelsScreen from "./channels";
import FriendsScreen from "./friends";
import SettingsScreen from "./settings";

function FriendsTabIcon({ color }: { color: string }) {
  const { incoming } = useFriends();
  return (
    <View>
      <Feather name="users" size={22} color={color} />
      {incoming.length > 0 && (
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
        </View>
      )}
    </View>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.tabBar,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        component={IndexScreen}
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        component={ChatScreen}
        options={{
          title: "Chat",
          tabBarIcon: ({ color }) => <Feather name="message-circle" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="groups"
        component={GroupsScreen}
        options={{
          title: "Groups",
          tabBarIcon: ({ color }) => <Feather name="users" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        component={FriendsScreen}
        options={{
          title: "Friends",
          tabBarIcon: ({ color }) => <FriendsTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="channels"
        component={ChannelsScreen}
        options={{
          title: "Channel",
          tabBarIcon: ({ color }) => <Feather name="radio" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        component={SettingsScreen}
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Feather name="settings" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  return <ClassicTabLayout />;
}

const styles = StyleSheet.create({
  badge: { position: "absolute", top: -2, right: -4 },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" },
});
