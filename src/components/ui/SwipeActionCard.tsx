import React, { useMemo, useRef } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { theme } from "../../theme";

const SWIPE_THRESHOLD = 80;
const MAX_TRANSLATE = 120;

interface SwipeActionCardProps {
  children: React.ReactNode;
  onLike?: () => void;
  onDislike?: () => void;
  enabled?: boolean;
  style?: ViewStyle;
  likeLabel?: string;
  dislikeLabel?: string;
}

export const SwipeActionCard = ({
  children,
  onLike,
  onDislike,
  enabled = true,
  style,
  likeLabel = "Like",
  dislikeLabel = "Pass",
}: SwipeActionCardProps) => {
  const { colors } = theme;
  const translateX = useRef(new Animated.Value(0)).current;
  const swipeEnabled = enabled && (!!onLike || !!onDislike);

  const likeOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const dislikeOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const resetPosition = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: false,
      tension: 140,
      friction: 16,
    }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          if (!swipeEnabled) return false;
          const { dx, dy } = gesture;
          return Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy);
        },
        onPanResponderMove: (_, gesture) => {
          const clamped = Math.max(-MAX_TRANSLATE, Math.min(MAX_TRANSLATE, gesture.dx));
          translateX.setValue(clamped);
        },
        onPanResponderRelease: (_, gesture) => {
          const { dx } = gesture;
          const shouldLike = dx > SWIPE_THRESHOLD;
          const shouldDislike = dx < -SWIPE_THRESHOLD;

          if (shouldLike && onLike) {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            onLike();
          } else if (shouldDislike && onDislike) {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            onDislike();
          }

          resetPosition();
        },
        onPanResponderTerminate: resetPosition,
      }),
    [onLike, onDislike, swipeEnabled, translateX]
  );

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.actionLayer,
          styles.likeLayer,
          { backgroundColor: colors.success + "26", opacity: likeOpacity },
        ]}
      >
        <View style={[styles.actionPill, { borderColor: colors.success }]}>
          <Ionicons name="heart" size={16} color={colors.success} />
          <Text style={[styles.actionText, { color: colors.success }]}>{likeLabel}</Text>
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.actionLayer,
          styles.dislikeLayer,
          { backgroundColor: colors.destructive + "26", opacity: dislikeOpacity },
        ]}
      >
        <View style={[styles.actionPill, { borderColor: colors.destructive }]}>
          <Ionicons name="close" size={16} color={colors.destructive} />
          <Text style={[styles.actionText, { color: colors.destructive }]}>{dislikeLabel}</Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.card, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: "hidden",
  },
  card: {
    zIndex: 2,
  },
  actionLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  likeLayer: {
    alignItems: "flex-start",
  },
  dislikeLayer: {
    alignItems: "flex-end",
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  actionText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
