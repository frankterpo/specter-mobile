import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { colors } from "../../../theme/colors";
import { borderRadius } from "../../../theme/borderRadius";
import { spacing } from "../../../theme/spacing";
import { typography } from "../../../theme/typography";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "destructive" | "outline";
  size?: "default" | "sm";
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Badge({
  children,
  variant = "default",
  size = "default",
  style,
  textStyle,
}: BadgeProps) {
  return (
    <View style={[styles.badge, styles[variant], styles[`size_${size}`], style]}>
      {typeof children === "string" || typeof children === "number" ? (
        <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`], textStyle]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius["2xl"],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 20,
  },
  default: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.muted.bg,
  },
  destructive: {
    backgroundColor: colors.destructive,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  success: {
    backgroundColor: colors.success,
  },
  size_default: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 20,
  },
  size_sm: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
    minHeight: 16,
  },
  text: {
    fontWeight: typography.fontWeight.semibold,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  text_success: {
    color: colors.white,
  },
  textSize_default: {
    fontSize: typography.fontSize.xs,
  },
  textSize_sm: {
    fontSize: typography.fontSize["2xs"],
  },
});
