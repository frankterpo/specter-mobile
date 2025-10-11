import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
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
import FilterModal, { FilterOptions } from "../components/FilterModal";
import ListModal from "../components/ListModal";
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
  formatRelativeTime,
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
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [listModalVisible, setListModalVisible] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [seenPersonIds, setSeenPersonIds] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);

  const LIMIT = 50; // Changed from 10 to 50 for proper batch loading

  useEffect(() => {
    loadPeople(0, true); // Replace on initial load
  }, []);

  useEffect(() => {
    // Load more when we reach halfway through the current batch
    const halfwayPoint = Math.floor(cards.length / 2);
    if (cards.length > 0 && currentIndex >= halfwayPoint && !isLoadingMore && hasMore) {
      if (__DEV__) {
        console.log(`📊 Pagination trigger: currentIndex=${currentIndex}, halfwayPoint=${halfwayPoint}, cards.length=${cards.length}`);
      }
      loadMorePeople();
    }
  }, [currentIndex]);

  const loadPeople = async (newOffset: number, replace: boolean = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      // Convert FilterOptions to API filter format
      const apiFilters: any = {};
      if (filters.seniority && filters.seniority.length > 0) {
        apiFilters.seniority = filters.seniority;
      }
      if (filters.highlights && filters.highlights.length > 0) {
        apiFilters.people_highlights = filters.highlights;
      }
      if (filters.hasLinkedIn) {
        apiFilters.has_linkedin = true;
      }
      if (filters.hasTwitter) {
        apiFilters.has_twitter = true;
      }
      if (filters.hasGitHub) {
        apiFilters.has_github = true;
      }

      if (__DEV__) {
        console.log("🔍 Fetching people:", { offset: newOffset, limit: LIMIT, filters: apiFilters });
      }

      const response = await fetchPeople(token, {
        limit: LIMIT,
        offset: newOffset,
        filters: Object.keys(apiFilters).length > 0 ? apiFilters : undefined,
      });

      if (__DEV__) {
        console.log(`✅ Fetched ${response.items.length} people`);
      }

      // Filter out duplicates
      const newCards = response.items.filter(p => !seenPersonIds.has(p.id));
      const newIds = new Set([...seenPersonIds, ...newCards.map(p => p.id)]);

      if (__DEV__) {
        console.log(`🔄 After deduplication: ${newCards.length} new people (filtered ${response.items.length - newCards.length} duplicates)`);
      }

      if (replace) {
        // Only replace when explicitly told (initial load or filter change)
        setCards(newCards);
        setCurrentIndex(0);
        setSeenPersonIds(new Set(newCards.map(p => p.id)));
      } else {
        // Append for pagination
        setCards((prev) => [...prev, ...newCards]);
        setSeenPersonIds(newIds);
      }
      setOffset(newOffset);
      setHasMore(response.items.length >= LIMIT);
    } catch (err: any) {
      setError(err.message || "Failed to load people");
      console.error("❌ Load people error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMorePeople = async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);

    try {
      const token = await getToken();
      if (!token) return;

      const nextOffset = offset + LIMIT;

      // Convert FilterOptions to API filter format
      const apiFilters: any = {};
      if (filters.seniority && filters.seniority.length > 0) {
        apiFilters.seniority = filters.seniority;
      }
      if (filters.highlights && filters.highlights.length > 0) {
        apiFilters.people_highlights = filters.highlights;
      }
      if (filters.hasLinkedIn) {
        apiFilters.has_linkedin = true;
      }
      if (filters.hasTwitter) {
        apiFilters.has_twitter = true;
      }
      if (filters.hasGitHub) {
        apiFilters.has_github = true;
      }

      if (__DEV__) {
        console.log("📥 Loading more people:", { offset: nextOffset, limit: LIMIT });
      }

      const response = await fetchPeople(token, {
        limit: LIMIT,
        offset: nextOffset,
        filters: Object.keys(apiFilters).length > 0 ? apiFilters : undefined,
      });

      // Filter out duplicates
      const newCards = response.items.filter(p => !seenPersonIds.has(p.id));
      const newIds = new Set([...seenPersonIds, ...newCards.map(p => p.id)]);

      if (__DEV__) {
        console.log(`✅ Loaded ${newCards.length} more people (filtered ${response.items.length - newCards.length} duplicates)`);
      }

      setCards((prev) => [...prev, ...newCards]);
      setSeenPersonIds(newIds);
      setOffset(nextOffset);
      setHasMore(response.items.length >= LIMIT);
    } catch (err: any) {
      console.error("❌ Load more error:", err);
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

  const handleAddToList = (person: Person) => {
    setSelectedPerson(person);
    setListModalVisible(true);
  };

  const handleApplyFilters = (newFilters: FilterOptions) => {
    setFilters(newFilters);
    // Reset pagination state when filters change
    setSeenPersonIds(new Set());
    setHasMore(true);
    setOffset(0);
    // Reload with new filters, replace array
    loadPeople(0, true);
  };

  const hasActiveFilters = () => {
    return (
      (filters.seniority && filters.seniority.length > 0) ||
      (filters.highlights && filters.highlights.length > 0) ||
      filters.hasLinkedIn ||
      filters.hasTwitter ||
      filters.hasGitHub
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#1a365d" />
        <Text style={styles.loadingText}>Loading profiles...</Text>
      </View>
    );
  }

  if (error || (cards.length === 0 && !isLoading) || (currentIndex >= cards.length && !isLoadingMore)) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.logo}>Specter</Text>
          <View style={styles.headerRight}>
            <Pressable 
              onPress={() => setFilterModalVisible(true)} 
              style={[styles.iconButton, hasActiveFilters() && styles.iconButtonActive]}
            >
              <Ionicons 
                name="options-outline" 
                size={24} 
                color={hasActiveFilters() ? "white" : "#1a365d"} 
              />
              {hasActiveFilters() && <View style={styles.filterBadge} />}
            </Pressable>
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
          <Pressable onPress={() => loadPeople(0, true)} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Refresh</Text>
          </Pressable>
        </View>

        <FilterModal
          visible={filterModalVisible}
          onClose={() => setFilterModalVisible(false)}
          onApply={handleApplyFilters}
          currentFilters={filters}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.logo}>Specter</Text>
        <View style={styles.headerRight}>
          <Pressable 
            onPress={() => setFilterModalVisible(true)} 
            style={[styles.iconButton, hasActiveFilters() && styles.iconButtonActive]}
          >
            <Ionicons 
              name="options-outline" 
              size={24} 
              color={hasActiveFilters() ? "white" : "#1a365d"} 
            />
            {hasActiveFilters() && <View style={styles.filterBadge} />}
          </Pressable>
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
                onAddToList={() => handleAddToList(person)}
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

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={handleApplyFilters}
        currentFilters={filters}
      />

      {selectedPerson && (
        <ListModal
          visible={listModalVisible}
          onClose={() => setListModalVisible(false)}
          personId={selectedPerson.id}
          personName={selectedPerson.full_name || getFullName(selectedPerson)}
        />
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
  onAddToList: () => void;
};

function SwipeCard({ person, index, isTop, onLike, onDislike, onViewProfile, onAddToList }: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const currentJob = getCurrentJob(person.experience);
  const fullName = person.full_name || getFullName(person);
  const initials = getInitials(person);

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

  // Status badge rendering
  const renderStatusBadge = () => {
    if (!person.entity_status) return null;

    const { status, updated_at } = person.entity_status;
    const relativeTime = formatRelativeTime(updated_at);
    
    let emoji = "";
    let bgColor = "";
    let statusText = "";

    if (status === "liked") {
      emoji = "✓";
      bgColor = "#22c55e";
      statusText = `You liked this${relativeTime ? ` ${relativeTime}` : ""}`;
    } else if (status === "disliked") {
      emoji = "✖";
      bgColor = "#ef4444";
      statusText = `You disliked this${relativeTime ? ` ${relativeTime}` : ""}`;
    } else if (status === "viewed") {
      emoji = "👁";
      bgColor = "#3b82f6";
      statusText = `You viewed this${relativeTime ? ` ${relativeTime}` : ""}`;
    }

    if (!statusText) return null;

    return (
      <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
        <Text style={styles.statusBadgeText}>
          {emoji} {statusText}
        </Text>
      </View>
    );
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, cardStyle]}>
        <Pressable onPress={onViewProfile} style={styles.cardPressable}>
          {/* Swipe overlays */}
          <Animated.View style={[styles.swipeOverlay, styles.likeOverlay, likeOpacity]}>
            <Text style={styles.overlayText}>LIKED ❤️</Text>
          </Animated.View>

          <Animated.View style={[styles.swipeOverlay, styles.nopeOverlay, nopeOpacity]}>
            <Text style={styles.overlayText}>NOPE ✖️</Text>
          </Animated.View>

          {/* Card content */}
          <View style={styles.newCardContent}>
            {/* Circular profile photo */}
            <View style={styles.circularPhotoContainer}>
              {person.profile_image_url ? (
                <Image
                  source={{ uri: person.profile_image_url }}
                  style={styles.circularPhoto}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[styles.circularPhoto, styles.circularPhotoPlaceholder]}>
                  <Text style={styles.circularPhotoInitials}>{initials}</Text>
                </View>
              )}
            </View>

            {/* Name */}
            <Text style={styles.cardName}>{fullName}</Text>

            {/* Status badge */}
            {renderStatusBadge()}

            {/* Tagline section */}
            {person.tagline && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tagline</Text>
                <Text style={styles.sectionContent} numberOfLines={2}>
                  {person.tagline}
                </Text>
              </View>
            )}

            {/* Current experience section */}
            {currentJob && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Current Experience</Text>
                <Text style={styles.sectionContent}>
                  {currentJob.company_name}
                </Text>
              </View>
            )}

            {/* Region & Seniority section */}
            <View style={styles.twoColumnSection}>
              {person.region && (
                <View style={styles.columnItem}>
                  <Text style={styles.sectionTitle}>Region</Text>
                  <Text style={styles.sectionContent}>{person.region}</Text>
                </View>
              )}
              {person.seniority && (
                <View style={styles.columnItem}>
                  <Text style={styles.sectionTitle}>Seniority</Text>
                  <Text style={styles.sectionContent}>{person.seniority}</Text>
                </View>
              )}
            </View>

            {/* Followers & Connections section */}
            <View style={styles.twoColumnSection}>
              {person.followers_count !== undefined && (
                <View style={styles.columnItem}>
                  <Text style={styles.sectionTitle}>Followers</Text>
                  <Text style={styles.sectionContent}>{person.followers_count.toLocaleString()}</Text>
                </View>
              )}
              {person.connections_count !== undefined && (
                <View style={styles.columnItem}>
                  <Text style={styles.sectionTitle}>Connections</Text>
                  <Text style={styles.sectionContent}>{person.connections_count.toLocaleString()}</Text>
                </View>
              )}
            </View>

            {/* Socials section */}
            {(person.linkedin_url || person.twitter_url || person.github_url) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Socials</Text>
                <View style={styles.socialsRow}>
                  {person.linkedin_url && (
                    <Pressable
                      style={styles.socialIconButton}
                      onPress={() => Linking.openURL(person.linkedin_url!)}
                    >
                      <Ionicons name="logo-linkedin" size={20} color="#0077b5" />
                    </Pressable>
                  )}
                  {person.twitter_url && (
                    <Pressable
                      style={styles.socialIconButton}
                      onPress={() => Linking.openURL(person.twitter_url!)}
                    >
                      <Ionicons name="logo-twitter" size={20} color="#1da1f2" />
                    </Pressable>
                  )}
                  {person.github_url && (
                    <Pressable
                      style={styles.socialIconButton}
                      onPress={() => Linking.openURL(person.github_url!)}
                    >
                      <Ionicons name="logo-github" size={20} color="#333333" />
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {/* Highlights */}
            {person.people_highlights && person.people_highlights.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Highlights</Text>
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
              </View>
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
    position: "relative",
  },
  iconButtonActive: {
    backgroundColor: "#1a365d",
  },
  filterBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
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
  swipeOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    zIndex: 10,
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
  newCardContent: {
    flex: 1,
    padding: 20,
    alignItems: "center",
  },
  circularPhotoContainer: {
    marginTop: 10,
    marginBottom: 12,
  },
  circularPhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#f3f4f6",
  },
  circularPhotoPlaceholder: {
    backgroundColor: "#1a365d",
    alignItems: "center",
    justifyContent: "center",
  },
  circularPhotoInitials: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
  },
  cardName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a365d",
    marginBottom: 6,
    textAlign: "center",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  section: {
    width: "100%",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  sectionContent: {
    fontSize: 15,
    color: "#1F2937",
    lineHeight: 20,
  },
  twoColumnSection: {
    width: "100%",
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  columnItem: {
    flex: 1,
  },
  socialsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  socialIconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  addToListButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  addToListText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1a365d",
  },
  highlightsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
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
