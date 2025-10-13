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
  createQuery,
  likePerson,
  dislikePerson,
  markAsViewed,
  fetchTeamStatus,
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.4;
const ROTATION_ANGLE = 15;

type MainStackParamList = {
  SwipeDeck: { updatedPerson?: Person } | undefined;
  PersonDetail: { personId: string };
  Settings: undefined;
};

type SwipeDeckScreenProps = {
  navigation: NativeStackNavigationProp<MainStackParamList, "SwipeDeck">;
};

export default function SwipeDeckScreen({ navigation, route }: SwipeDeckScreenProps & { route: any }) {
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
  const [currentQueryId, setCurrentQueryId] = useState<string | null>(null);
  const [statusFilters, setStatusFilters] = useState<StatusFilters>({});

  const LIMIT = 50; // Changed from 10 to 50 for proper batch loading

  useEffect(() => {
    loadPeople(0, true); // Replace on initial load
  }, []);

  // Handle updated person coming back from PersonDetailScreen
  useEffect(() => {
    if (route.params?.updatedPerson) {
      const updatedPerson = route.params.updatedPerson;
      if (__DEV__) {
        console.log("🔄 Received updated person from PersonDetail:", updatedPerson.id);
        console.log("   Status:", updatedPerson.entity_status);
      }
      
      // Update the person in our cards array
      setCards(prevCards =>
        prevCards.map(card =>
          card.id === updatedPerson.id
            ? {
                ...card,
                entity_status: updatedPerson.entity_status,
              }
            : card
        )
      );
      
      // Clear the param so it doesn't trigger again
      navigation.setParams({ updatedPerson: undefined } as any);
    }
  }, [route.params?.updatedPerson]);

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
      if (__DEV__) {
        console.log("🔄 loadPeople START:", { 
          offset: newOffset, 
          replace, 
          hasFilters: Object.keys(filters).length > 0,
          filters: filters 
        });
      }

      // Get token with timeout
      const tokenPromise = getToken();
      const token = await Promise.race([
        tokenPromise,
        new Promise<string | null>((_, reject) =>
          setTimeout(() => reject(new Error("Auth timeout")), 3000)
        ),
      ]);

      if (!token) {
        throw new AuthError("Authentication required. Please sign in.");
      }

      if (__DEV__) {
        console.log("🔑 Token obtained, fetching people directly...");
      }

      // Use direct POST endpoint (without queryId)
      // The backend should accept filters directly in the request body
      const response = await fetchPeople(token, {
        limit: LIMIT,
        offset: newOffset,
        filters,
        statusFilters,
      });

      if (__DEV__) {
        console.log(`✅ Fetched ${response.items.length} people`);
      }

      // Save queryId if returned for pagination
      if (response.query_id && replace) {
        setCurrentQueryId(response.query_id);
        if (__DEV__) {
          console.log(`📝 Saved queryId for pagination: ${response.query_id}`);
        }
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
      if (err instanceof AuthError || err.message?.includes("Auth")) {
        setError("Authentication expired. Please sign in again.");
        if (__DEV__) {
          console.error("🔐 Auth error - user needs to sign in");
        }
      } else {
        setError(err.message || "Failed to load people");
      }
      console.error("❌ Load people error:", err);
      if (__DEV__) {
        console.error("Full error details:", JSON.stringify(err, null, 2));
      }
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

      if (__DEV__) {
        console.log("📥 Loading more people:", { offset: nextOffset, limit: LIMIT, hasQueryId: !!currentQueryId });
      }

      // Try to use queryId if available, otherwise use filters
      const response = await fetchPeople(token, {
        limit: LIMIT,
        offset: nextOffset,
        ...(currentQueryId ? { queryId: currentQueryId } : { filters, statusFilters }),
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
      if (err instanceof AuthError) {
        setError("Authentication expired. Please sign in again.");
      }
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleLike = async (person: Person) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (__DEV__) {
      console.log("👍 Liking profile:", person.id);
      console.log("   Previous status:", person.entity_status?.status || "none");
    }

    // Update local state FIRST - REPLACE status completely
    const personId = person.id;
    const currentIdx = currentIndex;
    
    setCards(prevCards => 
      prevCards.map((card, idx) => {
        if (idx === currentIdx && card.id === personId) {
          if (__DEV__) {
            console.log(`✅ Setting status to "liked" (REPLACES previous status)`);
          }
          return {
            ...card,
            entity_status: {
              status: "liked",
              updated_at: new Date().toISOString(),
            },
          };
        }
        return card;
      })
    );

    // API call in background
    try {
      const token = await getToken();
      if (token) {
        await likePerson(token, personId);
        if (__DEV__) {
          console.log(`✅ API: Successfully liked ${personId} in database`);
          console.log(`   Local state for this card now has: liked=true, viewed=${cards[currentIdx]?.entity_status?.viewed}`);
        }
      }
    } catch (err) {
      console.error("❌ Like API error:", err);
      // Even if API fails, local state is updated so user sees the badge
    }

    // Small delay to show the "liked" badge before moving to next card
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
    }, 300);
  };

  const handleDislike = async (person: Person) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (__DEV__) {
      console.log("👎 Disliking profile:", person.id);
      console.log("   Previous status:", person.entity_status?.status || "none");
    }

    // Update local state FIRST - REPLACE status completely
    const personId = person.id;
    const currentIdx = currentIndex;
    
    setCards(prevCards => 
      prevCards.map((card, idx) => {
        if (idx === currentIdx && card.id === personId) {
          if (__DEV__) {
            console.log(`✅ Setting status to "disliked" (REPLACES previous status)`);
          }
          return {
            ...card,
            entity_status: {
              status: "disliked",
              updated_at: new Date().toISOString(),
            },
          };
        }
        return card;
      })
    );

    // API call in background
    try {
      const token = await getToken();
      if (token) {
        await dislikePerson(token, personId);
        if (__DEV__) {
          console.log(`✅ API: Successfully disliked ${personId} in database`);
          console.log(`   Local state for this card now has: disliked=true, viewed=${cards[currentIdx]?.entity_status?.viewed}`);
        }
      }
    } catch (err) {
      console.error("❌ Dislike API error:", err);
      // Even if API fails, local state is updated so user sees the badge
    }

    // Small delay to show the "disliked" badge before moving to next card
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
    }, 300);
  };

  const handlePass = async (person: Person) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (__DEV__) {
      console.log("⏭️  Passing/Skipping profile:", person.id);
      console.log("   Previous status:", person.entity_status?.status || "none");
    }

    // Update local state FIRST - REPLACE status completely
    const personId = person.id;
    const currentIdx = currentIndex;
    
    setCards(prevCards => 
      prevCards.map((card, idx) => {
        if (idx === currentIdx && card.id === personId) {
          if (__DEV__) {
            console.log(`✅ Setting status to "viewed" (REPLACES previous status)`);
          }
          return {
            ...card,
            entity_status: {
              status: "viewed",
              updated_at: new Date().toISOString(),
            },
          };
        }
        return card;
      })
    );

    // API call in background
    try {
      const token = await getToken();
      if (token) {
        await markAsViewed(token, personId);
        if (__DEV__) {
          console.log(`✅ API: Successfully marked ${personId} as viewed/passed in database`);
        }
      }
    } catch (err) {
      console.error("❌ Pass API error:", err);
    }

    // Small delay to show the "passed" badge before moving to next card
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
    }, 300);
  };

  const handleViewProfile = async (person: Person) => {
    // Navigate to detail view (does NOT change status)
    navigation.navigate("PersonDetail", { personId: person.id });
  };

  const handleAddToList = (person: Person) => {
    setSelectedPerson(person);
    setListModalVisible(true);
  };

  const handleApplyFilters = (newFilters: FilterOptions) => {
    if (__DEV__) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🎯 USER APPLIED FILTERS:");
      console.log(JSON.stringify(newFilters, null, 2));
      console.log("Active filter count:", Object.keys(newFilters).length);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }
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

  const toggleStatusFilter = (filterType: keyof StatusFilters, value: any) => {
    setStatusFilters(prev => {
      const newFilters = { ...prev };
      if (newFilters[filterType] === value) {
        // Toggle off if same value clicked
        delete newFilters[filterType];
      } else {
        newFilters[filterType] = value;
      }
      return newFilters;
    });
    // Reload with new status filters
    loadPeople(0, true);
  };

  const hasActiveStatusFilters = () => {
    return Object.keys(statusFilters).length > 0;
  };

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

      {/* Status Filter Bar */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.statusFilterBar}
        contentContainerStyle={styles.statusFilterContent}
      >
        {/* Personal Status Filters */}
        <Pressable
          onPress={() => toggleStatusFilter('myStatus', 'not_viewed')}
          style={[
            styles.statusChip,
            statusFilters.myStatus === 'not_viewed' && styles.statusChipActive
          ]}
        >
          <Ionicons 
            name="eye-off-outline" 
            size={16} 
            color={statusFilters.myStatus === 'not_viewed' ? 'white' : '#6B7280'} 
          />
          <Text style={[
            styles.statusChipText,
            statusFilters.myStatus === 'not_viewed' && styles.statusChipTextActive
          ]}>
            Not Viewed
          </Text>
        </Pressable>

        <Pressable
          onPress={() => toggleStatusFilter('myStatus', 'viewed')}
          style={[
            styles.statusChip,
            statusFilters.myStatus === 'viewed' && styles.statusChipActive
          ]}
        >
          <Ionicons 
            name="eye-outline" 
            size={16} 
            color={statusFilters.myStatus === 'viewed' ? 'white' : '#6B7280'} 
          />
          <Text style={[
            styles.statusChipText,
            statusFilters.myStatus === 'viewed' && styles.statusChipTextActive
          ]}>
            Viewed
          </Text>
        </Pressable>

        <Pressable
          onPress={() => toggleStatusFilter('myStatus', 'liked')}
          style={[
            styles.statusChip,
            statusFilters.myStatus === 'liked' && styles.statusChipActive
          ]}
        >
          <Ionicons 
            name="heart-outline" 
            size={16} 
            color={statusFilters.myStatus === 'liked' ? 'white' : '#6B7280'} 
          />
          <Text style={[
            styles.statusChipText,
            statusFilters.myStatus === 'liked' && styles.statusChipTextActive
          ]}>
            Liked
          </Text>
        </Pressable>

        <Pressable
          onPress={() => toggleStatusFilter('myStatus', 'disliked')}
          style={[
            styles.statusChip,
            statusFilters.myStatus === 'disliked' && styles.statusChipActive
          ]}
        >
          <Ionicons 
            name="close-circle-outline" 
            size={16} 
            color={statusFilters.myStatus === 'disliked' ? 'white' : '#6B7280'} 
          />
          <Text style={[
            styles.statusChipText,
            statusFilters.myStatus === 'disliked' && styles.statusChipTextActive
          ]}>
            Disliked
          </Text>
        </Pressable>

        {/* Divider */}
        <View style={styles.statusDivider} />

        {/* Team Status Filters */}
        <Pressable
          onPress={() => toggleStatusFilter('teamViewed', !statusFilters.teamViewed)}
          style={[
            styles.statusChip,
            statusFilters.teamViewed && styles.statusChipActive
          ]}
        >
          <Ionicons 
            name="people-outline" 
            size={16} 
            color={statusFilters.teamViewed ? 'white' : '#6B7280'} 
          />
          <Text style={[
            styles.statusChipText,
            statusFilters.teamViewed && styles.statusChipTextActive
          ]}>
            Team Viewed
          </Text>
        </Pressable>

        <Pressable
          onPress={() => toggleStatusFilter('teamLiked', !statusFilters.teamLiked)}
          style={[
            styles.statusChip,
            statusFilters.teamLiked && styles.statusChipActive
          ]}
        >
          <Ionicons 
            name="people" 
            size={16} 
            color={statusFilters.teamLiked ? 'white' : '#6B7280'} 
          />
          <Text style={[
            styles.statusChipText,
            statusFilters.teamLiked && styles.statusChipTextActive
          ]}>
            Team Liked
          </Text>
        </Pressable>
      </ScrollView>

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
                onPass={() => handlePass(person)}
                onViewProfile={() => handleViewProfile(person)}
                onAddToList={() => handleAddToList(person)}
              />
            );
          })}
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
  onPass: () => void;
  onViewProfile: () => void;
  onAddToList: () => void;
};

