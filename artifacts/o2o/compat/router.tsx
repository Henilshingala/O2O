import React, { createContext, useContext } from "react";
import { 
  createNavigationContainerRef, 
  useNavigation as useReactNavigation,
  useRoute as useReactRoute
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { TouchableOpacity, View, StyleSheet, Text, Platform } from "react-native";

export const navigationRef = createNavigationContainerRef<any>();

function normalizePath(path: string): { screen: string; tabScreen?: string } {
  const cleaned = path.replace(/^\//, ""); // strip leading slash
  if (cleaned.startsWith("(tabs)/")) {
    const tabScreen = cleaned.replace("(tabs)/", "");
    return { screen: "(tabs)", tabScreen };
  }
  if (cleaned === "(tabs)" || cleaned === "") {
    return { screen: "(tabs)", tabScreen: "index" };
  }
  return { screen: cleaned };
}

export const router = {
  push: (target: string | { pathname: string; params?: any }) => {
    if (!navigationRef.isReady()) return;
    const pathname = typeof target === "string" ? target : target.pathname;
    const params = typeof target === "string" ? {} : target.params || {};

    const { screen, tabScreen } = normalizePath(pathname);
    if (screen === "(tabs)") {
      navigationRef.navigate("(tabs)", { screen: tabScreen, params });
    } else {
      navigationRef.navigate(screen, params);
    }
  },
  replace: (target: string | { pathname: string; params?: any }) => {
    if (!navigationRef.isReady()) return;
    const pathname = typeof target === "string" ? target : target.pathname;
    const params = typeof target === "string" ? {} : target.params || {};

    const { screen, tabScreen } = normalizePath(pathname);
    if (screen === "(tabs)") {
      navigationRef.reset({
        index: 0,
        routes: [{ name: "(tabs)", state: { routes: [{ name: tabScreen || "index", params }] } }],
      });
    } else {
      navigationRef.navigate(screen, params);
    }
  },
  back: () => {
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
      navigationRef.goBack();
    }
  },
  setParams: (params: any) => {
    if (navigationRef.isReady()) {
      navigationRef.setParams(params);
    }
  }
};

export function useLocalSearchParams<T extends Record<string, string | undefined>>(): T {
  const route = useReactRoute<any>();
  return (route.params || {}) as T;
}

export function useNavigation() {
  return useReactNavigation();
}

// compatibility components
const NativeStack = createNativeStackNavigator();
export function Stack({ children, screenOptions }: any) {
  return (
    <NativeStack.Navigator screenOptions={{ headerShown: false, ...screenOptions }}>
      {children}
    </NativeStack.Navigator>
  );
}

Stack.Screen = NativeStack.Screen;

const BottomTab = createBottomTabNavigator();
export function Tabs({ children, screenOptions }: any) {
  return (
    <BottomTab.Navigator screenOptions={{ headerShown: false, ...screenOptions }}>
      {children}
    </BottomTab.Navigator>
  );
}

Tabs.Screen = BottomTab.Screen;

export function Link({ href, asChild, children, style, ...props }: any) {
  const handlePress = () => {
    router.push(href);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onPress: (e: any) => {
        const childProps = (children as React.ReactElement<any>).props;
        if (childProps.onPress) childProps.onPress(e);
        handlePress();
      }
    });
  }

  return (
    <TouchableOpacity onPress={handlePress} style={style} {...props}>
      {typeof children === "string" ? <Text>{children}</Text> : children}
    </TouchableOpacity>
  );
}
