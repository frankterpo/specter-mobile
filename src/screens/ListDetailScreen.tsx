import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Pressable,
  Alert,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { specterPublicAPI } from "../api/public-client";
import { useClerkToken } from "../hooks/useClerkToken";
import { Person, FetchPeopleResponse } from "../api/specter";
import PersonCard from "../components/ui/PersonCard";
import { SkeletonCard } from "../components/ui/shadcn/SkeletonLoader";
import AddToListSheet from "../components/AddToListSheet";
import { ListsStackParamList } from "../types/navigation";

type RouteProps = RouteProp<ListsStackParamList, "ListDetail">;

export default function ListDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { getAuthToken } = useClerkToken();

  const { listId, listName } = route.params;
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showAddToList, setShowAddToList] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const loadPeople = useCallback(async (page: number = 0, isRefresh: boolean = false) => {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");

      if (page === 0) {
        setIsLoading(true);
      } else {
        setLoadingMore(true);
      }

      const response: FetchPeopleResponse = await specterPublicAPI.lists.getPeopleListResults(
        listId,
        page,
        30,
        token
      );

      if (isRefresh || page === 0) {
        setPeople(response.items || []);
      } else {
        setPeople(prev => [...prev, ...(response.items || [])]);
      }

      setHasMore((response.items?.length || 0) === 30);
      setCurrentPage(page);
      setError(null);
    } catch (err: any) {
      console.error("Failed to load list people:", err);
      setError(err.message || "Failed to load list contents");
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
      setIsRefreshing(false);
    }
  }, [listId]);

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadPeople(0, true);
  }, [loadPeople]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !isLoading) {
      loadPeople(currentPage + 1);
    }
  }, [loadingMore, hasMore, isLoading, currentPage, loadPeople]);

  const handlePersonPress = useCallback((person: Person) => {
    navigation.navigate("PersonDetail", { personId: person.id });
  }, [navigation]);

  const handleLike = useCallback(async (person: Person) => {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");

      await specterPublicAPI.people.like(person.id, token);

      setPeople(prev =>
        prev.map(p =>
          p.id === person.id ? { ...p, my_status: "liked" } : p
        )
      );
    } catch (err) {
      console.error("Like error:", err);
    }
  }, [getAuthToken]);

  const handleDislike = useCallback(async (person: Person) => {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");

      await specterPublicAPI.people.dislike(person.id, token);

      setPeople(prev =>
        prev.map(p =>
          p.id === person.id ? { ...p, my_status: "disliked" } : p
        )
      );
    } catch (err) {
      console.error("Dislike error:", err);
    }
  }, [getAuthToken]);

  const handleAddToList = useCallback((person: Person) => {
    setSelectedPerson(person);
    setShowAddToList(true);
  }, []);

  const handleRemoveFromList = useCallback(async (person: Person) => {
    Alert.alert(
      "Remove from List",
      `Remove ${person.first_name} ${person.last_name} from ${listName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getAuthToken();
              if (!token) throw new Error("Not authenticated");

              await specterPublicAPI.lists.removePersonFromList(listId, person.id, token);

              // Add haptic feedback
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

              // Remove from local state
              setPeople(prev => prev.filter(p => p.id !== person.id));
            } catch (err) {
              console.error("Remove from list error:", err);
              Alert.alert("Error", "Failed to remove person from list");
            }
          }
        }
      ]
    );
  }, [listId, listName, getAuthToken]);

  const renderPersonItem = useCallback(({ item }: { item: Person }) => (
    <PersonCard
      person={item}
      onPress={() => handlePersonPress(item)}
      onLike={() => handleLike(item)}
      onDislike={() => handleDislike(item)}
      onAddToList={() => handleAddToList(item)}
      onRemoveFromList={() => handleRemoveFromList(item)}
    />
  ), [handlePersonPress, handleLike, handleDislike, handleAddToList, handleRemoveFromList]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={48} color={colors.foregroundMuted} />
        <Text style={styles.emptyText}>No people in this list</Text>
        <Text style={styles.emptySubtext}>
          People will appear here when added to {listName}
        </Text>
      </View>
    );
  }, [isLoading, listName]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  }, [loadingMore]);

  if (isLoading && people.length === 0) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading list...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.foregroundInverse} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {listName}
          </Text>
          <Text style={styles.headerSubtitle}>
            {people.length} people
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.destructiveForeground} />
          <Text style={styles.errorBannerText}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => loadPeople(0, true)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Content */}
      {isLoading && people.length === 0 ? (
        <View style={styles.skeletonContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={people}
          keyExtractor={(item) => item.id}
          renderItem={renderPersonItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}

      <AddToListSheet
        visible={showAddToList}
        onClose={() => {
          setShowAddToList(false);
          setSelectedPerson(null);
        }}
        entityId={selectedPerson?.id || ""}
        entityType="person"
        entityName={selectedPerson ? `${selectedPerson.first_name} ${selectedPerson.last_name}` : ""}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.sidebar,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.foregroundInverse,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.foregroundMuted,
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.destructive,
    marginHorizontal: 20,
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    color: colors.destructiveForeground,
    fontSize: 12,
    fontWeight: "600",
  },
  retryButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.destructiveForeground,
    borderRadius: 6,
  },
  retryButtonText: {
    color: colors.destructive,
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  skeletonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.foregroundSecondary,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  footerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    color: colors.foregroundSecondary,
    fontWeight: "500",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.foregroundSecondary,
    fontWeight: "500",
  },
});