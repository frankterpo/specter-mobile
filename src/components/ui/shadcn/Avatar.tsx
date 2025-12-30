import React from "react";
import { View, Text, StyleSheet, Image, ViewStyle } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { colors } from "../../../theme/colors";
import { borderRadius } from "../../../theme/borderRadius";
import { typography } from "../../../theme/typography";

interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: number;
  style?: ViewStyle;
}

export function Avatar({ src, alt, fallback, size = 40, style }: AvatarProps) {
  const initials = fallback
    ? fallback
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: borderRadius.full }, style]}>
      {src ? (
        <ExpoImage
          source={{
            uri: src,
            // Enable caching for better performance
            cacheKey: `avatar-${src.split('/').pop()}`,
          }}
          style={[styles.image, { width: size, height: size, borderRadius: borderRadius.full }]}
          contentFit="cover"
          // Enable disk caching for better performance
          cachePolicy="disk"
          // Smooth transition for loading
          transition={200}
        />
      ) : (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: borderRadius.full }]}>
          <Text style={[styles.fallbackText, { fontSize: size * 0.35 }]}>{initials}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: colors.muted.bg,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  fallback: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    color: colors.primaryForeground,
    fontWeight: typography.fontWeight.semibold,
  },
});
