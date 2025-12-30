import React, { useState } from 'react';
import { StyleSheet, View, TextInput, TextInputProps, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../theme';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming 
} from 'react-native-reanimated';

interface GlassInputProps extends TextInputProps {
  icon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: ViewStyle;
}

export const GlassInput = ({ icon, containerStyle, ...props }: GlassInputProps) => {
  const { colors } = theme;
  const focused = useSharedValue(0);
  const [isFocused, setIsFocused] = useState(false);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: focused.value ? colors.primary : 'rgba(255,255,255,0.2)',
    backgroundColor: focused.value ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
  }));

  const iconColor = isFocused ? colors.primary : colors.text.tertiary;

  return (
    <Animated.View style={[styles.container, animatedStyle, containerStyle]}>
      <BlurView intensity={15} style={styles.blur}>
        {icon && (
          <Ionicons 
            name={icon} 
            size={20} 
            color={iconColor} 
            style={styles.icon} 
          />
        )}
        <TextInput
          {...props}
          style={[styles.input, { color: colors.text.primary }]}
          placeholderTextColor={colors.text.tertiary}
          onFocus={(e) => {
            focused.value = withTiming(1);
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            focused.value = withTiming(0);
            setIsFocused(false);
            props.onBlur?.(e);
          }}
        />
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  blur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 52,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
});
