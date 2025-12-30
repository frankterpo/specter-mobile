import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";
import { InvestorsStackParamList } from "../types/navigation";
import SignalCardV2 from "../components/ui/cards/SignalCardV2";
import { SkeletonSignalCard } from "../components/ui/skeleton/SkeletonCards";
import { GlassInput } from "../components/ui/glass/GlassInput";
import { useSignals, useSignalCount } from "../hooks/useSignals";
import { useLikeMutation } from "../hooks/useMutations";
import { useDebounce } from "../hooks/useDebounce";
import { FlashList } from "@shopify/flash-list";

type NavigationProp = NativeStackNavigationProp<InvestorsStackParamList, "InvestorsMain">;

export default function InvestorsFeedScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { colors } = theme;
  
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);

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
  } = useSignals('INVESTORS', filters);

  const { data: countData } = useSignalCount('INVESTORS', filters);
  const likeMutation = useLikeMutation();

  const handleLike = (id: string) => {
    likeMutation.mutate({ id, type: 'investors', status: 'liked' });
  };

  const handleDislike = (id: string) => {
    likeMutation.mutate({ id, type: 'investors', status: 'disliked' });
  };

  const investors = useMemo(() => 
    data?.pages.flatMap(page => page.items) || [], 
  [data]);

  const handleInvestorPress = useCallback((investor: any) => {
    const investorId = investor.id || investor.investor_id;
    if (investorId) {
      navigation.navigate("InvestorDetail", { investorId, investor });
    }
  }, [navigation]);

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No investors found</Text>
      </View>
    );
  };

  const renderSkeleton = () => (
    <View style={{ padding: 16 }}>
      {[1, 2, 3, 4, 5].map(i => <SkeletonSignalCard key={i} />)}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchSection}>
        {countData?.count !== undefined && (
          <Text style={styles.countText}>{countData.count.toLocaleString()} investors found</Text>
        )}
        <GlassInput
          placeholder="Search investors..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon="search"
        />
      </View>

      {isLoading ? renderSkeleton() : (
        <FlashList
          data={investors}
          estimatedItemSize={180}
          keyExtractor={(item, index) => item.id || item.investor_id || `i-${index}`}
          renderItem={({ item }) => (
            <SignalCardV2
              type="STRATEGIC" // Using STRATEGIC card for generic investors for now
              item={item}
              onPress={() => handleInvestorPress(item)}
              onLike={() => handleLike(item.id || item.investor_id)}
              onDislike={() => handleDislike(item.id || item.investor_id)}
            />
          )}
          contentContainerStyle={styles.listContent}
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
