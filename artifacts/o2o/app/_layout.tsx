import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@/compat/fonts";
import { Stack, navigationRef } from "@/compat/router";
import { NavigationContainer } from "@react-navigation/native";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { FriendsProvider } from "@/context/FriendsContext";
import { SocketProvider } from "@/context/SocketContext";
import { API_URL } from "@env";
import { setBaseUrl } from "@workspace/api-client-react";

// Configure the base URL for the API client
const API_BASE_URL = API_URL || (__DEV__ ? "http://127.0.0.1:5000" : "http://192.168.0.101:5000");
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
import ChannelDetailScreen from "./channel/[id]";
import ChannelCreateScreen from "./channel/create";
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

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" component={IndexScreen} />
      <Stack.Screen name="welcome" component={WelcomeScreen} />
      <Stack.Screen name="login" component={LoginScreen} />
      <Stack.Screen name="signup" component={SignupScreen} />
      <Stack.Screen name="forgot-password" component={ForgotPasswordScreen} />
      <Stack.Screen name="verify-otp" component={VerifyOtpScreen} />
      <Stack.Screen name="reset-password" component={ResetPasswordScreen} />
      <Stack.Screen name="(tabs)" component={TabLayout} />
      <Stack.Screen name="chat/[id]" component={ChatDetailScreen} />
      <Stack.Screen name="group/[id]" component={GroupDetailScreen} />
      <Stack.Screen name="group/create" component={GroupCreateScreen} />
      <Stack.Screen name="group/create-details" component={GroupCreateDetailsScreen} />
      <Stack.Screen name="channel/[id]" component={ChannelDetailScreen} />
      <Stack.Screen name="channel/create" component={ChannelCreateScreen} />
      <Stack.Screen name="channel/post" component={ChannelPostScreen} />
      <Stack.Screen name="channel/repost" component={ChannelRepostScreen} />
      <Stack.Screen name="product/[id]" component={ProductDetailScreen} />
      <Stack.Screen name="wishlist" component={WishlistScreen} />
      <Stack.Screen name="bid/create" component={BidCreateScreen} />
      <Stack.Screen name="bid/select-sellers" component={BidSelectSellersScreen} />
      <Stack.Screen name="bid/live/[id]" component={BidLiveScreen} />
      <Stack.Screen name="bid/winner/[id]" component={BidWinnerScreen} />
      <Stack.Screen name="bid/offer/[id]" component={BidOfferScreen} />
      <Stack.Screen name="bid/reject/[id]" component={BidRejectScreen} />
      <Stack.Screen name="order/[id]" component={OrderDetailScreen} />
      <Stack.Screen name="review/[id]" component={ReviewScreen} />
      <Stack.Screen name="analytics" component={AnalyticsScreen} />
      <Stack.Screen name="my-bids" component={MyBidsScreen} />
      <Stack.Screen name="my-orders" component={MyOrdersScreen} />
      <Stack.Screen name="seller-bids" component={SellerBidsScreen} />
      <Stack.Screen name="new-chat" component={NewChatScreen} />
      <Stack.Screen name="people-search" component={PeopleSearchScreen} />
      <Stack.Screen name="notifications" component={NotificationsScreen} />
    </Stack>
  );
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <DataProvider>
              <FriendsProvider>
              <SocketProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <NavigationContainer ref={navigationRef}>
                    <RootLayoutNav />
                  </NavigationContainer>
                </KeyboardProvider>
              </GestureHandlerRootView>
              </SocketProvider>
              </FriendsProvider>
            </DataProvider>
          </QueryClientProvider>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
