import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Platform,
  ScrollView,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { Person } from "../api/specter";
import { PeopleStackParamList } from "../types/navigation";
import PersonCardV2 from "../components/ui/cards/PersonCardV2";
import { SkeletonPersonCard } from "../components/ui/skeleton/SkeletonCards";
import AddToListSheet from "../components/AddToListSheet";
import { GlassInput } from "../components/ui/glass/GlassInput";
import { useSignals, useSignalCount } from "../hooks/useSignals";
import { useLikeMutation } from "../hooks/useMutations";
import { useDebounce } from "../hooks/useDebounce";
import { FlashList } from "@shopify/flash-list";
import { useClerkToken } from "../hooks/useClerkToken";
import { useQuery } from "@tanstack/react-query";
import { specterPublicAPI } from "../api/public-client";
import { resolveSavedSearchProduct, resolveSavedSearchQueryId } from "../utils/savedSearches";
import { Ionicons } from "@expo/vector-icons";

type NavigationProp = NativeStackNavigationProp<PeopleStackParamList, "PeopleMain">;

export default function PeopleFeedScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [listSheetPerson, setListSheetPerson] = useState<Person | null>(null);
  const { getAuthToken } = useClerkToken();

  const filters = useMemo(() => ({
    search: debouncedSearch || undefined,
  }), [debouncedSearch]);

  const {
    data,
    isLoading,
    isRefreshing,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useSignals('PEOPLE', filters);

  const { data: countData } = useSignalCount('PEOPLE', filters);
  const likeMutation = useLikeMutation();

  const { data: savedSearches } = useQuery({
    queryKey: ["saved_searches"],
    queryFn: async () => {
      const token = await getAuthToken();
      if (!token) return [];
      return specterPublicAPI.searches.getAll(token);
    },
  });

  const peopleSearches = useMemo(
    () =>
      (savedSearches || []).filter((search: any) => {
        const product = resolveSavedSearchProduct(search);
        return product === "people" || product === "talent";
      }),
    [savedSearches]
  );

  const people = useMemo(() => 
    data?.pages.flatMap(page => page.items) || [], 
  [data]);

  const handlePersonPress = useCallback((person: Person) => {
    navigation.navigate("PersonDetail", { personId: person.id });
  }, [navigation]);

  const handleLike = useCallback((id: string) => {
    likeMutation.mutate({ id, type: 'people' });
  }, [likeMutation]);

  const handleDislike = useCallback((id: string) => {
    likeMutation.mutate({ id, type: 'people', status: 'disliked' });
  }, [likeMutation]);

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No people found</Text>
      </View>
    );
  };

  const renderSkeleton = () => (
    <View style={{ padding: 16 }}>
      {[1, 2, 3].map(i => <SkeletonPersonCard key={i} />)}
    </View>
  );

  return (
    <View style={[styles.container, Platform.OS === 'web' && { height: '100vh' }]}>
      <View style={styles.searchSection}>
        {countData?.count !== undefined && (
          <Text style={styles.countText}>{countData.count.toLocaleString()} people found</Text>
        )}
        <GlassInput
          placeholder="Search database..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon="search"
        />
        {peopleSearches.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.savedRow}
          >
            {peopleSearches.map((search: any) => (
              <Pressable
                key={search.id}
                style={styles.savedChip}
                onPress={() =>
                  navigation.navigate("SavedSearchResults", {
                    searchId: search.id,
                    name: search.name,
                    product: resolveSavedSearchProduct(search),
                    queryId: resolveSavedSearchQueryId(search),
                  })
                }
              >
                <Ionicons name="bookmark" size={14} color={colors.primary} />
                <Text style={styles.savedChipText}>{search.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

          <View style={{ flex: 1, minHeight: 300 }}>
            {isLoading ? renderSkeleton() : (
              <FlashList
                data={people}
                estimatedItemSize={250}
                keyExtractor={(item, index) => {
                  const id = item.id || (item as any).person_id;
                  return id ? `p-${id}-${index}` : `idx-${index}`;
                }}
                renderItem={({ item }) => (
                  <PersonCardV2
                    person={item}
                    onPress={() => handlePersonPress(item)}
                    onLike={() => handleLike(item.id)}
                    onDislike={() => handleDislike(item.id)}
                    onAddToList={() => setListSheetPerson(item)}
                  />
                )}
                ListEmptyComponent={renderEmpty}
                onEndReached={() => hasNextPage && fetchNextPage()}
                onEndReachedThreshold={0.5}
                removeClippedSubviews={true}
                initialNumToRender={10}
                refreshControl={
                  <RefreshControl 
                    refreshing={isRefreshing} 
                    onRefresh={refetch}
                    tintColor={colors.primary}
                  />
                }
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={isFetchingNextPage ? <SkeletonPersonCard /> : null}
              />
            )}
          </View>

      <AddToListSheet
        visible={listSheetPerson !== null}
        onClose={() => setListSheetPerson(null)}
        entityId={listSheetPerson?.id || ""}
        entityType="person"
        entityName={listSheetPerson ? (listSheetPerson.full_name || `${listSheetPerson.first_name} ${listSheetPerson.last_name}`) : ""}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchSection: {
    padding: 20,
    backgroundColor: colors.content.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.border,
  },
  countText: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginBottom: 8,
    fontWeight: '600',
  },
  savedRow: {
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  savedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary + "40",
    backgroundColor: colors.primary + "12",
  },
  savedChipText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.text.tertiary,
    fontSize: 16,
  }
});
