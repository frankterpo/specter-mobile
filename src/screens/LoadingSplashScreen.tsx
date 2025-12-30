import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  runOnJS,
  withDelay,
  withSequence,
  interpolate,
  Easing
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { Image } from 'expo-image';

const { width, height } = Dimensions.get('window');

interface LoadingSplashScreenProps {
  onAnimationComplete: () => void;
}

export default function LoadingSplashScreen({ onAnimationComplete }: LoadingSplashScreenProps) {
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    console.log('🎬 [Splash] Starting animation...');
    
    // 1. Initial entrance: scale up and fade in with spring
    scale.value = withSpring(1, { damping: 15, stiffness: 100 });
    opacity.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.quad) });
    translateY.value = withSpring(0, { damping: 15 });
    
    // 2. Subtle ambient glow pulse
    glowOpacity.value = withDelay(400, 
      withSequence(
        withTiming(0.6, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.sin) })
      )
    );

    // 3. Final fade out and complete - with fallback for web
    const timeout = setTimeout(() => {
      console.log('🎬 [Splash] Starting fade out...');
      opacity.value = withTiming(0, { 
        duration: 800, 
        easing: Easing.in(Easing.quad) 
      }, (finished) => {
        console.log('🎬 [Splash] Fade finished:', finished);
        if (finished) runOnJS(onAnimationComplete)();
      });
    }, 2800);

    // FALLBACK: On web, reanimated callbacks can sometimes fail. 
    // Force completion after a maximum time.
    const fallbackTimeout = setTimeout(() => {
      console.log('🎬 [Splash] Fallback timeout - forcing completion');
      onAnimationComplete();
    }, 4500);

    return () => {
      clearTimeout(timeout);
      clearTimeout(fallbackTimeout);
    };
  }, [onAnimationComplete, scale, opacity, glowOpacity, translateY]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value }
    ],
    opacity: opacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: interpolate(glowOpacity.value, [0, 0.6], [0.8, 1.2]) }]
  }));

  return (
    <View style={styles.container}>
      {/* Sophisticated radial-like gradient background */}
      <LinearGradient
        colors={["#1e293b", "#0f172a", "#020617"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Ambient soft glow background */}
      <Animated.View style={[styles.glowContainer, glowStyle]}>
        <LinearGradient
          colors={["rgba(74, 98, 255, 0.15)", "transparent"]}
          style={styles.glowGradient}
        />
      </Animated.View>

      <Animated.View style={[styles.logoWrapper, logoStyle]}>
        <View style={styles.shadowContainer}>
          <Image
            source={require('../../assets/App Icon - White on Blue.svg')}
            style={styles.logo}
            contentFit="contain"
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617',
  },
  glowContainer: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowGradient: {
    width: '100%',
    height: '100%',
    borderRadius: width * 0.4,
  },
  logoWrapper: {
    width: width * 0.28, // Smaller, more refined size
    height: width * 0.28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  shadowContainer: {
    width: '100%',
    height: '100%',
    ...Platform.select({
      ios: {
        shadowColor: "#4a62ff",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
      },
      android: {
        elevation: 15,
      },
      web: {
        filter: `drop-shadow(0px 12px 20px rgba(74, 98, 255, 0.4))`
      }
    }),
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 20, // Matches standard app icon curvature
  },
});
