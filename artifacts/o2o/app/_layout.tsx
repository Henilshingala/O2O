import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@/compat/fonts";
import { Stack, navigationRef } from "@/compat/router";
import { NavigationContainer } from "@react-navigation/native";
import React, { useState, useCallback } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { InAppNotificationBanner, type InAppBannerData } from "@/components/InAppNotificationBanner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { FriendsProvider } from "@/context/FriendsContext";
import { SocketProvider } from "@/context/SocketContext";
import { SafeKeyboardProvider } from "@/compat/keyboard-controller";
import { setBaseUrl } from "@workspace/api-client-react";
import { useFCM } from "@/hooks/useFCM";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const API_BASE_URL = "https://o2o-rphb.onrender.com";
setBaseUrl(API_BASE_URL);

// Import all screens
import IndexScreen from "./index";
import WelcomeScreen from "./welcome";
import LoginScreen from "./login";
import SignupScreen from "./signup";
import ForgotPasswordScreen from "./forgot-password";
import VerifyOtpScreen from "./verify-otp";
import ResetPasswordScreen from "./reset-password";
import TabLayout from "./(tabs)/_layout";
import ChatDetailScreen from "./chat/[id]";
import GroupDetailScreen from "./group/[id]";
import GroupCreateScreen from "./group/create";
import GroupCreateDetailsScreen from "./group/create-details";
import GroupInfoScreen from "./group/info";
import ChannelDetailScreen from "./channel/[id]";
import ChannelCreateScreen from "./channel/create";
import ChannelInfoScreen from "./channel/info";
import ChannelPostScreen from "./channel/post";
import ChannelRepostScreen from "./channel/repost";
import ProductDetailScreen from "./product/[id]";
import WishlistScreen from "./wishlist";
import BidCreateScreen from "./bid/create";
import BidSelectSellersScreen from "./bid/select-sellers";
import BidLiveScreen from "./bid/live/[id]";
import BidWinnerScreen from "./bid/winner/[id]";
import BidOfferScreen from "./bid/offer/[id]";
import BidRejectScreen from "./bid/reject/[id]";
import OrderDetailScreen from "./order/[id]";
import ReviewScreen from "./review/[id]";
import AnalyticsScreen from "./analytics";
import MyBidsScreen from "./my-bids";
import MyOrdersScreen from "./my-orders";
import SellerBidsScreen from "./seller-bids";
import NewChatScreen from "./new-chat";
import PeopleSearchScreen from "./people-search";
import NotificationsScreen from "./notifications";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000, gcTime: 5 * 60_000 },
  },
});

// ─── Screen registry ──────────────────────────────────────────────────────────

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index"             component={IndexScreen} />
      <Stack.Screen name="welcome"           component={WelcomeScreen} />
      <Stack.Screen name="login"             component={LoginScreen} />
      <Stack.Screen name="signup"            component={SignupScreen} />
      <Stack.Screen name="forgot-password"   component={ForgotPasswordScreen} />
      <Stack.Screen name="verify-otp"        component={VerifyOtpScreen} />
      <Stack.Screen name="reset-password"    component={ResetPasswordScreen} />
      <Stack.Screen name="(tabs)"            component={TabLayout} />
      <Stack.Screen name="chat/[id]"         component={ChatDetailScreen} />
      <Stack.Screen name="group/[id]"        component={GroupDetailScreen} />
      <Stack.Screen name="group/create"      component={GroupCreateScreen} />
      <Stack.Screen name="group/create-details" component={GroupCreateDetailsScreen} />
      <Stack.Screen name="group/info"        component={GroupInfoScreen} />
      <Stack.Screen name="channel/[id]"      component={ChannelDetailScreen} />
      <Stack.Screen name="channel/create"    component={ChannelCreateScreen} />
      <Stack.Screen name="channel/info"      component={ChannelInfoScreen} />
      <Stack.Screen name="channel/post"      component={ChannelPostScreen} />
      <Stack.Screen name="channel/repost"    component={ChannelRepostScreen} />
      <Stack.Screen name="product/[id]"      component={ProductDetailScreen} />
      <Stack.Screen name="wishlist"          component={WishlistScreen} />
      <Stack.Screen name="bid/create"        component={BidCreateScreen} />
      <Stack.Screen name="bid/select-sellers" component={BidSelectSellersScreen} />
      <Stack.Screen name="bid/live/[id]"     component={BidLiveScreen} />
      <Stack.Screen name="bid/winner/[id]"   component={BidWinnerScreen} />
      <Stack.Screen name="bid/offer/[id]"    component={BidOfferScreen} />
      <Stack.Screen name="bid/reject/[id]"   component={BidRejectScreen} />
      <Stack.Screen name="order/[id]"        component={OrderDetailScreen} />
      <Stack.Screen name="review/[id]"       component={ReviewScreen} />
      <Stack.Screen name="analytics"         component={AnalyticsScreen} />
      <Stack.Screen name="my-bids"           component={MyBidsScreen} />
      <Stack.Screen name="my-orders"         component={MyOrdersScreen} />
      <Stack.Screen name="seller-bids"       component={SellerBidsScreen} />
      <Stack.Screen name="new-chat"          component={NewChatScreen} />
      <Stack.Screen name="people-search"     component={PeopleSearchScreen} />
      <Stack.Screen name="notifications"     component={NotificationsScreen} />
    </Stack>
  );
}

