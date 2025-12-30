import React from 'react';
import { StyleSheet, Pressable, Text, ViewStyle, TextStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../theme';
import * as Haptics from 'expo-haptics';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring 
} from 'react-native-reanimated';

interface GlassButtonProps {
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  variant?: 'primary' | 'ghost' | 'destructive';
  style?: ViewStyle;
}

export const GlassButton = ({ 
  onPress, 
  icon, 
  label, 
  variant = 'ghost',
  style
}: GlassButtonProps) => {
  const { colors } = theme;
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
    opacity.value = withSpring(0.8);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    opacity.value = withSpring(1);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          blur: { borderColor: colors.primary },
          text: { color: colors.white },
          icon: colors.white,
          bg: colors.primary + '20'
        };
      case 'destructive':
        return {
          blur: { borderColor: colors.destructive },
          text: { color: colors.destructive },
          icon: colors.destructive,
          bg: colors.destructive + '10'
        };
      default:
        return {
          blur: { borderColor: 'rgba(255,255,255,0.3)' },
          text: { color: colors.text.primary },
          icon: colors.text.primary,
          bg: 'rgba(255,255,255,0.1)'
        };
    }
  };

  const v = getVariantStyles();

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable 
        onPress={onPress} 
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.pressable}
      >
        <BlurView intensity={20} style={[styles.blur, v.blur, { backgroundColor: v.bg }]}>
          {icon && <Ionicons name={icon} size={20} color={v.icon} />}
          {label && <Text style={[styles.label, v.text]}>{label}</Text>}
        </BlurView>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  blur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
});
