import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  TextInput,
  Pressable,
  Keyboard,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { specterPublicAPI, Person, FetchPeopleResponse } from "../api/public-client";
import { getFullName } from "../api/specter";
import { PeopleStackParamList } from "../types/navigation";
import { useClerkToken } from "../hooks/useClerkToken";
import PersonCard from "../components/ui/PersonCard";
import AddToListSheet from "../components/AddToListSheet";

type NavigationProp = NativeStackNavigationProp<PeopleStackParamList, "PeopleFeed">;

type StatusFilter = "all" | "not_viewed" | "liked" | "disliked";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "not_viewed", label: "New" },
  { id: "liked", label: "Liked" },
  { id: "disliked", label: "Passed" },
];

export default function PeopleFeedScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { getAuthToken } = useClerkToken();

  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState<number | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");
  const [listSheetPerson, setListSheetPerson] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);
  const [useLists, setUseLists] = useState<boolean>(true); // true = use lists, false = use searches, 'companies' = use companies
  const [initialized, setInitialized] = useState<boolean>(false);
  const searchInputRef = useRef<TextInput>(null);
  const currentPageRef = useRef(0); // Track current page (0-based)
  const isLoadingRef = useRef(false); // Guard against concurrent loads
  const isMountedRef = useRef(true); // Track if component is mounted

  // TODO: Re-enable status filters when user context is added
  // const getStatusFilters = useCallback((): StatusFilters | undefined => {
  //   if (activeFilter === "all") return undefined;
  //   return { myStatus: activeFilter === "not_viewed" ? "not_viewed" : activeFilter };
  // }, [activeFilter]);

  // Initialize: Use company connections to get people
  const initializeList = useCallback(async () => {
    try {
      if (__DEV__) {
        console.log("📋 [PeopleFeed] Initializing people signals...");
      }

      // Just set up the basic state - no API calls needed for initialization
      // The main loading will happen in loadPeople
      setInitialized(true);

      if (__DEV__) {
        console.log("✅ [PeopleFeed] Ready to load people signals");
      }

    } catch (error: any) {
      console.error("❌ [PeopleFeed] Failed to initialize:", error);
      setError("Failed to initialize people feed. Please try again.");
    }
  }, []);

  const loadPeople = useCallback(async (refresh = false) => {
    // Guard against concurrent loads
    if (isLoadingRef.current) {
      console.log("⏸️ [PeopleFeed] Already loading, skipping");
      return;
    }

    // If not initialized, initialize first
    if (!initialized) {
      await initializeList();
      return;
    }

    isLoadingRef.current = true;

    try {
      setError(null);
      
      const page = refresh ? 0 : currentPageRef.current;
      
      if (__DEV__) {
        console.log("🔄 [PeopleFeed] Starting loadPeople", {
          refresh,
          page,
          listId: currentListId,
          searchId: currentSearchId
        });
      }

      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");

      // Use people signals API (main endpoint from web app)
      const response = await specterPublicAPI.people.getPeopleSignals(
        token,
        {
          page: page,
          limit: 30,
          // Add filters here later if needed
        }
      );

      if (__DEV__) {
        console.log("📥 [PeopleFeed] Response received:", {
          itemsCount: response.items?.length || 0,
          total: response.total,
          hasMore: response.has_more,
      });
      }

      if (refresh) {
        setPeople(response.items);
        currentPageRef.current = 0;
      } else {
        setPeople((prev) => [...prev, ...response.items]);
      }

      setTotal(response.total);
      setHasMore(response.has_more ?? (response.items.length === 30));
      
      if (!refresh) {
        currentPageRef.current = page + 1;
      }
    } catch (error: any) {
      console.error("❌ [PeopleFeed] Failed to load people:", error);
      console.error("❌ [PeopleFeed] Error details:", {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });
      const errorMessage = error?.message || "Failed to load people. Please try again.";
      setError(errorMessage);
    } finally {
      isLoadingRef.current = false;
      if (isMountedRef.current) {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
    }
  }, [initialized, initializeList]);

  // Mount/unmount tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initialize list on mount
  useEffect(() => {
    initializeList();
  }, [initializeList]);

  // Load people when initialized
  useEffect(() => {
    if (initialized) {
      setIsLoading(true);
      setPeople([]);
      currentPageRef.current = 0;
      isLoadingRef.current = false; // Reset guard
      loadPeople(true);
    }
  }, [initialized, loadPeople]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    currentPageRef.current = 0;
    loadPeople(true);
  }, [loadPeople]);

  const handleLoadMore = useCallback(() => {
    // Don't load more if there's an error, or already loading, or no more data
    if (!isLoadingMore && hasMore && !isLoading && !error && people.length > 0) {
      setIsLoadingMore(true);
      loadPeople(false);
    }
  }, [isLoadingMore, hasMore, isLoading, error, people.length, loadPeople]);

  const handlePersonPress = useCallback((person: Person) => {
    navigation.navigate("PersonDetail", { personId: person.id });
  }, [navigation]);

  // TODO: Re-enable when user context is added
  const handleLike = useCallback(async (person: Person) => {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      await specterPublicAPI.people.like(person.id, token);
      setPeople((prev) =>
        prev.map((p) =>
          p.id === person.id
            ? {
                ...p,
                entity_status: {
                  ...(p.entity_status || {}),
                  status: "liked" as const,
                },
              }
            : p
        )
      );
    } catch (error) {
      console.error("Failed to like person:", error);
      // Show error to user if needed
    }
  }, []);

  const handleDislike = useCallback(async (person: Person) => {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      await specterPublicAPI.people.dislike(person.id, token);
      setPeople((prev) =>
        prev.map((p) =>
          p.id === person.id
            ? {
                ...p,
                entity_status: {
                  ...(p.entity_status || {}),
                  status: "disliked" as const,
                },
              }
            : p
        )
      );
    } catch (error) {
      console.error("Failed to dislike person:", error);
      // Show error to user if needed
    }
  }, []);

  const handleAddToList = useCallback((person: Person) => {
    setListSheetPerson(person);
  }, []);

  // Filter people by search query
  const filteredPeople = people.filter((p) => {
    if (!searchQuery) return true;
    const name = (p.full_name || `${p.first_name} ${p.last_name}`).toLowerCase();
    const company = p.experience?.[0]?.company_name?.toLowerCase() || "";
    const query = searchQuery.toLowerCase();
    return name.includes(query) || company.includes(query);
  });

  const renderPersonCard = useCallback(({ item }: { item: Person }) => (
    <PersonCard
      person={item}
      onPress={() => handlePersonPress(item)}
      onLike={() => handleLike(item)}
      onDislike={() => handleDislike(item)}
      onAddToList={() => handleAddToList(item)}
    />
  ), [handlePersonPress, handleLike, handleDislike, handleAddToList]);

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.brand.green} />
      </View>
    );
  }, [isLoadingMore]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>No people found</Text>
      </View>
    );
  }, [isLoading]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>People</Text>
        {total !== undefined && (
          <Text style={styles.count}>{total.toLocaleString()}</Text>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.text.tertiary} />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="Search people..."
          placeholderTextColor={colors.text.tertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
          </Pressable>
        )}
      </View>

      {/* Status Filter Chips */}
      <View style={styles.filterContainer}>
        {STATUS_FILTERS.map((filter) => (
          <Pressable
            key={filter.id}
            style={[
              styles.filterChip,
              activeFilter === filter.id && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter(filter.id)}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === filter.id && styles.filterChipTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => loadPeople(true)} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* People List */}
      {isLoading && people.length === 0 && !error ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.green} />
        </View>
      ) : (
        <FlatList
          data={filteredPeople}
          keyExtractor={(item, index) => item.id || `person-${index}`}
          renderItem={renderPersonCard}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.brand.green}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}

      {/* Add to List Sheet */}
      <AddToListSheet
        visible={listSheetPerson !== null}
        onClose={() => setListSheetPerson(null)}
        entityId={listSheetPerson?.id || ""}
        entityType="person"
        entityName={listSheetPerson ? getFullName(listSheetPerson) : ""}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text.primary,
  },
  count: {
    fontSize: 14,
    color: colors.text.secondary,
    backgroundColor: colors.content.bgSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.content.bgSecondary,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    padding: 0,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.content.bgSecondary,
  },
  filterChipActive: {
    backgroundColor: colors.brand.green,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    color: colors.text.inverse,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  footerLoader: {
    paddingVertical: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.secondary,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: colors.error,
    borderRadius: 6,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.inverse,
  },
});
