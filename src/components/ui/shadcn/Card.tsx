import React from "react";
import { View, ViewStyle, StyleSheet, Pressable, PressableProps } from "react-native";
import { colors } from "../../../theme/colors";
import { borderRadius } from "../../../theme/borderRadius";
import { shadows } from "../../../theme/shadows";
import { spacing } from "../../../theme/spacing";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  variant?: "default" | "outline" | "ghost";
}

export function Card({ children, style, onPress, variant = "default" }: CardProps) {
  const cardStyle = [
    styles.card,
    variant === "outline" && styles.outline,
    variant === "ghost" && styles.ghost,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          pressed && styles.pressed,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card.bg,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.card.border,
    ...shadows.md,
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    borderWidth: 0,
    backgroundColor: "transparent",
    ...shadows.sm,
  },
  pressed: {
    opacity: 0.9,
  },
  header: {
    marginBottom: spacing.sm,
  },
  content: {
    gap: spacing.sm,
  },
  footer: {
    marginTop: spacing.xl,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});

Card.Header = function CardHeader({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.header, style]}>{children}</View>;
};

Card.Content = function CardContent({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.content, style]}>{children}</View>;
};

Card.Footer = function CardFooter({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.footer, style]}>{children}</View>;
};
