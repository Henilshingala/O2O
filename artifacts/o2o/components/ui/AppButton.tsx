import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface AppButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary" | "outline" | "destructive" | "ghost";
  loading?: boolean;
  size?: "sm" | "md" | "lg";
}

export function AppButton({
  title,
  variant = "primary",
  loading = false,
  size = "md",
  style,
  disabled,
  ...props
}: AppButtonProps) {
  const colors = useColors();

  const bgMap = {
    primary: colors.primary,
    secondary: colors.secondary,
    outline: "transparent",
    destructive: colors.destructive,
    ghost: "transparent",
  };
  const fgMap = {
    primary: colors.primaryForeground,
    secondary: colors.secondaryForeground,
    outline: colors.primary,
    destructive: colors.destructiveForeground,
    ghost: colors.foreground,
  };
  const borderMap = {
    primary: "transparent",
    secondary: "transparent",
    outline: colors.primary,
    destructive: "transparent",
    ghost: "transparent",
  };
  const heightMap = { sm: 36, md: 48, lg: 54 };
  const fontMap = { sm: 13, md: 15, lg: 16 };

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={isDisabled}
      style={[
        styles.btn,
        {
          backgroundColor: bgMap[variant],
          borderColor: borderMap[variant],
          borderWidth: variant === "outline" ? 1.5 : 0,
          height: heightMap[size],
          opacity: isDisabled ? 0.55 : 1,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={fgMap[variant]} size="small" />
      ) : (
        <Text
          style={[
            styles.label,
            { color: fgMap[variant], fontSize: fontMap[size] },
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  label: { fontWeight: "700", letterSpacing: 0.3 },
});
