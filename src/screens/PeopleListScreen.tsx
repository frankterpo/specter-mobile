import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  Person,
  getCurrentJob,
  getFullName,
  getInitials,
} from "../api/specter";
import { specterPublicAPI } from "../api/public-client";
import { colors } from "../theme/colors";
import { useClerkToken } from "../hooks/useClerkToken";

type MainStackParamList = {
  PeopleList: undefined;
  PersonDetail: { personId: string };
  Settings: undefined;
};

type PeopleListScreenProps = {
  navigation: NativeStackNavigationProp<MainStackParamList, "PeopleList">;
};

export default function PeopleListScreen({ navigation }: PeopleListScreenProps) {
  const insets = useSafeAreaInsets();
  const { getAuthToken } = useClerkToken();

  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const LIMIT = 50;

  useEffect(() => {
    loadPeople(0, false);
  }, []);

  const loadPeople = async (newOffset: number, isLoadMore: boolean) => {
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      const response = await specterPublicAPI.people.enrich({
        limit: LIMIT,
        offset: newOffset,
      }, token);

      const newPeople = response.items || [];

      if (isLoadMore) {
        setPeople((prev) => [...prev, ...newPeople]);
      } else {
        setPeople(newPeople);
      }

      setOffset(newOffset + LIMIT);
      setHasMore(response.has_more ?? newPeople.length === LIMIT);
    } catch (err: any) {
      console.error("Load people error:", err);
      setError(err.message || "Failed to load people");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadPeople(0, false);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      loadPeople(offset, true);
    }
  }, [isLoadingMore, hasMore, offset]);

  const handlePersonPress = useCallback(
    (person: Person) => {
      navigation.navigate("PersonDetail", { personId: person.id });
    },
    [navigation]
  );

  const renderPersonItem = useCallback(
    ({ item }: { item: Person }) => {
      const fullName = getFullName(item);
      const currentJob = getCurrentJob(item);
      const initials = getInitials(item);

      return (
        <Pressable
          style={({ pressed }) => [styles.personItem, pressed && styles.personItemPressed]}
          onPress={() => handlePersonPress(item)}
        >
          {item.profile_image_url ? (
            <Image
              source={{ uri: item.profile_image_url }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.personInfo}>
            <Text style={styles.personName}>{fullName}</Text>
            {currentJob && (
              <Text style={styles.personTitle} numberOfLines={1}>
                {currentJob.title} at {currentJob.org_name}
              </Text>
            )}
            {item.location && (
              <View style={styles.locationRow}>
                <Ionicons name="location" size={12} color={colors.text.tertiary} />
                <Text style={styles.locationText}>{item.location}</Text>
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
        </Pressable>
      );
    },
    [handlePersonPress]
  );

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
        <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>No people found</Text>
      </View>
    );
  }, [isLoading]);

  if (isLoading && people.length === 0) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.brand.green} />
      </View>
    );
  }

  if (error && people.length === 0) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle" size={48} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => loadPeople(0, false)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>People</Text>
        <Text style={styles.headerCount}>{people.length} loaded</Text>
      </View>

      <FlatList
        data={people}
        keyExtractor={(item, index) => item.id || `person-${index}`}
        renderItem={renderPersonItem}
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
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card.bg,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text.primary,
  },
  headerCount: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  personItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.borderLight,
  },
  personItemPressed: {
    backgroundColor: colors.content.bgSecondary,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    backgroundColor: colors.brand.green,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.inverse,
  },
  personInfo: {
    flex: 1,
    marginLeft: 12,
  },
  personName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
  },
  personTitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 12,
    color: colors.text.tertiary,
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
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.error,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: colors.brand.green,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.inverse,
  },
});
