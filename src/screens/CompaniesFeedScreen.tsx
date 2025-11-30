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
import { TabHeader, FilterBar, CompanyCard, SearchBar } from "../components/ui";
import { colors } from "../theme/colors";
import { Company, fetchCompanies, likeCompany, dislikeCompany } from "../api/specter";
import { CompaniesStackParamList } from "../types/navigation";

type NavigationProp = NativeStackNavigationProp<CompaniesStackParamList, "CompaniesFeed">;

export default function CompaniesFeedScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { getToken } = useAuth();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState<number | undefined>();
  const [sortBy, setSortBy] = useState("rank");
  const [activeView, setActiveView] = useState("feed");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const loadCompanies = useCallback(async (refresh = false) => {
    try {
      const token = await getToken();
      if (!token) return;

      const offset = refresh ? 0 : companies.length;
      const response = await fetchCompanies(token, {
        limit: 20,
        offset,
      });

      if (refresh) {
        setCompanies(response.items);
      } else {
        setCompanies((prev) => [...prev, ...response.items]);
      }

      setTotal(response.total);
      setHasMore(response.has_more ?? response.items.length === 20);
    } catch (error) {
      console.error("Failed to load companies:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [companies.length, getToken]);

  useEffect(() => {
    loadCompanies(true);
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadCompanies(true);
  }, [loadCompanies]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && !isLoading) {
      setIsLoadingMore(true);
      loadCompanies(false);
    }
  }, [isLoadingMore, hasMore, isLoading, loadCompanies]);

  const handleCompanyPress = useCallback((company: Company) => {
    const companyId = company.id || company.company_id;
    if (companyId) {
      navigation.navigate("CompanyDetail", { companyId });
    }
  }, [navigation]);

  const handleLike = useCallback(async (company: Company) => {
    try {
      const token = await getToken();
      if (!token) return;
      const companyId = company.id || company.company_id;
      if (companyId) {
        await likeCompany(token, companyId);
      }
    } catch (error) {
      console.error("Failed to like company:", error);
    }
  }, [getToken]);

  const handleDislike = useCallback(async (company: Company) => {
    try {
      const token = await getToken();
      if (!token) return;
      const companyId = company.id || company.company_id;
      if (companyId) {
        await dislikeCompany(token, companyId);
      }
    } catch (error) {
      console.error("Failed to dislike company:", error);
    }
  }, [getToken]);

  const renderCompanyCard = useCallback(({ item }: { item: Company }) => (
    <CompanyCard
      company={item}
      onPress={() => handleCompanyPress(item)}
      onLike={() => handleLike(item)}
      onDislike={() => handleDislike(item)}
    />
  ), [handleCompanyPress, handleLike, handleDislike]);

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
        <Text style={styles.emptyText}>No companies found</Text>
        <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
      </View>
    );
  }, [isLoading]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <TabHeader
        title="Companies"
        breadcrumbs={[
          { label: "Companies" },
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
        leftIcon="business"
      />

      {/* Search */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search companies..."
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

      {/* Company list */}
      {isLoading && companies.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.green} />
          <Text style={styles.loadingText}>Loading companies...</Text>
        </View>
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(item, index) =>
            item.id || item.company_id || `company-${index}`
          }
          renderItem={renderCompanyCard}
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

