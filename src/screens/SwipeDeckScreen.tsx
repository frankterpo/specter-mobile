import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { colors } from "../theme/colors";
import { useSignals } from "../hooks/useSignals";
import { useLikeMutation } from "../hooks/useMutations";
import { useGamificationStore } from "../stores/gamificationStore";
import { typography } from "../theme/typography";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.4;
const ROTATION_ANGLE = 15;

export default function SwipeDeckScreen() {
  const insets = useSafeAreaInsets();
  const { data, fetchNextPage, hasNextPage, isLoading } = useSignals('PEOPLE');
  const likeMutation = useLikeMutation();
  const { addXP, incrementMission } = useGamificationStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const people = useMemo(() => 
    data?.pages.flatMap(page => page.items) || [], 
  [data]);

  const handleSwipe = async (direction: "left" | "right") => {
    const person = people[currentIndex];
    if (!person) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (direction === "right") {
      likeMutation.mutate({ id: person.id, type: 'people' });
      addXP(3);
      incrementMission('like_entities');
    } else {
      addXP(1);
    }

    incrementMission('view_people');
    setCurrentIndex(prev => prev + 1);

    if (currentIndex >= people.length - 5 && hasNextPage) {
      fetchNextPage();
    }

    translateX.value = 0;
    translateY.value = 0;
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        const direction = e.translationX > 0 ? "right" : "left";
        translateX.value = withTiming(
          e.translationX > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH,
          { duration: 200 },
          () => runOnJS(handleSwipe)(direction)
        );
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-ROTATION_ANGLE, 0, ROTATION_ANGLE]
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const currentPerson = people[currentIndex];

  if (isLoading && people.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!currentPerson) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No more candidates</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Focus Mode</Text>
      </View>

      <View style={styles.cardContainer}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.card, cardAnimatedStyle]}>
            <Image
              source={{ uri: currentPerson.profile_image_url }}
              style={styles.avatar}
              contentFit="cover"
            />
            <View style={styles.info}>
              <Text style={styles.name}>{currentPerson.full_name}</Text>
              <Text style={styles.title}>{currentPerson.tagline}</Text>
              <Text style={styles.location}>{currentPerson.location}</Text>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={styles.footer}>
        <Pressable style={[styles.btn, styles.btnNope]} onPress={() => handleSwipe('left')}>
          <Ionicons name="close" size={32} color={colors.error} />
        </Pressable>
        <Pressable style={[styles.btn, styles.btnLike]} onPress={() => handleSwipe('right')}>
          <Ionicons name="heart" size={32} color={colors.success} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_HEIGHT * 0.6,
    backgroundColor: colors.content.bg,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.content.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  avatar: {
    width: '100%',
    height: '70%',
  },
  info: {
    padding: 20,
  },
  name: {
    ...typography.h3,
    color: colors.text.primary,
  },
  title: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    marginTop: 4,
  },
  location: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    paddingBottom: 40,
  },
  btn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.content.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.content.border,
  },
  btnNope: {
    borderColor: colors.error + '40',
  },
  btnLike: {
    borderColor: colors.success + '40',
  },
  emptyText: {
    ...typography.bodyLarge,
    color: colors.text.tertiary,
  }
});
