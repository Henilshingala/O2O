import * as ReactNativeWeb from 'react-native-web';

export * from 'react-native-web';

export const PermissionsAndroid = {
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
};

export const PermissionsIOS = {
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
};

export const PlatformColor = (...args) => args[0];

export class NativeEventEmitter {
  addListener() {
    return { remove: () => undefined };
  }
  removeAllListeners() {
    return undefined;
  }
}

export default ReactNativeWeb;
