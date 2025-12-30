import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors } from "../../../theme/colors";
import { borderRadius } from "../../../theme/borderRadius";
import { shadows } from "../../../theme/shadows";
import { spacing } from "../../../theme/spacing";
import { typography } from "../../../theme/typography";

interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: "left" | "right";
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  children,
  onPress,
  variant = "default",
  size = "default",
  disabled = false,
  loading = false,
  icon,
  iconPosition = "left",
  style,
  textStyle,
}: ButtonProps) {
  const buttonStyle = [
    styles.button,
    styles[variant],
    styles[`size_${size}`],
    disabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text_${variant}`],
    styles[`textSize_${size}`],
    textStyle,
  ];

  const iconSize = size === "sm" ? 14 : size === "lg" ? 20 : 16;
  
  // Get icon color based on variant
  const getIconColor = () => {
    if (variant === "default" || variant === "destructive") {
      return colors.text.inverse;
    }
    return colors.text.primary;
  };

  // Handle button press with haptic feedback
  const handlePress = () => {
    // Provide haptic feedback based on button variant
    if (variant === "destructive") {
      // Stronger feedback for destructive actions
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else if (variant === "default") {
      // Medium feedback for primary actions
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      // Light feedback for secondary actions
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Call the original onPress handler
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        buttonStyle,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={getIconColor()}
        />
      ) : (
        <>
          {icon && iconPosition === "left" ? (
            <Ionicons name={icon} size={iconSize} color={getIconColor()} style={styles.iconLeft} />
          ) : null}
          {typeof children === "string" ? <Text style={textStyles}>{children}</Text> : children}
          {icon && iconPosition === "right" ? (
            <Ionicons name={icon} size={iconSize} color={getIconColor()} style={styles.iconRight} />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  default: {
    backgroundColor: colors.primary,
    ...shadows.md,
  },
  secondary: {
    backgroundColor: colors.muted.bg,
  },
  destructive: {
    backgroundColor: colors.destructive,
    ...shadows.md,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  size_default: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  size_sm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 36,
  },
  size_lg: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.base,
    minHeight: 56,
  },
  size_icon: {
    width: 48,
    height: 48,
    padding: 0,
  },
  text: {
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.sm,
  },
  text_default: {
    color: colors.primaryForeground,
  },
  text_secondary: {
    color: colors.foreground,
  },
  text_destructive: {
    color: colors.destructiveForeground,
  },
  text_outline: {
    color: colors.foreground,
  },
  text_ghost: {
    color: colors.foreground,
  },
  textSize_default: {
    fontSize: typography.fontSize.sm,
  },
  textSize_sm: {
    fontSize: typography.fontSize.xs,
  },
  textSize_lg: {
    fontSize: typography.fontSize.base,
  },
  textSize_icon: {
    fontSize: 0,
  },
  iconLeft: {
    marginRight: spacing.xs,
  },
  iconRight: {
    marginLeft: spacing.xs,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});
