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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { specterPublicAPI, Company } from "../api/public-client";
import { getFullName } from "../api/specter";
import { useClerkToken } from "../hooks/useClerkToken";
import { Company, StatusFilters } from "../api/specter";
import { CompaniesStackParamList } from "../types/navigation";
import CompanyCard from "../components/ui/CompanyCard";
import AddToListSheet from "../components/AddToListSheet";
import { specterPublicAPI } from "../api/public-client";

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
  const insets = useSafeAreaInsets();
  const { getAuthToken } = useClerkToken();

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
  const isLoadingRef = useRef(false);
  const isMountedRef = useRef(true);
  const currentPageRef = useRef(0);

  const loadCompanies = useCallback(async (refresh = false) => {
    if (isLoadingRef.current) {
      console.log("⏸️ [CompaniesFeed] Already loading, skipping");
      return;
    }
    isLoadingRef.current = true;

    try {
      setError(null);

      const page = refresh ? 0 : currentPageRef.current;

      console.log(`📤 [CompaniesFeed] Loading companies {"page": ${page}, "refresh": ${refresh}}`);

      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");

      // Load first 50 companies ranked (like in browser)
      const response = await specterPublicAPI.companies.getCompanySignals(
        token,
        {
          page: 0,
          limit: 50,
          // No pagination - load all 50 at once
        }
      );

      console.log(`📥 [CompaniesFeed] Loaded ${response.items?.length || 0} ranked companies:`, {
        total: response.total,
        hasMore: response.has_more,
      });

      // Replace all companies with the ranked results
        setCompanies(response.items);
      setTotal(response.total);
      setHasMore(false); // No more loading needed

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
      isLoadingRef.current = false;
      if (isMountedRef.current) {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
    }
  }, [getAuthToken]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setCompanies([]);
    companiesLengthRef.current = 0;
    isLoadingRef.current = false;
    loadCompanies(true);
  }, [activeFilter]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadCompanies(true);
  }, [loadCompanies]);

  // No pagination - we load all 50 ranked companies at once
  const handleLoadMore = useCallback(() => {
    // No-op since we load everything at once
  }, []);

  const handleCompanyPress = useCallback((company: Company) => {
    const companyId = company.id || company.company_id;
    if (companyId) {
      navigation.navigate("CompanyDetail", { companyId });
    }
  }, [navigation]);

  const handleLike = useCallback(async (company: Company) => {
    console.log("Like functionality coming soon");
  }, []);

  const handleDislike = useCallback(async (company: Company) => {
    console.log("Dislike functionality coming soon");
  }, []);

  const handleAddToList = useCallback((company: Company) => {
    setListSheetCompany(company);
  }, []);

  const filteredCompanies = companies.filter((c) => {
    if (!searchQuery) return true;
    const name = (c.name || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query);
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
        <Text style={styles.emptyText}>Companies Coming Soon</Text>
        <Text style={styles.emptySubtext}>Company data will be available in the next update</Text>
      </View>
    );
  }, [isLoading]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Companies</Text>
        {total !== undefined && total > 0 && (
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

      {/* Companies List */}
      {isLoading && companies.length === 0 && !error ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.green} />
        </View>
      ) : (
        <FlatList
          data={filteredCompanies}
          keyExtractor={(item, index) => item.id || item.company_id || `company-${index}`}
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
        entityName={listSheetCompany?.name || ""}
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
    color: colors.text.secondary,
    fontWeight: "500",
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
    paddingVertical: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 12,
    fontWeight: "500",
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 12,
    backgroundColor: colors.tag.red.bg,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.error,
    borderRadius: 6,
  },
  retryButtonText: {
    fontSize: 12,
    color: colors.text.inverse,
    fontWeight: "600",
  },
});
