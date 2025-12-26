import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  ActivityIndicator,
  Linking,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { logger } from "../utils/logger";
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
import FilterModal, { FilterOptions } from "../components/FilterModal";
import ListModal from "../components/ListModal";
import {
  Person,
  StatusFilters,
  getCurrentJob,
  getFullName,
  getInitials,
  formatHighlight,
  getHighlightColor,
  formatRelativeTime,
  AuthError,
} from "../api/specter";
import { specterPublicAPI } from "../api/public-client";
import { colors } from "../theme/colors";
import { useClerkToken } from "../hooks/useClerkToken";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.4;
const ROTATION_ANGLE = 15;

type MainStackParamList = {
  SwipeDeck: { updatedPerson?: Person } | undefined;
  PersonDetail: { personId: string };
  Settings: undefined;
  Diagnostics: undefined;
};

type SwipeDeckScreenProps = {
  navigation: NativeStackNavigationProp<MainStackParamList, "SwipeDeck">;
};

export default function SwipeDeckScreen({ navigation, route }: SwipeDeckScreenProps & { route: any }) {
  const insets = useSafeAreaInsets();
  const { getAuthToken } = useClerkToken();

  const [cards, setCards] = useState<Person[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [listModalVisible, setListModalVisible] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [seenPersonIds, setSeenPersonIds] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [currentQueryId, setCurrentQueryId] = useState<string | null>(null);
  const [statusFilters, setStatusFilters] = useState<StatusFilters>({});

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const CARDS_PER_PAGE = 50;

  useEffect(() => {
    loadCards(false);
  }, [statusFilters]);

  // Handle updated person from detail screen
  useEffect(() => {
    if (route?.params?.updatedPerson) {
      const updatedPerson = route.params.updatedPerson;
      setCards((prevCards) =>
        prevCards.map((card) =>
          card.id === updatedPerson.id ? updatedPerson : card
        )
      );
      // Clear the param to avoid re-processing
      navigation.setParams({ updatedPerson: undefined });
    }
  }, [route?.params?.updatedPerson]);

  const loadCards = async (loadMore = false) => {
    if (loadMore && !hasMore) return;

    try {
      if (!loadMore) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }

      const newOffset = loadMore ? offset : 0;
      
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      const response = await specterPublicAPI.people.enrich({
        limit: CARDS_PER_PAGE,
        offset: newOffset,
      }, token);

      const newPeople = response.items || [];

      // If loading fresh, reset the seen IDs
      if (!loadMore) {
        setSeenPersonIds(new Set());
      }

      // Filter out duplicates
      const existingIds = loadMore ? seenPersonIds : new Set();
      const uniquePeople = newPeople.filter(
        (person: Person) => person.id && !existingIds.has(person.id)
      );

      // Update seen IDs
      const newSeenIds = new Set(existingIds);
      uniquePeople.forEach((person: Person) => {
        if (person.id) newSeenIds.add(person.id);
      });
      setSeenPersonIds(newSeenIds);

      if (loadMore) {
        setCards((prev) => [...prev, ...uniquePeople]);
      } else {
        setCards(uniquePeople);
        setCurrentIndex(0);
      }

      setOffset(newOffset + CARDS_PER_PAGE);
      setHasMore(response.has_more ?? uniquePeople.length === CARDS_PER_PAGE);
    } catch (err: any) {
      console.error("❌ [SwipeDeck] Load error:", err);
      setError(err.message || "Failed to load people");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleSwipe = async (direction: "left" | "right") => {
    const person = cards[currentIndex];
    if (!person) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");

      if (direction === "right") {
        await specterPublicAPI.people.like(person.id, token);
      } else {
        await specterPublicAPI.people.dislike(person.id, token);
      }

      // Move to next card
      setCurrentIndex((prev) => prev + 1);

      // Load more if needed
      if (currentIndex >= cards.length - 5 && hasMore && !isLoadingMore) {
        loadCards(true);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }

    // Reset position
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
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

  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1]),
  }));

  const nopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0]),
  }));

  const currentPerson = cards[currentIndex];

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.brand.green} />
        <Text style={styles.loadingText}>Loading people...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle" size={48} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => loadCards(false)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!currentPerson || currentIndex >= cards.length) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="checkmark-circle" size={64} color={colors.brand.green} />
        <Text style={styles.emptyText}>You've seen all cards!</Text>
        <Pressable
          style={styles.refreshButton}
          onPress={() => {
            setOffset(0);
            loadCards(false);
          }}
        >
          <Ionicons name="refresh" size={20} color={colors.text.inverse} />
          <Text style={styles.refreshButtonText}>Load More</Text>
        </Pressable>
      </View>
    );
  }

  const personName = getFullName(currentPerson);
  const currentJob = getCurrentJob(currentPerson);
  const initials = getInitials(currentPerson);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerButton}
            onPress={() => setFilterModalVisible(true)}
          >
            <Ionicons name="options" size={22} color={colors.text.primary} />
          </Pressable>
          <Pressable
            style={styles.headerButton}
            onPress={() => navigation.navigate("Settings")}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text.primary} />
          </Pressable>
        </View>
      </View>

      {/* Card Stack */}
      <View style={styles.cardContainer}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.card, cardAnimatedStyle]}>
            {/* Like/Nope Labels */}
            <Animated.View style={[styles.labelContainer, styles.likeLabel, likeStyle]}>
              <Text style={styles.labelText}>LIKE</Text>
            </Animated.View>
            <Animated.View style={[styles.labelContainer, styles.nopeLabel, nopeStyle]}>
              <Text style={styles.labelText}>NOPE</Text>
            </Animated.View>

            {/* Card Content */}
            <Pressable
              style={styles.cardContent}
              onPress={() => navigation.navigate("PersonDetail", { personId: currentPerson.id })}
            >
              {/* Avatar */}
              <View style={styles.avatarContainer}>
                {currentPerson.profile_image_url ? (
                  <Image
                    source={{ uri: currentPerson.profile_image_url }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                )}
              </View>

              {/* Info */}
              <Text style={styles.personName}>{personName}</Text>
              {currentJob && (
                <Text style={styles.personTitle}>
                  {currentJob.title} at {currentJob.org_name}
                </Text>
              )}

              {/* Location */}
              {currentPerson.location && (
                <View style={styles.locationRow}>
                  <Ionicons name="location" size={14} color={colors.text.tertiary} />
                  <Text style={styles.locationText}>{currentPerson.location}</Text>
                </View>
              )}

              {/* LinkedIn */}
              {currentPerson.linkedin_url && (
                <Pressable
                  style={styles.linkedinButton}
                  onPress={() => Linking.openURL(currentPerson.linkedin_url!)}
                >
                  <Ionicons name="logo-linkedin" size={16} color="#0A66C2" />
                  <Text style={styles.linkedinText}>View LinkedIn</Text>
                </Pressable>
              )}
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <Pressable
          style={[styles.actionButton, styles.actionDislike]}
          onPress={() => handleSwipe("left")}
        >
          <Ionicons name="close" size={32} color={colors.error} />
        </Pressable>

        <Pressable
          style={[styles.actionButton, styles.actionList]}
          onPress={() => {
            setSelectedPerson(currentPerson);
            setListModalVisible(true);
          }}
        >
          <Ionicons name="bookmark-outline" size={28} color={colors.brand.green} />
        </Pressable>

        <Pressable
          style={[styles.actionButton, styles.actionLike]}
          onPress={() => handleSwipe("right")}
        >
          <Ionicons name="heart" size={32} color={colors.success} />
        </Pressable>
      </View>

      {/* Progress */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          {currentIndex + 1} / {cards.length}
          {hasMore && " (more available)"}
        </Text>
      </View>

      {/* Modals */}
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        onApply={(newFilters) => {
          setFilters(newFilters);
          setFilterModalVisible(false);
        }}
      />

      <ListModal
        visible={listModalVisible}
        onClose={() => setListModalVisible(false)}
        personId={selectedPerson?.id || ""}
        personName={selectedPerson ? getFullName(selectedPerson) : ""}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card.bg,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text.primary,
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  headerButton: {
    padding: 8,
  },
  cardContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_HEIGHT * 0.55,
    backgroundColor: colors.content.bgSecondary,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  labelContainer: {
    position: "absolute",
    top: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 2,
    zIndex: 10,
  },
  likeLabel: {
    right: 20,
    borderColor: colors.success,
    transform: [{ rotate: "15deg" }],
  },
  nopeLabel: {
    left: 20,
    borderColor: colors.error,
    transform: [{ rotate: "-15deg" }],
  },
  labelText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    backgroundColor: colors.brand.green,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 40,
    fontWeight: "600",
    color: colors.text.inverse,
  },
  personName: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: 4,
  },
  personTitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 16,
  },
  locationText: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  linkedinButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#0A66C215",
  },
  linkedinText: {
    fontSize: 14,
    color: "#0A66C2",
    fontWeight: "500",
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 24,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionDislike: {
    backgroundColor: colors.tag.red.bg,
  },
  actionList: {
    backgroundColor: colors.brand.green + "15",
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  actionLike: {
    backgroundColor: colors.tag.green.bg,
  },
  progressContainer: {
    alignItems: "center",
    paddingBottom: 16,
  },
  progressText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.error,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: colors.brand.green,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.inverse,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: colors.brand.green,
    borderRadius: 8,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.inverse,
  },
});