function SwipeCard({ person, index, isTop, onLike, onDislike, onPass, onViewProfile, onAddToList }: SwipeCardProps) {
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

      // Check for swipe down first (Pass action)
      if (event.translationY > SWIPE_THRESHOLD) {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
        runOnJS(onPass)();
        return;
      }

      // Check for horizontal swipe (Like/Dislike)
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

  const passOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, SCREEN_HEIGHT / 4], [0, 0.7]),
  }));

  // Status badge rendering - shows ONE status (mutually exclusive)
  const renderStatusBadge = () => {
    if (!person.entity_status || !person.entity_status.status) return null;

    const status = person.entity_status.status;
    const relativeTime = formatRelativeTime(person.entity_status.updated_at);
    
    let emoji = "";
    let bgColor = "";
    let text = "";

    if (status === "liked") {
      emoji = "✓";
      bgColor = "#22c55e";
      text = `You liked this${relativeTime ? ` ${relativeTime}` : ""}`;
    } else if (status === "disliked") {
      emoji = "✖";
      bgColor = "#ef4444";
      text = `You disliked this${relativeTime ? ` ${relativeTime}` : ""}`;
    } else if (status === "viewed") {
      emoji = "⏭️";
      bgColor = "#3b82f6";
      text = `You passed on this${relativeTime ? ` ${relativeTime}` : ""}`;
    }

    if (!text) return null;

    return (
      <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
        <Text style={styles.statusBadgeText}>
          {emoji} {text}
        </Text>
      </View>
    );
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, cardStyle]}>
        {/* Action buttons positioned ON the card */}
        {isTop && (
          <>
            {/* NOPE button - top left */}
            <Pressable 
              onPress={(e) => {
                e.stopPropagation();
                onDislike();
              }}
              style={styles.cardActionButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={[styles.cardActionCircle, styles.cardDislikeCircle]}>
                <Ionicons name="close" size={28} color="white" />
              </View>
            </Pressable>

            {/* LIKE button - top right */}
            <Pressable 
              onPress={(e) => {
                e.stopPropagation();
                onLike();
              }}
              style={[styles.cardActionButton, styles.cardActionButtonRight]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={[styles.cardActionCircle, styles.cardLikeCircle]}>
                <Ionicons name="heart" size={28} color="white" />
              </View>
            </Pressable>
          </>
        )}

        <Pressable onPress={onViewProfile} style={styles.cardPressable}>
          {/* Swipe overlays */}
          <Animated.View style={[styles.swipeOverlay, styles.likeOverlay, likeOpacity]}>
            <Text style={styles.overlayText}>LIKED ❤️</Text>
          </Animated.View>

          <Animated.View style={[styles.swipeOverlay, styles.nopeOverlay, nopeOpacity]}>
            <Text style={styles.overlayText}>NOPE ✖️</Text>
          </Animated.View>

          <Animated.View style={[styles.swipeOverlay, styles.passOverlay, passOpacity]}>
            <Text style={styles.overlayText}>PASS ⏭️</Text>
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
              
              {/* INFO button - small, positioned on top right of avatar */}
              {isTop && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onViewProfile();
                  }}
                  style={styles.infoButtonOnAvatar}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="information-circle" size={32} color="#4299E1" />
                </Pressable>
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
  statusFilterBar: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    maxHeight: 60,
  },
  statusFilterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    alignItems: "center",
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statusChipActive: {
    backgroundColor: "#4299E1",
    borderColor: "#4299E1",
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  statusChipTextActive: {
    color: "white",
  },
  statusDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 8,
  },
  cardContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",  // Changed from center to show status bar
    paddingTop: 20,  // Add padding to lower cards and show status bar
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
  cardActionButton: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 10,
  },
  cardActionButtonRight: {
    left: undefined,
    right: 16,
  },
  cardActionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  cardDislikeCircle: {
    backgroundColor: "#EF4444",
  },
  cardLikeCircle: {
    backgroundColor: "#22C55E",
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
  passOverlay: {
    backgroundColor: "rgba(107, 114, 128, 0.85)", // Greyish tint
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
    position: "relative",  // For positioning INFO button
  },
  circularPhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#f3f4f6",
  },
  infoButtonOnAvatar: {
    position: "absolute",
    bottom: -5,
    right: -5,
    backgroundColor: "white",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
