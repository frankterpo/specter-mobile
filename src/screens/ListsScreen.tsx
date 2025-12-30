import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { theme } from "../theme";
import { specterPublicAPI } from "../api/public-client";
import { useClerkToken } from "../hooks/useClerkToken";
import { GlassCard } from "../components/ui/glass/GlassCard";
import { GlassButton } from "../components/ui/glass/GlassButton";
import { FlashList } from "@shopify/flash-list";
import Animated, { FadeInLeft } from "react-native-reanimated";

type ListType = "companies" | "people";

interface List {
  id: string;
  name: string;
  count?: number;
}

export default function ListsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { getAuthToken } = useClerkToken();
  const { colors, spacing, typography } = theme;

  const [lists, setLists] = useState<List[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ListType>("people");

  const loadLists = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      const product = activeTab === "companies" ? "company" : "people";
      const response = await specterPublicAPI.lists.getLists(product, 5000, token);
      const normalizedLists = Array.isArray(response) ? response : Array.isArray((response as any)?.lists) ? (response as any).lists : [];
      setLists(normalizedLists);
    } catch (error) {
      console.error("Failed to load lists:", error);
      setLists([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setIsLoading(true);
    loadLists();
  }, [loadLists, activeTab]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadLists();
  }, [loadLists]);

  const handleListPress = useCallback((list: List) => {
    navigation.navigate("ListDetail", { listId: list.id, listName: list.name });
  }, [navigation]);

  const handleCreateList = useCallback(() => {
    Alert.alert(
      "Not Available",
      "Creating lists isn't supported by the current API. You can still view existing lists.",
      [{ text: "OK" }]
    );
  }, []);

  const renderListItem = useCallback(({ item, index }: { item: List, index: number }) => (
    <Animated.View entering={FadeInLeft.delay(index * 50)}>
      <GlassCard 
        style={styles.listItem}
        onPress={() => handleListPress(item)}
      >
        <View style={styles.listIcon}>
          <Ionicons name="list" size={20} color={colors.primary} />
        </View>
        <View style={styles.listContent}>
          <Text style={styles.listName}>{item.name}</Text>
          <Text style={styles.listCount}>{item.count || 0} items</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      </GlassCard>
    </Animated.View>
  ), [handleListPress, colors]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="list-outline" size={64} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>No lists found</Text>
        <Text style={styles.emptySubtext}>
          Lists can be created on the web for now.
        </Text>
        <GlassButton
          label="Why?"
          icon="information-circle"
          onPress={handleCreateList}
          style={{ marginTop: 24, paddingHorizontal: 24 }}
        />
      </View>
    );
  }, [isLoading, colors, handleCreateList]);

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <Pressable
          style={[styles.tab, activeTab === "people" && styles.tabActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab("people");
          }}
        >
          <Text style={[styles.tabText, activeTab === "people" && styles.tabTextActive]}>
            People
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "companies" && styles.tabActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab("companies");
          }}
        >
          <Text style={[styles.tabText, activeTab === "companies" && styles.tabTextActive]}>
            Companies
          </Text>
        </Pressable>
      </View>

      {/* Lists */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlashList
          data={lists}
          keyExtractor={(item) => item.id}
          renderItem={renderListItem}
          estimatedItemSize={80}
          contentContainerStyle={styles.listContentPadding}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={renderEmpty}
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
  tabsContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tabActive: {
    backgroundColor: theme.colors.primary + '20',
    borderColor: theme.colors.primary + '40',
  },
  tabText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text.tertiary,
  },
  tabTextActive: {
    color: theme.colors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContentPadding: {
    padding: 16,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 12,
    marginVertical: 0,
  },
  listIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  listContent: {
    flex: 1,
  },
  listName: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  listCount: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
    marginTop: 2,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    minHeight: 400,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.text.primary,
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 15,
    color: theme.colors.text.tertiary,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 22,
  },
});
