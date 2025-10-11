import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@clerk/clerk-expo";
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
import {
  fetchPeople,
  likePerson,
  dislikePerson,
  markAsViewed,
  Person,
  getCurrentJob,
  getFullName,
  getInitials,
  formatHighlight,
  getHighlightColor,
  calculateAge,
} from "../api/specter";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.4;
const ROTATION_ANGLE = 15;

type MainStackParamList = {
  SwipeDeck: undefined;
  PersonDetail: { personId: string };
  Settings: undefined;
};

type SwipeDeckScreenProps = {
  navigation: NativeStackNavigationProp<MainStackParamList, "SwipeDeck">;
};

export default function SwipeDeckScreen({ navigation }: SwipeDeckScreenProps) {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();

  const [cards, setCards] = useState<Person[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const LIMIT = 10;

  useEffect(() => {
    loadPeople(0);
  }, []);

  useEffect(() => {
    if (currentIndex >= cards.length - 5 && !isLoadingMore) {
      loadMorePeople();
    }
  }, [currentIndex]);

  const loadPeople = async (newOffset: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const response = await fetchPeople(token, {
        limit: LIMIT,
        offset: newOffset,
      });

      setCards(response.items);
      setOffset(newOffset);
      setCurrentIndex(0);
    } catch (err: any) {
      setError(err.message || "Failed to load people");
      console.error("Load people error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMorePeople = async () => {
    if (isLoadingMore) return;
    
    setIsLoadingMore(true);

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetchPeople(token, {
        limit: LIMIT,
        offset: offset + LIMIT,
      });

      setCards((prev) => [...prev, ...response.items]);
      setOffset(offset + LIMIT);
    } catch (err: any) {
      console.error("Load more error:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleLike = async (person: Person) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const token = await getToken();
      if (token) {
        await likePerson(token, person.id);
      }
    } catch (err) {
      console.error("Like error:", err);
    }

    setCurrentIndex((prev) => prev + 1);
  };

  const handleDislike = async (person: Person) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const token = await getToken();
      if (token) {
        await dislikePerson(token, person.id);
      }
    } catch (err) {
      console.error("Dislike error:", err);
    }

    setCurrentIndex((prev) => prev + 1);
  };

  const handleViewProfile = async (person: Person) => {
    try {
      const token = await getToken();
      if (token) {
        await markAsViewed(token, person.id);
      }
    } catch (err) {
      console.error("Mark viewed error:", err);
    }

    navigation.navigate("PersonDetail", { personId: person.id });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#1a365d" />
        <Text style={styles.loadingText}>Loading profiles...</Text>
      </View>
    );
  }

  if (error || cards.length === 0 || currentIndex >= cards.length) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.logo}>Specter</Text>
          <View style={styles.headerRight}>
            <Pressable onPress={() => navigation.navigate("Settings")} style={styles.iconButton}>
              <Ionicons name="settings-outline" size={24} color="#1a365d" />
            </Pressable>
          </View>
        </View>

        <View style={styles.centerContent}>
          <Ionicons name="people-outline" size={80} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No More Profiles</Text>
          <Text style={styles.emptySubtitle}>
            {error || "Check back later for new people to review"}
          </Text>
          <Pressable onPress={() => loadPeople(0)} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Refresh</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.logo}>Specter</Text>
        <View style={styles.headerRight}>
          <Pressable onPress={() => navigation.navigate("Settings")} style={styles.iconButton}>
            <Ionicons name="settings-outline" size={24} color="#1a365d" />
          </Pressable>
        </View>
      </View>

      <View style={styles.cardContainer}>
        {cards
          .slice(currentIndex, currentIndex + 3)
          .reverse()
          .map((person, index) => {
            const reverseIndex = 2 - index;
            const isTop = reverseIndex === 0;
            
            return (
              <SwipeCard
                key={person.id}
                person={person}
                index={reverseIndex}
                isTop={isTop}
                onLike={() => handleLike(person)}
                onDislike={() => handleDislike(person)}
                onViewProfile={() => handleViewProfile(person)}
              />
            );
          })}
      </View>

      <View style={[styles.actionButtons, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.mainActions}>
          <Pressable
            onPress={() => {
              if (cards[currentIndex]) handleDislike(cards[currentIndex]);
            }}
            style={styles.actionCircle}
          >
            <View style={[styles.circle, styles.dislikeCircle]}>
              <Ionicons name="close" size={32} color="white" />
            </View>
            <Text style={styles.actionLabel}>NOPE</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (cards[currentIndex]) handleViewProfile(cards[currentIndex]);
            }}
            style={styles.actionCircle}
          >
            <View style={[styles.circle, styles.infoCircle]}>
              <Ionicons name="information" size={32} color="white" />
            </View>
            <Text style={styles.actionLabel}>INFO</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (cards[currentIndex]) handleLike(cards[currentIndex]);
            }}
            style={styles.actionCircle}
          >
            <View style={[styles.circle, styles.likeCircle]}>
              <Ionicons name="heart" size={32} color="white" />
            </View>
            <Text style={styles.actionLabel}>LIKE</Text>
          </Pressable>
        </View>
      </View>

      {isLoadingMore && (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color="#1a365d" />
          <Text style={styles.loadingMoreText}>Loading more...</Text>
        </View>
      )}
    </View>
  );
}

type SwipeCardProps = {
  person: Person;
  index: number;
  isTop: boolean;
  onLike: () => void;
  onDislike: () => void;
  onViewProfile: () => void;
};

