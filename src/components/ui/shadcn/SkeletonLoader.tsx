import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { colors } from "../../../theme/colors";

interface SkeletonLoaderProps {
  style?: ViewStyle;
  width?: number | string;
  height?: number;
  borderRadius?: number;
}

export function SkeletonLoader({
  style,
  width = "100%",
  height = 16,
  borderRadius = 4,
}: SkeletonLoaderProps) {
  return (
    <View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
        },
        style,
      ]}
    />
  );
}

// Skeleton for card content
export function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonHeader}>
        <SkeletonLoader width={48} height={48} borderRadius={8} />
        <View style={styles.skeletonTextBlock}>
          <SkeletonLoader width="60%" height={16} />
          <SkeletonLoader width="40%" height={14} style={{ marginTop: 4 }} />
          <SkeletonLoader width="50%" height={12} style={{ marginTop: 4 }} />
        </View>
      </View>
      <View style={styles.skeletonMetrics}>
        <SkeletonLoader width={60} height={12} />
        <SkeletonLoader width={80} height={12} />
      </View>
      <View style={styles.skeletonActions}>
        <SkeletonLoader width={32} height={32} borderRadius={16} />
        <SkeletonLoader width={32} height={32} borderRadius={16} />
        <SkeletonLoader width={32} height={32} borderRadius={16} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.muted.bg,
    opacity: 0.6,
  },
  skeletonCard: {
    borderRadius: 8,
    padding: 24,
    backgroundColor: colors.card.bg,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  skeletonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  skeletonTextBlock: {
    flex: 1,
    gap: 4,
  },
  skeletonMetrics: {
    flexDirection: "row",
    gap: 12,
  },
  skeletonActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
});