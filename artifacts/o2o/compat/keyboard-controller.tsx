import React from "react";
import {
  KeyboardAvoidingView as RNKeyboardAvoidingView,
  NativeModules,
  type ViewStyle,
  type StyleProp,
} from "react-native";

type KeyboardProviderProps = { children: React.ReactNode; statusBarTranslucent?: boolean };
type KeyboardAvoidingProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  behavior?: "padding" | "height" | "position";
  keyboardVerticalOffset?: number;
};

function isKeyboardControllerLinked(): boolean {
  const modules = NativeModules as Record<string, unknown>;
  return !!(modules.KeyboardController ?? modules.RNKCKeyboardController);
}

let nativeModule: {
  KeyboardProvider: React.ComponentType<KeyboardProviderProps>;
  KeyboardAvoidingView: React.ComponentType<KeyboardAvoidingProps>;
} | null = null;

if (isKeyboardControllerLinked()) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    nativeModule = require("react-native-keyboard-controller");
  } catch {
    nativeModule = null;
  }
}

export function SafeKeyboardProvider({ children, statusBarTranslucent }: KeyboardProviderProps) {
  const Provider = nativeModule?.KeyboardProvider;
  if (Provider) {
    return <Provider statusBarTranslucent={statusBarTranslucent}>{children}</Provider>;
  }
  return <>{children}</>;
}

export function SafeKeyboardAvoidingView({
  children,
  style,
  behavior = "padding",
  keyboardVerticalOffset = 0,
}: KeyboardAvoidingProps) {
  const NativeKAV = nativeModule?.KeyboardAvoidingView;
  if (NativeKAV) {
    return (
      <NativeKAV
        style={style}
        behavior={behavior}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {children}
      </NativeKAV>
    );
  }

  return (
    <RNKeyboardAvoidingView
      style={style}
      behavior={behavior}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </RNKeyboardAvoidingView>
  );
}
