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
import { Company } from "../api/specter";
import { InvestorsStackParamList } from "../types/navigation";
import SignalCardV2 from "../components/ui/cards/SignalCardV2";
import { SkeletonSignalCard } from "../components/ui/skeleton/SkeletonCards";
import AddToListSheet from "../components/AddToListSheet";
import { GlassInput } from "../components/ui/glass/GlassInput";
import { useSignals, useSignalCount } from "../hooks/useSignals";
import { useLikeMutation } from "../hooks/useMutations";
import { FlashList } from "@shopify/flash-list";

type NavigationProp = NativeStackNavigationProp<InvestorsStackParamList, "InvestorsMain">;

export default function StrategicSignalsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { colors } = theme;
  
  const [searchQuery, setSearchQuery] = useState("");
  const [listSheetCompany, setListSheetCompany] = useState<Company | null>(null);

  const filters = useMemo(() => ({
    search: searchQuery || undefined,
  }), [searchQuery]);

  const {
    data,
    isLoading,
    isRefreshing,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useSignals('STRATEGIC', filters);

  const { data: countData } = useSignalCount('STRATEGIC', filters);
  const likeMutation = useLikeMutation();

  const handleLike = (id: string) => {
    likeMutation.mutate({ id, type: 'company', status: 'liked' });
  };

  const handleDislike = (id: string) => {
    likeMutation.mutate({ id, type: 'company', status: 'disliked' });
  };

  const signals = useMemo(() => 
    data?.pages.flatMap(page => page.items) || [], 
  [data]);

  const handlePress = useCallback((item: any) => {
    const companyId = item.id || item.company_id;
    if (companyId) {
      // Navigate to company detail if it's a company signal
      // We might need to handle this across stacks or ensure CompanyDetail is in InvestorsStack
      console.log("Strategic signal pressed:", item);
    }
  }, []);

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No strategic signals found</Text>
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
          placeholder="Search strategic signals..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon="search"
        />
      </View>

      <View style={{ flex: 1, minHeight: 300 }}>
        {isLoading ? renderSkeleton() : (
          <FlashList
            data={signals}
            estimatedItemSize={200}
            keyExtractor={(item, index) => {
              const id = item.id || (item as any).company_id;
              return id ? `s-${id}-${index}` : `idx-${index}`;
            }}
            renderItem={({ item }) => (
              <SignalCardV2
                type="STRATEGIC"
                item={item}
                onPress={() => handlePress(item)}
                onLike={() => handleLike(item.id || item.company_id)}
                onDislike={() => handleDislike(item.id || item.company_id)}
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
        visible={listSheetCompany !== null}
        onClose={() => setListSheetCompany(null)}
        entityId={listSheetCompany?.id || ""}
        entityType="company"
        entityName={listSheetCompany?.name || ""}
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
