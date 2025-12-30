import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";
import { Person } from "../api/specter";
import { PeopleStackParamList } from "../types/navigation";
import SignalCardV2 from "../components/ui/cards/SignalCardV2";
import { SkeletonSignalCard } from "../components/ui/skeleton/SkeletonCards";
import AddToListSheet from "../components/AddToListSheet";
import { GlassInput } from "../components/ui/glass/GlassInput";
import { useSignals, useSignalCount } from "../hooks/useSignals";
import { useLikeMutation } from "../hooks/useMutations";
import { useDebounce } from "../hooks/useDebounce";
import { FlashList } from "@shopify/flash-list";

type NavigationProp = NativeStackNavigationProp<PeopleStackParamList, "PeopleMain">;

export default function TalentSignalsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { colors } = theme;
  
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [listSheetPerson, setListSheetPerson] = useState<Person | null>(null);

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
  } = useSignals('TALENT', filters);

  const { data: countData } = useSignalCount('TALENT', filters);
  const likeMutation = useLikeMutation();

  const people = useMemo(() => 
    data?.pages.flatMap(page => page.items) || [], 
  [data]);

  const handlePersonPress = useCallback((person: Person) => {
    if (person.id) {
      navigation.navigate("PersonDetail", { personId: person.id });
    }
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
        <Text style={styles.emptyText}>No talent signals found</Text>
      </View>
    );
  };

  const renderSkeleton = () => (
    <View style={{ padding: 16 }}>
      {[1, 2, 3, 4, 5].map(i => <SkeletonSignalCard key={i} />)}
    </View>
  );

  return (
    <View style={[styles.container, Platform.OS === 'web' && { height: '100vh' }]}>
      <View style={styles.searchSection}>
        {countData?.count !== undefined && (
          <Text style={styles.countText}>{countData.count.toLocaleString()} signals found</Text>
        )}
        <GlassInput
          placeholder="Search talent signals..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon="search"
        />
      </View>

      <View style={{ flex: 1, minHeight: 300 }}>
        {isLoading ? renderSkeleton() : (
          <FlashList
            data={people}
            estimatedItemSize={200}
            keyExtractor={(item, index) => {
              const id = item.id || (item as any).person_id;
              return id ? `t-${id}-${index}` : `idx-${index}`;
            }}
            renderItem={({ item }) => (
              <SignalCardV2
                type="TALENT"
                item={item}
                onPress={() => handlePersonPress(item)}
                onLike={() => handleLike(item.id || item.person_id)}
                onDislike={() => handleDislike(item.id || item.person_id)}
                onAddToList={() => setListSheetPerson(item)}
              />
            )}
            contentContainerStyle={styles.listContent}
            removeClippedSubviews={true}
            initialNumToRender={10}
            refreshControl={
              <RefreshControl 
                refreshing={isRefreshing} 
                onRefresh={refetch} 
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={renderEmpty}
            onEndReached={() => hasNextPage && fetchNextPage()}
            onEndReachedThreshold={0.5}
            ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ margin: 20 }} color={colors.primary} /> : null}
            showsVerticalScrollIndicator={false}
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
    backgroundColor: theme.colors.background,
  },
  searchSection: {
    padding: 20,
    backgroundColor: theme.colors.content.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.content.border,
  },
  countText: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    marginBottom: 8,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.text.tertiary,
    fontSize: 16,
  }
});
