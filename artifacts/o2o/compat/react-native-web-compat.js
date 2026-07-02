const ReactNativeWeb = require('react-native-web');

const compat = {
  ...ReactNativeWeb,
  ActivityIndicator: ReactNativeWeb.ActivityIndicator,
  Alert: ReactNativeWeb.Alert,
  Animated: ReactNativeWeb.Animated,
  Appearance: ReactNativeWeb.Appearance,
  AppRegistry: ReactNativeWeb.AppRegistry,
  Button: ReactNativeWeb.Button,
  Dimensions: ReactNativeWeb.Dimensions,
  FlatList: ReactNativeWeb.FlatList,
  Image: ReactNativeWeb.Image,
  KeyboardAvoidingView: ReactNativeWeb.KeyboardAvoidingView,
  Linking: ReactNativeWeb.Linking,
  Modal: ReactNativeWeb.Modal,
  Platform: ReactNativeWeb.Platform,
  Pressable: ReactNativeWeb.Pressable,
  RefreshControl: ReactNativeWeb.RefreshControl,
  SafeAreaView: ReactNativeWeb.SafeAreaView,
  ScrollView: ReactNativeWeb.ScrollView,
  SectionList: ReactNativeWeb.SectionList,
  StyleSheet: ReactNativeWeb.StyleSheet,
  Switch: ReactNativeWeb.Switch,
  Text: ReactNativeWeb.Text,
  TextInput: ReactNativeWeb.TextInput,
  TouchableOpacity: ReactNativeWeb.TouchableOpacity,
  View: ReactNativeWeb.View,
  useColorScheme: ReactNativeWeb.useColorScheme,
  useWindowDimensions: ReactNativeWeb.useWindowDimensions,
  PermissionsAndroid: {
    PERMISSIONS: {
      CAMERA: 'android.permission.CAMERA',
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      BLOCKED: 'blocked',
    },
    request: async () => 'granted',
    check: async () => 'granted',
    checkPermission: async () => 'granted',
  },
  PermissionsIOS: {
    PERMISSIONS: {
      CAMERA: 'camera',
      LOCATION_WHEN_IN_USE: 'locationWhenInUse',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      BLOCKED: 'blocked',
    },
    request: async () => 'granted',
    check: async () => 'granted',
    checkPermission: async () => 'granted',
  },
  PlatformColor: (...args) => args[0],
  DeviceEventEmitter: {
    addListener: () => ({ remove: () => undefined }),
    emit: () => undefined,
    removeAllListeners: () => undefined,
  },
  NativeEventEmitter: class NativeEventEmitter {
    addListener() {
      return { remove: () => undefined };
    }
    removeAllListeners() {
      return undefined;
    }
  },
};

module.exports = compat;
module.exports.default = compat;