function SwipeCard({ person, index, isTop, onLike, onDislike, onViewProfile }: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const currentJob = getCurrentJob(person.experience);
  const fullName = getFullName(person);
  const initials = getInitials(person);
  const age = calculateAge(person.years_of_experience);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (!isTop) return;
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      if (!isTop) return;

      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        const direction = event.translationX > 0 ? 1 : -1;
        translateX.value = withTiming(direction * SCREEN_WIDTH * 1.5, { duration: 300 });
        
        if (direction > 0) {
          runOnJS(onLike)();
        } else {
          runOnJS(onDislike)();
        }
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-ROTATION_ANGLE, 0, ROTATION_ANGLE]
    );

    const scale = interpolate(index, [0, 1, 2], [1, 0.95, 0.9]);
    const translateYValue = interpolate(index, [0, 1, 2], [0, 10, 20]);

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: isTop ? translateY.value : translateYValue },
        { rotate: `${rotate}deg` },
        { scale },
      ],
      zIndex: 3 - index,
    };
  });

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SCREEN_WIDTH / 4], [0, 1]),
  }));

  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SCREEN_WIDTH / 4, 0], [1, 0]),
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, cardStyle]}>
        <Pressable onPress={onViewProfile} style={styles.cardPressable}>
          <View style={styles.imageContainer}>
            {person.profile_image_url ? (
              <Image
                source={{ uri: person.profile_image_url }}
                style={styles.profileImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
                <Text style={styles.placeholderText}>{initials}</Text>
              </View>
            )}

            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.6)"]}
              style={styles.gradient}
            />

            <Animated.View style={[styles.swipeOverlay, styles.likeOverlay, likeOpacity]}>
              <Text style={styles.overlayText}>LIKED ❤️</Text>
            </Animated.View>

            <Animated.View style={[styles.swipeOverlay, styles.nopeOverlay, nopeOpacity]}>
              <Text style={styles.overlayText}>NOPE ✖️</Text>
            </Animated.View>

            <View style={styles.photoInfo}>
              <Text style={styles.nameAge}>
                {fullName}
                {age && <Text style={styles.age}>, {age}</Text>}
              </Text>
              {currentJob && (
                <Text style={styles.jobTitle}>
                  {currentJob.title} @ {currentJob.company_name}
                </Text>
              )}
              {person.location && (
                <View style={styles.locationRow}>
                  <Text style={styles.locationIcon}>📍</Text>
                  <Text style={styles.locationText}>{person.location}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.cardDetails}>
            <View style={styles.statsRow}>
              {person.seniority && (
                <View style={styles.statItem}>
                  <Text style={styles.statIcon}>⭐</Text>
                  <Text style={styles.statText}>{person.seniority}</Text>
                </View>
              )}
              {person.years_of_experience !== undefined && (
                <View style={styles.statItem}>
                  <Text style={styles.statIcon}>💼</Text>
                  <Text style={styles.statText}>{person.years_of_experience} years</Text>
                </View>
              )}
              {person.education_level && (
                <View style={styles.statItem}>
                  <Text style={styles.statIcon}>🎓</Text>
                  <Text style={styles.statText}>{person.education_level}</Text>
                </View>
              )}
            </View>

            {person.people_highlights && person.people_highlights.length > 0 && (
              <View style={styles.highlightsRow}>
                {person.people_highlights.slice(0, 3).map((highlight, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.highlightBadge,
                      { backgroundColor: getHighlightColor(highlight) },
                    ]}
                  >
                    <Text style={styles.highlightText}>{formatHighlight(highlight)}</Text>
                  </View>
                ))}
              </View>
            )}

            {person.tagline && (
              <Text style={styles.tagline} numberOfLines={2}>
                {person.tagline}
              </Text>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  logo: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1a365d",
  },
  headerRight: {
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
  },
  cardContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    position: "absolute",
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.7,
    borderRadius: 16,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  cardPressable: {
    flex: 1,
  },
  imageContainer: {
    height: "60%",
    width: "100%",
    position: "relative",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  profileImagePlaceholder: {
    backgroundColor: "#1a365d",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 60,
    fontWeight: "bold",
    color: "white",
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
  },
  swipeOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  likeOverlay: {
    backgroundColor: "rgba(34, 197, 94, 0.9)",
  },
  nopeOverlay: {
    backgroundColor: "rgba(239, 68, 68, 0.9)",
  },
  overlayText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "white",
    textTransform: "uppercase",
  },
  photoInfo: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  nameAge: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  age: {
    fontWeight: "normal",
  },
  jobTitle: {
    fontSize: 16,
    color: "white",
    marginBottom: 4,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationIcon: {
    fontSize: 14,
  },
  locationText: {
    fontSize: 14,
    color: "white",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardDetails: {
    padding: 16,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statIcon: {
    fontSize: 14,
  },
  statText: {
    fontSize: 13,
    color: "#64748b",
  },
  highlightsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  highlightBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  highlightText: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
  },
  tagline: {
    fontSize: 13,
    color: "#9ca3af",
    lineHeight: 18,
  },
  actionButtons: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  mainActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  actionCircle: {
    alignItems: "center",
  },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  dislikeCircle: {
    backgroundColor: "#ef4444",
  },
  infoCircle: {
    backgroundColor: "#6b7280",
  },
  likeCircle: {
    backgroundColor: "#22c55e",
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 4,
  },
  loadingMore: {
    position: "absolute",
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 20,
    alignSelf: "center",
  },
  loadingMoreText: {
    fontSize: 13,
    color: "#64748b",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748b",
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a365d",
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#1a365d",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
