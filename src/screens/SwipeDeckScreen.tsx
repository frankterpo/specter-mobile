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
  SafeAreaView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useAuth } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import FilterModal, { FilterOptions } from "../components/FilterModal";
import ListModal from "../components/ListModal";
import { useModelStatus } from "../context/AgentContext";
import { getAgentMemory } from "../ai/agentMemory";
import {
  fetchPeople,
  likePerson,
  dislikePerson,
  markAsViewed,
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
  
  // AI Model status (pre-warming happens in AgentContext)
  const { status: modelStatus, progress: modelProgress, isReady: modelReady } = useModelStatus();

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

  const LIMIT = 50; 

  useEffect(() => {
    loadPeople(0, true); 
  }, []);

  useEffect(() => {
    if (route.params?.updatedPerson) {
      const updatedPerson = route.params.updatedPerson;
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
      navigation.setParams({ updatedPerson: undefined } as any);
    }
  }, [route.params?.updatedPerson]);

  useEffect(() => {
    const halfwayPoint = Math.floor(cards.length / 2);
    if (cards.length > 0 && currentIndex >= halfwayPoint && !isLoadingMore && hasMore) {
      loadMorePeople();
    }
  }, [currentIndex]);

  const loadPeople = async (newOffset: number, replace: boolean = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new AuthError("Authentication required. Please sign in.");
      }

      const response = await fetchPeople(token, {
        limit: LIMIT,
        offset: newOffset,
        filters,
        statusFilters,
      });

      if (!Array.isArray(response.items)) {
        throw new Error("Invalid server response");
      }

      if (response.query_id && replace) {
        setCurrentQueryId(response.query_id);
      }

      const newCards = response.items.filter(p => p && p.id && !seenPersonIds.has(p.id));
      const newIds = new Set([...seenPersonIds, ...newCards.map(p => p.id)]);

      if (replace) {
        setCards(newCards);
        setCurrentIndex(0);
        setSeenPersonIds(new Set(newCards.map(p => p.id)));
      } else {
        setCards((prev) => [...prev, ...newCards]);
        setSeenPersonIds(newIds);
      }
      setOffset(newOffset);
      setHasMore(response.items.length >= LIMIT);
    } catch (err: any) {
      if (err instanceof AuthError || err.message?.includes("Auth")) {
        setError("Authentication expired. Please sign in again.");
      } else {
        setError(err.message || "Failed to load people");
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

      const response = await fetchPeople(token, {
        limit: LIMIT,
        offset: nextOffset,
        ...(currentQueryId ? { queryId: currentQueryId } : { filters, statusFilters }),
      });

      const newCards = response.items.filter(p => !seenPersonIds.has(p.id));
      const newIds = new Set([...seenPersonIds, ...newCards.map(p => p.id)]);

      setCards((prev) => [...prev, ...newCards]);
      setSeenPersonIds(newIds);
      setOffset(nextOffset);
      setHasMore(response.items.length >= LIMIT);
    } catch (err: any) {
      if (err instanceof AuthError) {
        setError("Authentication expired. Please sign in again.");
      }
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleLike = async (person: Person) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const personId = person.id;
    const currentIdx = currentIndex;
    
    setCards(prevCards => 
      prevCards.map((card, idx) => {
        if (idx === currentIdx && card.id === personId) {
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

    try {
      const token = await getToken();
      if (token) {
        await likePerson(token, personId);
      }
      
      // MEMORY: Record like in agent memory for AI personalization
      const memory = getAgentMemory();
      await memory.load();
      memory.recordLike(
        { id: personId, name: person.full_name || `${person.first_name} ${person.last_name}` },
        `Liked from swipe deck`
      );
      
      // Learn preferences from person attributes
      const currentJob = person.experience?.find(e => e.is_current);
      if (currentJob?.industry) {
        memory.learnPreference('industry', currentJob.industry, `Liked ${person.full_name}`);
      }
      if (person.seniority) {
        memory.learnPreference('seniority', person.seniority, `Liked ${person.full_name}`);
      }
      if (person.region) {
        memory.learnPreference('region', person.region, `Liked ${person.full_name}`);
      }
    } catch (err) {
      // Error handled silently as state is optimistic
    }

    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
    }, 300);
  };

  const handleDislike = async (person: Person) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const personId = person.id;
    const currentIdx = currentIndex;
    
    setCards(prevCards => 
      prevCards.map((card, idx) => {
        if (idx === currentIdx && card.id === personId) {
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

    try {
      const token = await getToken();
      if (token) {
        await dislikePerson(token, personId);
      }
      
      // MEMORY: Record dislike in agent memory
      const memory = getAgentMemory();
      await memory.load();
      memory.recordDislike(
        { id: personId, name: person.full_name || `${person.first_name} ${person.last_name}` },
        `Disliked from swipe deck`
      );
    } catch (err) {
        // Error handled silently as state is optimistic
    }

    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
    }, 300);
  };

  const handlePass = async (person: Person) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const personId = person.id;
    const currentIdx = currentIndex;
    
    setCards(prevCards => 
      prevCards.map((card, idx) => {
        if (idx === currentIdx && card.id === personId) {
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

    try {
      const token = await getToken();
      if (token) {
        await markAsViewed(token, personId);
      }
    } catch (err) {
        // Error handled silently as state is optimistic
    }

    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
    }, 300);
  };

  const handleViewProfile = async (person: Person) => {
    navigation.navigate("PersonDetail", { personId: person.id });
  };

  const handleAddToList = (person: Person) => {
    setSelectedPerson(person);
    setListModalVisible(true);
  };

  const handleApplyFilters = (newFilters: FilterOptions) => {
    setFilters(newFilters);
    setSeenPersonIds(new Set());
    setHasMore(true);
    setOffset(0);
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

  const toggleStatusFilter = (filterType: keyof StatusFilters, value: any) => {
    setStatusFilters(prev => {
      const newFilters = { ...prev };
      if (newFilters[filterType] === value) {
        delete newFilters[filterType];
      } else {
        newFilters[filterType] = value;
      }
      return newFilters;
    });
    loadPeople(0, true);
  };

  const renderEmptyState = () => (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Ionicons name="prism" size={20} color="#1a365d" />
          </View>
          <Text style={styles.logo}>Specter</Text>
          {/* AI Model Status Indicator */}
          {modelStatus === 'downloading' && (
            <View style={styles.aiStatusBadge}>
              <ActivityIndicator size={10} color="#38BDF8" />
              <Text style={styles.aiStatusText}>AI {modelProgress}%</Text>
            </View>
          )}
          {modelStatus === 'initializing' && (
            <View style={styles.aiStatusBadge}>
              <ActivityIndicator size={10} color="#38BDF8" />
              <Text style={styles.aiStatusText}>AI Init</Text>
            </View>
          )}
          {modelReady && (
            <View style={[styles.aiStatusBadge, styles.aiStatusReady]}>
              <Ionicons name="sparkles" size={10} color="#22C55E" />
              <Text style={[styles.aiStatusText, { color: '#22C55E' }]}>AI</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <Pressable 
            onPress={() => setFilterModalVisible(true)} 
            style={[styles.iconButton, hasActiveFilters() && styles.iconButtonActive]}
          >
            <Ionicons 
              name="options-outline" 
              size={22} 
              color={hasActiveFilters() ? "#1a365d" : "#64748b"} 
            />
            {hasActiveFilters() && <View style={styles.filterBadge} />}
          </Pressable>
          <Pressable onPress={() => navigation.navigate("Settings")} style={styles.iconButton}>
            <Ionicons name="settings-outline" size={22} color="#64748b" />
          </Pressable>
        </View>
      </View>

      <View style={styles.centerContent}>
        <View style={styles.emptyStateIcon}>
          <Ionicons name={error ? "alert-circle-outline" : "checkmark-circle-outline"} size={64} color="#cbd5e1" />
        </View>
        <Text style={styles.emptyTitle}>
          {error ? "Connection Issue" : "All Caught Up"}
        </Text>
        <Text style={styles.emptySubtitle}>
          {error 
            ? "We couldn't load the profiles. Please check your internet connection and try again." 
            : "You've reviewed all available profiles matching your filters."}
        </Text>
        <Pressable 
          onPress={() => loadPeople(0, true)} 
          style={({pressed}) => [styles.retryButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.retryButtonText}>
            {error ? "Try Again" : "Refresh Feed"}
          </Text>
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

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#1a365d" />
        <Text style={styles.loadingText}>Loading profiles...</Text>
      </View>
    );
  }

  if (error || (cards.length === 0 && !isLoading) || (currentIndex >= cards.length && !isLoadingMore)) {
    return renderEmptyState();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Ionicons name="prism" size={20} color="#1a365d" />
          </View>
          <Text style={styles.logo}>Specter</Text>
          {/* AI Model Status Indicator */}
          {modelStatus === 'downloading' && (
            <View style={styles.aiStatusBadge}>
              <ActivityIndicator size={10} color="#38BDF8" />
              <Text style={styles.aiStatusText}>AI {modelProgress}%</Text>
            </View>
          )}
          {modelStatus === 'initializing' && (
            <View style={styles.aiStatusBadge}>
              <ActivityIndicator size={10} color="#38BDF8" />
              <Text style={styles.aiStatusText}>AI Init</Text>
            </View>
          )}
          {modelReady && (
            <View style={[styles.aiStatusBadge, styles.aiStatusReady]}>
              <Ionicons name="sparkles" size={10} color="#22C55E" />
              <Text style={[styles.aiStatusText, { color: '#22C55E' }]}>AI</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <Pressable 
            onPress={() => setFilterModalVisible(true)} 
            style={[styles.iconButton, hasActiveFilters() && styles.iconButtonActive]}
          >
            <Ionicons 
              name="options-outline" 
              size={22} 
              color={hasActiveFilters() ? "#1a365d" : "#64748b"} 
            />
            {hasActiveFilters() && <View style={styles.filterBadge} />}
          </Pressable>
          <Pressable onPress={() => navigation.navigate("Settings")} style={styles.iconButton}>
            <Ionicons name="settings-outline" size={22} color="#64748b" />
          </Pressable>
          {__DEV__ && (
            <Pressable onPress={() => (navigation as any).navigate("Diagnostics")} style={styles.iconButton}>
              <Ionicons name="bug-outline" size={22} color="#EF4444" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Status Filter Bar */}
      <View style={styles.filterBarWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.statusFilterBar}
          contentContainerStyle={styles.statusFilterContent}
        >
          <Pressable
            onPress={() => toggleStatusFilter('myStatus', 'not_viewed')}
            style={[
              styles.statusChip,
              statusFilters.myStatus === 'not_viewed' && styles.statusChipActive
            ]}
          >
            <Text style={[
              styles.statusChipText,
              statusFilters.myStatus === 'not_viewed' && styles.statusChipTextActive
            ]}>
              New
            </Text>
          </Pressable>

          <Pressable
            onPress={() => toggleStatusFilter('myStatus', 'viewed')}
            style={[
              styles.statusChip,
              statusFilters.myStatus === 'viewed' && styles.statusChipActive
            ]}
          >
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
            <Text style={[
              styles.statusChipText,
              statusFilters.myStatus === 'liked' && styles.statusChipTextActive
            ]}>
              Liked
            </Text>
          </Pressable>

          <View style={styles.statusDivider} />

          <Pressable
            onPress={() => toggleStatusFilter('teamLiked', !statusFilters.teamLiked)}
            style={[
              styles.statusChip,
              statusFilters.teamLiked && styles.statusChipActive
            ]}
          >
            <Text style={[
              styles.statusChipText,
              statusFilters.teamLiked && styles.statusChipTextActive
            ]}>
              Team Picks
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      <View style={styles.cardContainer}>
        {cards
          .slice(currentIndex, currentIndex + 3)
          .filter(person => person && person.id) 
          .reverse()
          .map((person, index) => {
            const reverseIndex = 2 - index;
            const isTop = reverseIndex === 0;
            
            try {
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
            } catch (err) {
              console.error("Card render error for person:", person.id, err);
              return null;
            }
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
  if (!person || !person.id) {
    return null;
  }

  const currentJob = getCurrentJob(person.experience || []);
  const fullName = person.full_name || getFullName(person);
  const initials = getInitials(person);

  const renderStatusBadge = () => {
    if (!person.entity_status || !person.entity_status.status) return null;

    const status = person.entity_status.status;
    
    let text = "";
    if (status === "liked") text = "You've liked this";
    else if (status === "disliked") text = "You've passed";
    else if (status === "viewed") text = "You've viewed this";

    if (!text) return null;

    return (
      <View style={styles.statusBadge}>
        <Ionicons name="checkmark-circle" size={14} color="#64748b" />
        <Text style={styles.statusBadgeText}>{text}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.card, { zIndex: 3 - index, top: index * 8, transform: [{ scale: 1 - index * 0.04 }] }]}>
        {/* Action buttons positioned ON the card */}
        {isTop && (
          <>
            {/* NOPE button */}
            <Pressable 
              onPress={(e) => {
                e.stopPropagation();
                onDislike();
              }}
              style={styles.cardActionButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={[styles.cardActionCircle, styles.cardDislikeCircle]}>
                <Ionicons name="close" size={24} color="#64748b" />
              </View>
            </Pressable>

            {/* LIKE button */}
            <Pressable 
              onPress={(e) => {
                e.stopPropagation();
                onLike();
              }}
              style={[styles.cardActionButton, styles.cardActionButtonRight]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={[styles.cardActionCircle, styles.cardLikeCircle]}>
                <Ionicons name="heart" size={24} color="#1a365d" />
              </View>
            </Pressable>
          </>
        )}

        <Pressable onPress={onViewProfile} style={styles.cardPressable}>
          <View style={styles.newCardContent}>
            <View style={styles.cardHeader}>
              {/* Name & Badge */}
              <View>
                <Text style={styles.cardName} numberOfLines={1}>{fullName}</Text>
                {renderStatusBadge()}
              </View>
              
              {/* Avatar */}
              <View style={styles.avatarContainer}>
                {person.profile_image_url ? (
                  <Image
                    source={{ uri: person.profile_image_url }}
                    style={styles.avatar}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Tagline */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Tagline</Text>
              <Text style={styles.fieldValue} numberOfLines={2}>
                {person.tagline || "No tagline available"}
              </Text>
            </View>

            {/* Experience */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Current Experience</Text>
              <Text style={styles.fieldValue} numberOfLines={1}>
                {currentJob ? `${currentJob.title} • ${currentJob.company_name}` : "Unknown"}
              </Text>
            </View>

            {/* Region & Seniority Row */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Region</Text>
                <Text style={styles.fieldValue}>{person.region || "Unknown"}</Text>
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Seniority</Text>
                <Text style={styles.fieldValue}>{person.seniority || "Unknown"}</Text>
              </View>
            </View>

            {/* Stats Row */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Followers</Text>
                <Text style={styles.fieldValue}>
                  {person.followers_count ? Number(person.followers_count).toLocaleString() : "-"}
                </Text>
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Connections</Text>
                <Text style={styles.fieldValue}>
                  {person.connections_count ? Number(person.connections_count).toLocaleString() : "-"}
                </Text>
              </View>
            </View>

          </View>
        </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6", // Light gray bg
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a365d",
    letterSpacing: -0.5,
  },
  aiStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  aiStatusReady: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  aiStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#38BDF8',
  },
  headerRight: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonActive: {
    backgroundColor: "#f8fafc",
    borderColor: "#1a365d",
  },
  filterBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#1a365d",
  },
  filterBarWrapper: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    height: 52,
  },
  statusFilterBar: {
    height: 52,
  },
  statusFilterContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
    height: 52,
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  statusChipActive: {
    backgroundColor: "#1a365d",
    borderColor: "#1a365d",
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  statusChipTextActive: {
    color: "white",
  },
  statusDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#e5e7eb",
    marginHorizontal: 4,
  },
  cardContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 20,
  },
  card: {
    position: "absolute",
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.62,
    borderRadius: 24,
    backgroundColor: "white",
    // Shadow lg
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardActionButton: {
    position: "absolute",
    bottom: 20,
    left: 20,
    zIndex: 10,
  },
  cardActionButtonRight: {
    left: undefined,
    right: 20,
  },
  cardActionCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  cardDislikeCircle: {
    // default white
  },
  cardLikeCircle: {
    // default white
  },
  cardPressable: {
    flex: 1,
  },
  newCardContent: {
    flex: 1,
    padding: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  avatarContainer: {
    marginLeft: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  avatarPlaceholder: {
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: "600",
    color: "#64748b",
  },
  cardName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a365d",
    marginBottom: 6,
    maxWidth: 200,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginBottom: 20,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 15,
    color: "#334155",
    fontWeight: "500",
    lineHeight: 22,
  },
  loadingMore: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
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
  emptyStateIcon: {
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a365d",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: "#1a365d",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
