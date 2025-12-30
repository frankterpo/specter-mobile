import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, RefreshControl } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { FlashList } from "@shopify/flash-list";
import { colors } from "../theme/colors";
import { specterPublicAPI } from "../api/public-client";
import { useClerkToken } from "../hooks/useClerkToken";
import { useLikeMutation } from "../hooks/useMutations";
import CompanyCardV2 from "../components/ui/cards/CompanyCardV2";
import PersonCardV2 from "../components/ui/cards/PersonCardV2";
import {
  resolveSavedSearchProduct,
  resolveSavedSearchQueryId,
  SavedSearchProduct,
} from "../utils/savedSearches";

type RouteParams = {
  SavedSearchResults: {
    searchId: string;
    name?: string;
    product?: SavedSearchProduct;
    queryId?: string;
  };
};

const PAGE_LIMIT = 30;

function isPeopleProduct(product: SavedSearchProduct) {
  return product === "people" || product === "talent";
}

export default function SavedSearchResultsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "SavedSearchResults">>();
  const { getAuthToken } = useClerkToken();
  const likeMutation = useLikeMutation();

  const searchId = route.params?.searchId;
  const routeQueryId = resolveSavedSearchQueryId(route.params);

  const savedSearchesQuery = useQuery({
    queryKey: ["saved_searches"],
    queryFn: async () => {
      const token = await getAuthToken();
      if (!token) return [];
      return specterPublicAPI.searches.getAll(token);
    },
  });

  const savedSearch = useMemo(() => {
    if (!searchId) return null;
    return (savedSearchesQuery.data || []).find(
      (search: any) => String(search.id) === String(searchId)
    );
  }, [savedSearchesQuery.data, searchId]);

  const detailProduct = resolveSavedSearchProduct(savedSearch);
  const routeProduct = resolveSavedSearchProduct(route.params) as SavedSearchProduct;
  const routeResolvedProduct = route.params?.product || routeProduct;
  const baseProduct =
    detailProduct !== "unknown"
      ? detailProduct
      : routeResolvedProduct !== "unknown"
        ? routeResolvedProduct
        : "companies";

  const detailQueryId = resolveSavedSearchQueryId(savedSearch);
  const queryId = detailQueryId || routeQueryId;
  const searchName = savedSearch?.name || route.params?.name || "Saved Search";
  const [productOverride, setProductOverride] = useState<SavedSearchProduct | null>(null);
  const effectiveProduct = productOverride || baseProduct;
  const resolveProductPath = (value: SavedSearchProduct) => {
    if (value === "investors" || value === "strategic") return "investor-interest";
    if (value === "talent") return "talent";
    if (value === "people") return "people";
    return "companies";
  };

  const inferSupportedProduct = (message: string): SavedSearchProduct | null => {
    const match = message.match(/Only ['"]([^'"]+)['"]/i);
    if (!match) return null;
    const value = match[1].toLowerCase();
    if (value.includes("company")) return "companies";
    if (value.includes("people")) return "people";
    if (value.includes("talent")) return "talent";
    if (value.includes("investor")) return "investors";
    return null;
  };

  const pageBase = queryId ? 1 : 0;
  const resultsQuery = useInfiniteQuery({
    queryKey: ["saved_search_results", effectiveProduct, searchId, queryId],
    enabled: !!searchId,
    initialPageParam: pageBase,
    queryFn: async ({ pageParam = pageBase }) => {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      if (queryId) {
        if (isPeopleProduct(effectiveProduct)) {
          if (effectiveProduct === "talent") {
            return specterPublicAPI.people.getTalentSignals(token, {
              page: pageParam,
              limit: PAGE_LIMIT,
              queryId,
              searchId,
            });
          }
          return specterPublicAPI.people.getPeopleSignals(token, {
            page: pageParam,
            limit: PAGE_LIMIT,
            queryId,
            searchId,
          });
        }
        if (effectiveProduct === "companies") {
          return specterPublicAPI.companies.getCompanySignals(token, {
            page: pageParam,
            limit: PAGE_LIMIT,
            queryId,
            searchId,
          });
        }
      }
      return specterPublicAPI.searches.getSavedSearchResults(
        resolveProductPath(effectiveProduct),
        searchId,
        pageParam,
        PAGE_LIMIT,
        token,
        { queryId }
      );
    },
    getNextPageParam: (lastPage: any, allPages: any[]) => {
      const currentItems = lastPage?.items?.length || 0;
      if (currentItems < PAGE_LIMIT) return undefined;
      return pageBase + allPages.length;
    },
  });

  useEffect(() => {
    if (!resultsQuery.error) return;
    const message =
      resultsQuery.error instanceof Error
        ? resultsQuery.error.message
        : String(resultsQuery.error);
    const inferred = inferSupportedProduct(message);
    if (inferred && inferred !== effectiveProduct) {
      setProductOverride(inferred);
    }
  }, [resultsQuery.error, effectiveProduct]);

  const items = useMemo(
    () => resultsQuery.data?.pages.flatMap((page: any) => page.items || []) || [],
    [resultsQuery.data]
  );

  const handleCompanyPress = (company: any) => {
    const companyId = company.id || company.company_id;
    if (companyId) {
      navigation.navigate("CompanyDetail", { companyId, company });
    }
  };

  const handlePersonPress = (person: any) => {
    const personId = person.id || person.person_id;
    if (personId) {
      navigation.navigate("PersonDetail", { personId });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{searchName}</Text>
          <Text style={styles.subtitle}>
            {isPeopleProduct(effectiveProduct) ? "People search" : "Company search"}
          </Text>
        </View>
      </View>

      <FlashList
        data={items}
        estimatedItemSize={240}
        keyExtractor={(item, index) => item.id || `${index}`}
        renderItem={({ item }) =>
          isPeopleProduct(effectiveProduct) ? (
            <PersonCardV2
              person={item}
              onPress={() => handlePersonPress(item)}
              onLike={() => likeMutation.mutate({ id: item.id || item.person_id, type: "people" })}
              onDislike={() =>
                likeMutation.mutate({ id: item.id || item.person_id, type: "people", status: "disliked" })
              }
            />
          ) : (
            <CompanyCardV2
              company={item}
              onPress={() => handleCompanyPress(item)}
              onLike={() => likeMutation.mutate({ id: item.id || item.company_id, type: "company" })}
              onDislike={() =>
                likeMutation.mutate({ id: item.id || item.company_id, type: "company", status: "disliked" })
              }
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={resultsQuery.isFetching && !resultsQuery.isFetchingNextPage}
            onRefresh={resultsQuery.refetch}
            tintColor={colors.primary}
          />
        }
        onEndReached={() => resultsQuery.hasNextPage && resultsQuery.fetchNextPage()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          resultsQuery.isLoading ? null : (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={42} color={colors.text.tertiary} />
              <Text style={styles.emptyTitle}>No results yet</Text>
              <Text style={styles.emptySubtitle}>Try a different saved search.</Text>
            </View>
          )
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.borderLight,
    backgroundColor: colors.content.bg,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.content.bgSecondary,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  listContent: {
    padding: 16,
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: colors.text.tertiary,
    textAlign: "center",
  },
});
