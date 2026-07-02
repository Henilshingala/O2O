import * as ReactNativeWeb from "react-native-web";

export const ActivityIndicator = ReactNativeWeb.ActivityIndicator;
export const Alert = ReactNativeWeb.Alert;
export const Animated = ReactNativeWeb.Animated;
export const Appearance = ReactNativeWeb.Appearance;
export const AppRegistry = ReactNativeWeb.AppRegistry;
export const Button = ReactNativeWeb.Button;
export const Dimensions = ReactNativeWeb.Dimensions;
export const FlatList = ReactNativeWeb.FlatList;
export const Image = ReactNativeWeb.Image;
export const KeyboardAvoidingView = ReactNativeWeb.KeyboardAvoidingView;
export const Linking = ReactNativeWeb.Linking;
export const Modal = ReactNativeWeb.Modal;
export const Platform = ReactNativeWeb.Platform;
export const Pressable = ReactNativeWeb.Pressable;
export const RefreshControl = ReactNativeWeb.RefreshControl;
export const SafeAreaView = ReactNativeWeb.SafeAreaView;
export const ScrollView = ReactNativeWeb.ScrollView;
export const SectionList = ReactNativeWeb.SectionList;
export const StyleSheet = ReactNativeWeb.StyleSheet;
export const Switch = ReactNativeWeb.Switch;
export const Text = ReactNativeWeb.Text;
export const TextInput = ReactNativeWeb.TextInput;
export const TouchableOpacity = ReactNativeWeb.TouchableOpacity;
export const View = ReactNativeWeb.View;
export const useColorScheme = ReactNativeWeb.useColorScheme;
export const useWindowDimensions = ReactNativeWeb.useWindowDimensions;

export * from "react-native-web";
export { ReactNativeWeb as default };

export const PermissionsAndroid = {
  PERMISSIONS: {
    CAMERA: "android.permission.CAMERA",
    ACCESS_FINE_LOCATION: "android.permission.ACCESS_FINE_LOCATION",
  },
  RESULTS: {
    GRANTED: "granted",
    DENIED: "denied",
    BLOCKED: "blocked",
  },
  request: async () => "granted",
  check: async () => "granted",
  checkPermission: async () => "granted",
};

export const PermissionsIOS = {
  PERMISSIONS: {
    CAMERA: "camera",
    LOCATION_WHEN_IN_USE: "locationWhenInUse",
  },
  RESULTS: {
    GRANTED: "granted",
    DENIED: "denied",
    BLOCKED: "blocked",
  },
  request: async () => "granted",
  check: async () => "granted",
  checkPermission: async () => "granted",
};

export const PlatformColor = (...args: unknown[]) => args[0];

export const DeviceEventEmitter = {
  addListener: () => ({ remove: () => undefined }),
  emit: () => undefined,
  removeAllListeners: () => undefined,
};

export class NativeEventEmitter {
  addListener() {
    return { remove: () => undefined };
  }
  removeAllListeners() {
    return undefined;
  }
}
