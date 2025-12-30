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
import { CompaniesStackParamList } from "../types/navigation";
import SignalCardV2 from "../components/ui/cards/SignalCardV2";
import { SkeletonSignalCard } from "../components/ui/skeleton/SkeletonCards";
import AddToListSheet from "../components/AddToListSheet";
import { GlassInput } from "../components/ui/glass/GlassInput";
import { useSignals, useSignalCount } from "../hooks/useSignals";
import { useLikeMutation } from "../hooks/useMutations";
import { useDebounce } from "../hooks/useDebounce";
import { FlashList } from "@shopify/flash-list";

type NavigationProp = NativeStackNavigationProp<CompaniesStackParamList, "CompaniesMain">;

export default function RevenueSignalsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { colors } = theme;
  
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [listSheetCompany, setListSheetCompany] = useState<Company | null>(null);

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
  } = useSignals('REVENUE', filters);

  const { data: countData } = useSignalCount('REVENUE', filters);
  const likeMutation = useLikeMutation();

  const companies = useMemo(() => 
    data?.pages.flatMap(page => page.items) || [], 
  [data]);

  const handleCompanyPress = useCallback((company: Company) => {
    const companyId = company.id || (company as any).company_id;
    if (companyId) {
      navigation.navigate("CompanyDetail", { companyId, company });
    }
  }, [navigation]);

  const handleLike = useCallback((id: string) => {
    likeMutation.mutate({ id, type: 'company' });
  }, [likeMutation]);

  const handleDislike = useCallback((id: string) => {
    likeMutation.mutate({ id, type: 'company', status: 'disliked' });
  }, [likeMutation]);

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No revenue signals found</Text>
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
          placeholder="Search revenue signals..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon="search"
        />
      </View>

      <View style={{ flex: 1, minHeight: 300 }}>
        {isLoading ? renderSkeleton() : (
          <FlashList
            data={companies}
            estimatedItemSize={200}
            keyExtractor={(item, index) => {
              const id = item.id || (item as any).company_id;
              return id ? `r-${id}-${index}` : `idx-${index}`;
            }}
            renderItem={({ item }) => (
              <SignalCardV2
                type="REVENUE"
                item={item}
                onPress={() => handleCompanyPress(item)}
                onLike={() => handleLike(item.id || item.company_id)}
                onDislike={() => handleDislike(item.id || item.company_id)}
                onAddToList={() => setListSheetCompany(item)}
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
