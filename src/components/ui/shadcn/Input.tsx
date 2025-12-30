import React, { forwardRef } from "react";
import { View, TextInput, Text, StyleSheet, ViewStyle, TextInputProps, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";
import { borderRadius } from "../../../theme/borderRadius";
import { shadows } from "../../../theme/shadows";
import { spacing } from "../../../theme/spacing";
import { typography } from "../../../theme/typography";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, InputProps>(({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  style,
  ...props
}, ref) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputContainer, error ? styles.inputError : null]}>
        {leftIcon ? (
          <Ionicons name={leftIcon} size={18} color={colors.text.tertiary} style={styles.leftIcon} />
        ) : null}
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={colors.text.tertiary}
          {...props}
        />
        {rightIcon ? (
          <Pressable onPress={onRightIconPress} hitSlop={8}>
            <Ionicons
              name={rightIcon}
              size={18}
              color={colors.text.tertiary}
              style={styles.rightIcon}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

Input.displayName = "Input";

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.foreground,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card.bg,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    ...shadows.sm,
  },
  inputError: {
    borderColor: colors.destructive,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.foreground,
    paddingVertical: spacing.xs + 2, // 10px
  },
  leftIcon: {
    marginRight: spacing.sm,
  },
  rightIcon: {
    marginLeft: spacing.sm,
  },
  error: {
    fontSize: typography.fontSize.xs,
    color: colors.destructive,
    marginTop: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
});
