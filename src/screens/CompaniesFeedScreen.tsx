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
  Company,
  fetchCompanies,
  likeCompany,
  dislikeCompany,
  StatusFilters,
} from "../api/specter";
import { CompaniesStackParamList } from "../types/navigation";
import CompanyCard from "../components/ui/CompanyCard";
import AddToListSheet from "../components/AddToListSheet";

type NavigationProp = NativeStackNavigationProp<CompaniesStackParamList, "CompaniesFeed">;

type StatusFilter = "all" | "not_viewed" | "liked" | "disliked";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "not_viewed", label: "New" },
  { id: "liked", label: "Liked" },
  { id: "disliked", label: "Passed" },
];

export default function CompaniesFeedScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState<number | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");
  const [listSheetCompany, setListSheetCompany] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const companiesLengthRef = useRef(0);

  const getStatusFilters = useCallback((): StatusFilters | undefined => {
    if (activeFilter === "all") return undefined;
    return { myStatus: activeFilter === "not_viewed" ? "not_viewed" : activeFilter };
  }, [activeFilter]);

  const loadCompanies = useCallback(async (refresh = false) => {
    try {
      setError(null);
      
      if (__DEV__) {
        console.log("🔄 [CompaniesFeed] Starting loadCompanies", { refresh, currentCount: companiesLengthRef.current });
      }
      
      const token = await getToken();
      if (!token) {
        const errorMsg = "Authentication required. Please sign in again.";
        console.error("❌ [CompaniesFeed] No token:", errorMsg);
        setError(errorMsg);
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
        return;
      }

      if (__DEV__) {
        console.log("✅ [CompaniesFeed] Token obtained:", token.substring(0, 20) + "...");
      }

      const offset = refresh ? 0 : companiesLengthRef.current;

      if (__DEV__) {
        console.log("📤 [CompaniesFeed] Calling fetchCompanies", { limit: 30, offset });
      }

      const response = await fetchCompanies(token, {
        limit: 30,
        offset,
        // Note: Company API may not support statusFilters yet
      });

      if (__DEV__) {
        console.log("📥 [CompaniesFeed] Response received:", {
          itemsCount: response.items?.length || 0,
          total: response.total,
          hasMore: response.has_more,
        });
      }

      if (refresh) {
        setCompanies(response.items);
        companiesLengthRef.current = response.items.length;
      } else {
        setCompanies((prev) => {
          const updated = [...prev, ...response.items];
          companiesLengthRef.current = updated.length;
          return updated;
        });
      }

      setTotal(response.total);
      setHasMore(response.has_more ?? response.items.length === 30);
    } catch (error: any) {
      console.error("❌ [CompaniesFeed] Failed to load companies:", error);
      console.error("❌ [CompaniesFeed] Error details:", {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });
      const errorMessage = error?.message || "Failed to load companies. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [getToken]);

  useEffect(() => {
    setIsLoading(true);
    setCompanies([]);
    loadCompanies(true);
  }, [activeFilter, loadCompanies]);

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
        // Update local state
        setCompanies((prev) =>
          prev.map((c) =>
            (c.id || c.company_id) === companyId
              ? { ...c, entity_status: { status: "liked" } } as Company
              : c
          )
        );
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
        // Update local state
        setCompanies((prev) =>
          prev.map((c) =>
            (c.id || c.company_id) === companyId
              ? { ...c, entity_status: { status: "disliked" } } as Company
              : c
          )
        );
      }
    } catch (error) {
      console.error("Failed to dislike company:", error);
    }
  }, [getToken]);

  const handleAddToList = useCallback((company: Company) => {
    setListSheetCompany(company);
  }, []);

  // Filter companies by search query
  const filteredCompanies = companies.filter((c) => {
    if (!searchQuery) return true;
    const name = (c.name || c.organization_name || "").toLowerCase();
    const industry = (c.industries?.[0] || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || industry.includes(query);
  });

  const renderCompanyCard = useCallback(({ item }: { item: Company }) => (
    <CompanyCard
      company={item}
      onPress={() => handleCompanyPress(item)}
      onLike={() => handleLike(item)}
      onDislike={() => handleDislike(item)}
      onAddToList={() => handleAddToList(item)}
    />
  ), [handleCompanyPress, handleLike, handleDislike, handleAddToList]);

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
        <Ionicons name="business-outline" size={48} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>No companies found</Text>
      </View>
    );
  }, [isLoading]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Companies</Text>
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
          placeholder="Search companies..."
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
          <Pressable onPress={() => loadCompanies(true)} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Company List */}
      {isLoading && companies.length === 0 && !error ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.green} />
        </View>
      ) : (
        <FlatList
          data={filteredCompanies}
          keyExtractor={(item, index) =>
            item.id || item.company_id || `company-${index}`
          }
          renderItem={renderCompanyCard}
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
        visible={listSheetCompany !== null}
        onClose={() => setListSheetCompany(null)}
        entityId={listSheetCompany?.id || listSheetCompany?.company_id || ""}
        entityType="company"
        entityName={listSheetCompany?.name || listSheetCompany?.organization_name || ""}
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
