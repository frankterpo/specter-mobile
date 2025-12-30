import React, { useMemo } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../theme/colors";
import { specterPublicAPI } from "../api/public-client/client";
import { useClerkToken } from "../hooks/useClerkToken";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "../components/ui/glass/GlassCard";
import { FlashList } from "@shopify/flash-list";
import Animated, { FadeInLeft } from "react-native-reanimated";
import { resolveSavedSearchProduct, resolveSavedSearchQueryId } from "../utils/savedSearches";

export default function SavedSearchesScreen() {
  const navigation = useNavigation<any>();
  const { getAuthToken } = useClerkToken();

  const { data: searches, isLoading, refetch, isRefreshing, error } = useQuery({
    queryKey: ['saved_searches'],
    queryFn: async () => {
      const token = await getAuthToken();
      if (!token) return [];
      return specterPublicAPI.searches.getAll(token);
    },
  });

  const renderItem = ({ item, index }: { item: any, index: number }) => (
    <Animated.View entering={FadeInLeft.delay(index * 50)}>
      <Pressable
        onPress={() => {
          const product = resolveSavedSearchProduct(item);
          const queryId = resolveSavedSearchQueryId(item);
          const targetTab =
            product === "people" || product === "talent"
              ? "PeopleTab"
              : "CompaniesTab";
          navigation.navigate(targetTab, {
            screen: "SavedSearchResults",
            params: { searchId: item.id, name: item.name, product, queryId },
          });
        }}
      >
        <GlassCard style={styles.item}>
          <View style={styles.iconContainer}>
            <Ionicons name="search" size={20} color={colors.primary} />
          </View>
          <View style={styles.content}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{item.name}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{resolveSavedSearchProduct(item)}</Text>
              </View>
            </View>
            <Text style={styles.meta}>
              Saved {new Date(item.created_at || item.createdAt || Date.now()).toLocaleDateString()}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
        </GlassCard>
      </Pressable>
    </Animated.View>
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.text.tertiary} />
        <Text style={[styles.emptyText, { marginTop: 16 }]}>Saved searches unavailable</Text>
        <Text style={styles.emptySubtext}>
          Your account/API key may not have access to this endpoint yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={searches || []}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        estimatedItemSize={80}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={64} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No saved searches</Text>
            <Text style={styles.emptySubtext}>Your saved search criteria will appear here.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 20,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginVertical: 6,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.primary + "1A",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
  },
  meta: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
  },
  emptyText: {
    marginTop: 20,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtext: {
    marginTop: 8,
    color: colors.text.tertiary,
    fontSize: 14,
    textAlign: 'center',
  },
});
