import { StyleSheet, View, Pressable, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '../../../theme';

interface GlassCardProps {
  children: React.ReactNode;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  onPress?: () => void;
  style?: ViewStyle;
}

export const GlassCard = ({ 
  children, 
  intensity = 25, 
  tint = 'light',
  onPress,
  style
}: GlassCardProps) => {
  const content = (
    <Pressable onPress={onPress} style={[styles.pressable, style]}>
      <BlurView intensity={intensity} tint={tint} style={styles.blur}>
        <LinearGradient
          colors={tint === 'light' 
            ? ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']
            : ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.1)']}
          style={styles.gradient}
        >
          {children}
        </LinearGradient>
      </BlurView>
    </Pressable>
  );

  if (Platform.OS === 'web') {
    return content;
  }

  return (
    <Animated.View entering={FadeInDown.duration(400).springify()}>
      {content}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 24,
    overflow: 'hidden',
    marginVertical: 8,
  },
  blur: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  gradient: {
    padding: 20,
  },
});
