/**
 * FEATURE 3 — Role-based bottom navigation
 * Seller: Chat | Bids | Settings (3 tabs)
 * Buyer:  Chat | Bids | Wishlist | Settings (4 tabs)
 */
import { Tabs } from "@/compat/router";
import { Feather } from "@/compat/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";

// Tab screen imports
import ChatScreen from "./chat";
import SettingsScreen from "./settings";

// Lazy-imported screens that only appear conditionally
import IndexScreen from "./index";
import GroupsScreen from "./groups";
import ChannelsScreen from "./channels";
import FriendsScreen from "./friends";

// Dynamic screens based on role
import MyBidsScreenWrapper from "../my-bids";
import SellerBidsScreenWrapper from "../seller-bids";
import WishlistScreenImport from "../wishlist";

function ChatTabIcon({ color }: { color: string }) {
  const { counts } = useData();
  const unread = counts.messages ?? 0;
  return (
    <View>
      <Feather name="message-circle" size={22} color={color} />
      {unread > 0 && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{unread > 99 ? "99+" : String(unread)}</Text>
        </View>
      )}
    </View>
  );
}

function BidsTabIcon({ color }: { color: string }) {
  const { counts } = useData();
  const bids = counts.bids ?? 0;
  return (
    <View>
      <Feather name="tag" size={22} color={color} />
      {bids > 0 && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{bids > 99 ? "99+" : String(bids)}</Text>
        </View>
      )}
    </View>
  );
}

function WishlistTabIcon({ color }: { color: string }) {
  const { counts } = useData();
  const wl = counts.wishlist ?? 0;
  return (
    <View>
      <Feather name="heart" size={22} color={color} />
      {wl > 0 && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{wl > 99 ? "99+" : String(wl)}</Text>
        </View>
      )}
    </View>
  );
}

function SellerTabs() {
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: colors.tabBar,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="chat"
        component={ChatScreen}
        options={{ title: "Chat", tabBarIcon: ({ color }) => <ChatTabIcon color={color} /> }}
      />
      <Tabs.Screen
        name="bids"
        component={SellerBidsScreenWrapper}
        options={{ title: "Bids", tabBarIcon: ({ color }) => <BidsTabIcon color={color} /> }}
      />
      <Tabs.Screen
        name="settings"
        component={SettingsScreen}
        options={{ title: "Settings", tabBarIcon: ({ color }) => <Feather name="settings" size={22} color={color} /> }}
      />
      {/* Hidden tabs — still registered so deep links work */}
      <Tabs.Screen name="index" component={IndexScreen} options={{ tabBarButton: () => null, title: "Home" }} />
      <Tabs.Screen name="groups" component={GroupsScreen} options={{ tabBarButton: () => null, title: "Groups" }} />
      <Tabs.Screen name="channels" component={ChannelsScreen} options={{ tabBarButton: () => null, title: "Channels" }} />
      <Tabs.Screen name="friends" component={FriendsScreen} options={{ tabBarButton: () => null, title: "Friends" }} />
    </Tabs>
  );
}

function BuyerTabs() {
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: colors.tabBar,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="chat"
        component={ChatScreen}
        options={{ title: "Chat", tabBarIcon: ({ color }) => <ChatTabIcon color={color} /> }}
      />
      <Tabs.Screen
        name="bids"
        component={MyBidsScreenWrapper}
        options={{ title: "Bids", tabBarIcon: ({ color }) => <BidsTabIcon color={color} /> }}
      />
      <Tabs.Screen
        name="wishlist-tab"
        component={WishlistScreenImport}
        options={{ title: "Wishlist", tabBarIcon: ({ color }) => <WishlistTabIcon color={color} /> }}
      />
      <Tabs.Screen
        name="settings"
        component={SettingsScreen}
        options={{ title: "Settings", tabBarIcon: ({ color }) => <Feather name="settings" size={22} color={color} /> }}
      />
      {/* Hidden tabs */}
      <Tabs.Screen name="index" component={IndexScreen} options={{ tabBarButton: () => null, title: "Home" }} />
      <Tabs.Screen name="groups" component={GroupsScreen} options={{ tabBarButton: () => null, title: "Groups" }} />
      <Tabs.Screen name="channels" component={ChannelsScreen} options={{ tabBarButton: () => null, title: "Channels" }} />
      <Tabs.Screen name="friends" component={FriendsScreen} options={{ tabBarButton: () => null, title: "Friends" }} />
    </Tabs>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  if (user?.role === "seller") return <SellerTabs />;
  return <BuyerTabs />;
}

const styles = StyleSheet.create({
  countBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  countText: { color: "#fff", fontSize: 9, fontWeight: "700" },
});
