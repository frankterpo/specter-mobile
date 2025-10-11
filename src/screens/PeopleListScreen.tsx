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
import { useAuth, useUser } from "@clerk/clerk-expo";
import {
  fetchPeople,
  Person,
  getCurrentJob,
  getFullName,
  getInitials,
} from "../api/specter";

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
  const { getToken } = useAuth();
  const { user } = useUser();

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
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication required. Please sign in again.");
      }

      const response = await fetchPeople(token, {
        limit: LIMIT,
        offset: newOffset,
      });

      if (isLoadMore) {
        setPeople((prev) => [...prev, ...response.items]);
      } else {
        setPeople(response.items);
      }

      setOffset(newOffset);
      setHasMore(response.has_more !== false && response.items.length === LIMIT);
    } catch (err: any) {
      setError(err.message || "Failed to load people");
      console.error("Load people error:", err);
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
    if (!isLoadingMore && !isLoading && hasMore) {
      loadPeople(offset + LIMIT, true);
    }
  }, [isLoadingMore, isLoading, hasMore, offset]);

  const handleRetry = () => {
    loadPeople(0, false);
  };

  const renderPersonCard = ({ item }: { item: Person }) => {
    const fullName = getFullName(item);
    const initials = getInitials(item);
    const currentJob = getCurrentJob(item.experience);

    return (
      <Pressable
        onPress={() => navigation.navigate("PersonDetail", { personId: item.id })}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.cardContent}>
          {/* Profile Image */}
          {item.profile_image_url ? (
            <Image
              source={{ uri: item.profile_image_url }}
              style={styles.avatar}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}

          {/* Person Info */}
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>
              {fullName}
            </Text>
            
            {currentJob && (
              <Text style={styles.job} numberOfLines={1}>
                {currentJob.title} at {currentJob.company_name}
              </Text>
            )}
            
            {item.tagline && (
              <Text style={styles.tagline} numberOfLines={2}>
                {item.tagline}
              </Text>
            )}
            
            {item.location && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color="#94a3b8" />
                <Text style={styles.location} numberOfLines={1}>
                  {item.location}
                </Text>
              </View>
            )}
          </View>

          {/* Chevron */}
          <Ionicons name="chevron-forward" size={20} color="#cbd5e1" style={styles.chevron} />
        </View>
      </Pressable>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyState}>
        <Ionicons name="people-outline" size={64} color="#cbd5e1" />
        <Text style={styles.emptyText}>No people found</Text>
        <Text style={styles.emptySubtext}>
          Try refreshing or check back later
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isLoadingMore) return null;

    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#1a365d" />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  };

  const renderError = () => {
    if (!error || isLoading) return null;

    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={handleRetry} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  };

  if (isLoading && people.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#1a365d" />
        <Text style={styles.loadingText}>Loading people...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Specter</Text>
          <Text style={styles.headerSubtitle}>
            {user?.emailAddresses?.[0]?.emailAddress || "Welcome"}
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate("Settings")}
          style={styles.settingsButton}
        >
          <Ionicons name="settings-outline" size={22} color="#1a365d" />
        </Pressable>
      </View>

      {/* Error State */}
      {error && people.length === 0 ? (
        renderError()
      ) : (
        <FlatList
          data={people}
          renderItem={renderPersonCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#1a365d"
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a365d",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 2,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f7fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: "#f7fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: "#1a365d",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "600",
    color: "white",
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 4,
  },
  job: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 4,
  },
  tagline: {
    fontSize: 13,
    color: "#9ca3af",
    lineHeight: 18,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  location: {
    fontSize: 13,
    color: "#94a3b8",
    flex: 1,
  },
  chevron: {
    marginLeft: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 8,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    color: "#64748b",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748b",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: "#ef4444",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#1a365d",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
