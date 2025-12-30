import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors } from '../../theme/colors';

export function SkeletonLoader({ width, height, borderRadius = 8 }: { width: any, height: any, borderRadius?: number }) {
  const opacity = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, opacity }
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.content.border,
  },
});
