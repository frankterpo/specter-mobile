import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "@clerk/clerk-expo";
import { TabHeader, FilterBar, PersonCard, SearchBar } from "../components/ui";
import { colors } from "../theme/colors";
import { Person, fetchPeople, likePerson, dislikePerson } from "../api/specter";
import { PeopleStackParamList } from "../types/navigation";

type NavigationProp = NativeStackNavigationProp<PeopleStackParamList, "PeopleFeed">;

export default function PeopleFeedScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { getToken } = useAuth();

  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState<number | undefined>();
  const [sortBy, setSortBy] = useState("rank");
  const [activeView, setActiveView] = useState("feed");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const loadPeople = useCallback(async (refresh = false) => {
    try {
      const token = await getToken();
      if (!token) return;

      const offset = refresh ? 0 : people.length;
      const response = await fetchPeople(token, {
        limit: 20,
        offset,
      });

      if (refresh) {
        setPeople(response.items);
      } else {
        setPeople((prev) => [...prev, ...response.items]);
      }

      setTotal(response.total);
      setHasMore(response.has_more ?? response.items.length === 20);
    } catch (error) {
      console.error("Failed to load people:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [people.length, getToken]);

  useEffect(() => {
    loadPeople(true);
  }, []);

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
            ? { ...p, entity_status: { ...p.entity_status, status: "liked" } }
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
            ? { ...p, entity_status: { ...p.entity_status, status: "disliked" } }
            : p
        )
      );
    } catch (error) {
      console.error("Failed to dislike person:", error);
    }
  }, [getToken]);

  const renderPersonCard = useCallback(({ item }: { item: Person }) => (
    <PersonCard
      person={item}
      onPress={() => handlePersonPress(item)}
      onLike={() => handleLike(item)}
      onDislike={() => handleDislike(item)}
    />
  ), [handlePersonPress, handleLike, handleDislike]);

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
        <Text style={styles.emptyText}>No people found</Text>
        <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
      </View>
    );
  }, [isLoading]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <TabHeader
        title="People"
        breadcrumbs={[
          { label: "People" },
          { label: "Database" },
        ]}
        viewOptions={[
          { id: "feed", label: "Feed", icon: "grid-outline" },
          { id: "table", label: "Table", icon: "list-outline" },
        ]}
        activeView={activeView}
        onViewChange={setActiveView}
        totalCount={total}
        isLoading={isLoading}
        leftIcon="people"
      />

      {/* Search */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search people..."
        />
      </View>

      {/* Filter bar */}
      <FilterBar
        sortBy={sortBy}
        onSortChange={setSortBy}
        activeFilters={activeFilters}
        onFilterPress={(filterId) => {
          setActiveFilters((prev) =>
            prev.includes(filterId)
              ? prev.filter((f) => f !== filterId)
              : [...prev, filterId]
          );
        }}
        onAddFilter={() => {}}
        onClearFilters={() => setActiveFilters([])}
      />

      {/* People list */}
      {isLoading && people.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.green} />
          <Text style={styles.loadingText}>Loading people...</Text>
        </View>
      ) : (
        <FlatList
          data={people}
          keyExtractor={(item) => item.id}
          renderItem={renderPersonCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.content.bgSecondary,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.content.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.border,
  },
  listContent: {
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  footerLoader: {
    paddingVertical: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.secondary,
  },
});

