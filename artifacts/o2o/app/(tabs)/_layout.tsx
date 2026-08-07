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

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TouchableOpacity } from "react-native";

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const visibleRoutes = state.routes.filter((route: any) => {
    const { options } = descriptors[route.key];
    // We explicitly mark hidden tabs with tabBarItemStyle: { display: 'none' }
    return options.tabBarItemStyle?.display !== 'none';
  });

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: insets.bottom || 12, backgroundColor: colors.tabBar, borderTopColor: colors.border }]}>
      {visibleRoutes.map((route: any) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === state.routes.findIndex((r: any) => r.key === route.key);
        const color = isFocused ? colors.primary : colors.mutedForeground;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            style={styles.tabItem}
          >
            <View style={styles.tabItemInner}>
              {options.tabBarIcon && options.tabBarIcon({ color, focused: isFocused, size: 24 })}
              <Text style={[styles.tabLabel, { color }]}>
                {label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SellerTabs() {
  const colors = useColors();
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        component={IndexScreen}
        options={{ title: "Chats", tabBarIcon: ({ color }) => <ChatTabIcon color={color} /> }}
      />
      <Tabs.Screen
        name="bids"
        component={SellerBidsScreenWrapper}
        options={{ title: "Bids", tabBarIcon: ({ color }) => <BidsTabIcon color={color} /> }}
      />
      <Tabs.Screen
        name="settings"
        component={SettingsScreen}
        options={{ title: "Settings", tabBarIcon: ({ color }) => <Feather name="settings" size={24} color={color} /> }}
      />
      {/* Hidden tabs */}
      <Tabs.Screen name="chat" component={ChatScreen} options={{ tabBarItemStyle: { display: "none" } }} />
      <Tabs.Screen name="groups" component={GroupsScreen} options={{ tabBarItemStyle: { display: "none" } }} />
      <Tabs.Screen name="channels" component={ChannelsScreen} options={{ tabBarItemStyle: { display: "none" } }} />
      <Tabs.Screen name="friends" component={FriendsScreen} options={{ tabBarItemStyle: { display: "none" } }} />
    </Tabs>
  );
}

function BuyerTabs() {
  const colors = useColors();
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        component={IndexScreen}
        options={{ title: "Chats", tabBarIcon: ({ color }) => <ChatTabIcon color={color} /> }}
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
        options={{ title: "Settings", tabBarIcon: ({ color }) => <Feather name="settings" size={24} color={color} /> }}
      />
      {/* Hidden tabs */}
      <Tabs.Screen name="chat" component={ChatScreen} options={{ tabBarItemStyle: { display: "none" } }} />
      <Tabs.Screen name="groups" component={GroupsScreen} options={{ tabBarItemStyle: { display: "none" } }} />
      <Tabs.Screen name="channels" component={ChannelsScreen} options={{ tabBarItemStyle: { display: "none" } }} />
      <Tabs.Screen name="friends" component={FriendsScreen} options={{ tabBarItemStyle: { display: "none" } }} />
    </Tabs>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  if (user?.role === "seller") return <SellerTabs />;
  return <BuyerTabs />;
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: "row",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabItemInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
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