// ─── Navigation deep-link helper ──────────────────────────────────────────────

/**
 * Maps the FCM data `screen` value to a registered React Navigation route.
 * navigationRef must be ready before calling this — always check isReady() first.
 *
 * Screen values (sent by backend in FCM data payload):
 *   chat/[id]      → ChatDetailScreen  (params: id = chatId)
 *   group/[id]     → GroupDetailScreen (params: id = groupId)
 *   bid/live/[id]  → BidLiveScreen     (params: id = bidId)
 *   bid/winner/[id]→ BidWinnerScreen   (params: id = bidId)
 *   order/[id]     → OrderDetailScreen (params: id = orderId)
 *   notifications  → NotificationsScreen
 */
function navigateFromFCM(
  screen: string,
  params?: Record<string, string>,
): void {
  if (!navigationRef.isReady()) {
    console.warn("[FCM] Navigation not ready yet, skipping navigate to:", screen);
    return;
  }
  try {
    if (screen.startsWith("chat/")) {
      navigationRef.navigate("chat/[id]" as never, { id: params?.id ?? params?.chatId } as never);
    } else if (screen.startsWith("group/")) {
      navigationRef.navigate("group/[id]" as never, { id: params?.id ?? params?.groupId } as never);
    } else if (screen.startsWith("bid/live/")) {
      navigationRef.navigate("bid/live/[id]" as never, { id: params?.id ?? params?.bidId } as never);
    } else if (screen.startsWith("bid/winner/")) {
      navigationRef.navigate("bid/winner/[id]" as never, { id: params?.id ?? params?.bidId } as never);
    } else if (screen.startsWith("order/")) {
      navigationRef.navigate("order/[id]" as never, { id: params?.id ?? params?.orderId } as never);
    } else if (screen === "notifications") {
      navigationRef.navigate("notifications" as never);
    } else {
      console.warn("[FCM] Unknown screen in deep-link:", screen);
    }
  } catch (err) {
    console.warn("[FCM] Navigation error:", err);
  }
}

// ─── FCMProvider ──────────────────────────────────────────────────────────────

/**
 * IMPORTANT: FCMProvider is rendered INSIDE NavigationContainer so that
 * navigationRef.isReady() returns true when quit-state notification taps
 * trigger navigation via getInitialNotification().
 *
 * Sits inside AuthProvider so it knows whether the user is logged in.
 * FCM listeners are only registered when `user` is truthy.
 */
function FCMProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [banner, setBanner] = useState<InAppBannerData | null>(null);

  const handleNavigate = useCallback(
    (screen: string, params?: Record<string, string>) => navigateFromFCM(screen, params),
    [],
  );

  const handleSilentMessage = useCallback((_data: Record<string, string>) => {
    // Silent messages (edits, deletes, typing) are handled by Socket.IO listeners.
    // FCM silent push is a no-op in the foreground — the socket already delivered it.
    // Future: could write to local cache / invalidate react-query here.
  }, []);

  useFCM({
    enabled:            !!user,
    onForegroundMessage: (msg) => setBanner(msg),
    onSilentMessage:    handleSilentMessage,
    navigate:           handleNavigate,
  });

  return (
    <>
      {children}
      <InAppNotificationBanner
        notification={banner}
        onDismiss={() => setBanner(null)}
        onPress={(data) => {
          setBanner(null);
          if (data?.screen) handleNavigate(data.screen, data as Record<string, string>);
        }}
      />
    </>
  );
}

// ─── Root layout ──────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <SafeKeyboardProvider statusBarTranslucent>
              <AuthProvider>
                <SocketProvider>
                  <DataProvider>
                    <FriendsProvider>
                      {/*
                        NavigationContainer MUST wrap FCMProvider so that
                        navigationRef.isReady() is true when FCM quit-state
                        taps call getInitialNotification() → navigateFromFCM().
                      */}
                      <NavigationContainer ref={navigationRef}>
                        <FCMProvider>
                          <RootLayoutNav />
                        </FCMProvider>
                      </NavigationContainer>
                    </FriendsProvider>
                  </DataProvider>
                </SocketProvider>
              </AuthProvider>
            </SafeKeyboardProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
