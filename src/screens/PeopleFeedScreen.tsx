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
import { useAuth } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import {
  Person,
  fetchPeople,
  likePerson,
  dislikePerson,
  StatusFilters,
  getFullName,
} from "../api/specter";
import { PeopleStackParamList } from "../types/navigation";
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
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();

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
  const searchInputRef = useRef<TextInput>(null);
  const peopleLengthRef = useRef(0);

  const getStatusFilters = useCallback((): StatusFilters | undefined => {
    if (activeFilter === "all") return undefined;
    return { myStatus: activeFilter === "not_viewed" ? "not_viewed" : activeFilter };
  }, [activeFilter]);

  const loadPeople = useCallback(async (refresh = false) => {
    try {
      setError(null);
      
      if (__DEV__) {
        console.log("🔄 [PeopleFeed] Starting loadPeople", { refresh, currentCount: peopleLengthRef.current });
      }
      
      const token = await getToken();
      if (!token) {
        const errorMsg = "Authentication required. Please sign in again.";
        console.error("❌ [PeopleFeed] No token:", errorMsg);
        setError(errorMsg);
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
        return;
      }

      if (__DEV__) {
        console.log("✅ [PeopleFeed] Token obtained:", token.substring(0, 20) + "...");
      }

      const offset = refresh ? 0 : peopleLengthRef.current;

      const statusFilters = getStatusFilters();
      
      if (__DEV__) {
        console.log("📤 [PeopleFeed] Calling fetchPeople", { limit: 30, offset, statusFilters });
      }
      
      const response = await fetchPeople(token, {
        limit: 30,
        offset,
        statusFilters,
      });

      if (__DEV__) {
        console.log("📥 [PeopleFeed] Response received:", {
          itemsCount: response.items?.length || 0,
          total: response.total,
          hasMore: response.has_more,
        });
      }

      if (refresh) {
        setPeople(response.items);
        peopleLengthRef.current = response.items.length;
      } else {
        setPeople((prev) => {
          const updated = [...prev, ...response.items];
          peopleLengthRef.current = updated.length;
          return updated;
        });
      }

      setTotal(response.total);
      setHasMore(response.has_more ?? response.items.length === 30);
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
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [getToken, getStatusFilters]);

  useEffect(() => {
    setIsLoading(true);
    setPeople([]);
    loadPeople(true);
  }, [activeFilter, loadPeople]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadPeople(true);
  }, [loadPeople]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && !isLoading) {
      setIsLoadingMore(true);
      loadPeople(false);
    }
  }, [isLoadingMore, hasMore, isLoading, loadPeople]);

  const handlePersonPress = useCallback((person: Person) => {
    navigation.navigate("PersonDetail", { personId: person.id });
  }, [navigation]);

  const handleLike = useCallback(async (person: Person) => {
    try {
      const token = await getToken();
      if (!token) return;
      await likePerson(token, person.id);
      // Update local state
      setPeople((prev) =>
        prev.map((p) =>
          p.id === person.id
            ? { ...p, entity_status: { ...p.entity_status, status: "liked" as const } }
            : p
        )
      );
    } catch (error) {
      console.error("Failed to like person:", error);
    }
  }, [getToken]);

  const handleDislike = useCallback(async (person: Person) => {
    try {
      const token = await getToken();
      if (!token) return;
      await dislikePerson(token, person.id);
      // Update local state
      setPeople((prev) =>
        prev.map((p) =>
          p.id === person.id
            ? { ...p, entity_status: { ...p.entity_status, status: "disliked" as const } }
            : p
        )
      );
    } catch (error) {
      console.error("Failed to dislike person:", error);
    }
  }, [getToken]);

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
