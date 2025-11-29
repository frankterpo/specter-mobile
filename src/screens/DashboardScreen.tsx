/**
 * DashboardScreen - The Unified Home for Specter Mobile
 * 
 * Features:
 * - AI Status Header showing agent memory state
 * - Horizontal scroll for Saved Searches
 * - Smart Feed prioritized by AI agent
 * - Signal Stream for real-time updates
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useAuth } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";

import { useAgent, useTrackLike, useTrackDislike, useTrackView } from "../context/AgentContext";
import {
  fetchPeople,
  fetchSavedSearches,
  fetchLists,
  likePerson,
  dislikePerson,
  Person,
  SavedSearch,
  List,
  getCurrentJob,
  getFullName,
  getInitials,
  formatHighlight,
  getHighlightColor,
  AuthError,
} from "../api/specter";
import { MainStackParamList } from "../types/navigation";
import AICommandBar from "../components/AICommandBar";
import { inputManager, CommandIntent } from "../ai/inputManager";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type DashboardScreenProps = {
  navigation: NativeStackNavigationProp<MainStackParamList, "Dashboard">;
  route: any;
};

// ============================================
// COMPONENTS
// ============================================

interface AIStatusHeaderProps {
  preferenceSummary: string;
  isLoading: boolean;
}

function AIStatusHeader({ preferenceSummary, isLoading }: AIStatusHeaderProps) {
  return (
    <View style={styles.aiHeader}>
      <View style={styles.aiStatusRow}>
        <View style={styles.aiIndicator}>
          <View style={[styles.aiDot, isLoading && styles.aiDotPulsing]} />
          <Text style={styles.aiStatusText}>Agent Active</Text>
        </View>
        <Ionicons name="sparkles" size={16} color="#3B82F6" />
      </View>
      <Text style={styles.aiSummary}>{preferenceSummary}</Text>
    </View>
  );
}

interface SavedSearchPillProps {
  search: SavedSearch;
  onPress: () => void;
  isActive: boolean;
}

function SavedSearchPill({ search, onPress, isActive }: SavedSearchPillProps) {
  const productTypeIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
    company: "business",
    people: "people",
    talent: "trending-up",
    investors: "cash",
  };

  return (
    <Pressable
      style={[styles.searchPill, isActive && styles.searchPillActive]}
      onPress={onPress}
    >
      <Ionicons
        name={productTypeIcon[search.product_type] || "search"}
        size={14}
        color={isActive ? "#fff" : "#64748B"}
      />
      <Text style={[styles.searchPillText, isActive && styles.searchPillTextActive]}>
        {search.name}
      </Text>
      {search.new_count > 0 && (
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>{search.new_count}</Text>
        </View>
      )}
    </Pressable>
  );
}

interface PersonCardProps {
  person: Person;
  onPress: () => void;
  onLike: () => void;
  onDislike: () => void;
}

function PersonCard({ person, onPress, onLike, onDislike }: PersonCardProps) {
  const currentJob = getCurrentJob(person.experience || []);
  const fullName = getFullName(person);
  const initials = getInitials(person);
  const highlights = person.people_highlights?.slice(0, 2) || [];

  return (
    <Pressable style={styles.personCard} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={styles.avatarContainer}>
          {person.profile_image_url ? (
            <Image
              source={{ uri: person.profile_image_url }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.personName} numberOfLines={1}>
            {fullName}
          </Text>
          {currentJob && (
            <Text style={styles.personRole} numberOfLines={1}>
              {currentJob.title} at {currentJob.company_name}
            </Text>
          )}
          {person.location && (
            <Text style={styles.personLocation} numberOfLines={1}>
              {person.location}
            </Text>
          )}
        </View>
      </View>

      {highlights.length > 0 && (
        <View style={styles.highlightsRow}>
          {highlights.map((highlight, index) => (
            <View
              key={index}
              style={[
                styles.highlightTag,
                { backgroundColor: `${getHighlightColor(highlight)}20` },
              ]}
            >
              <Text
                style={[
                  styles.highlightText,
                  { color: getHighlightColor(highlight) },
                ]}
              >
                {formatHighlight(highlight)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.cardActions}>
        <Pressable style={styles.actionBtn} onPress={onDislike}>
          <Ionicons name="close" size={20} color="#EF4444" />
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onLike}>
          <Ionicons name="heart" size={20} color="#22C55E" />
        </Pressable>
      </View>
    </Pressable>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function DashboardScreen({ navigation }: DashboardScreenProps) {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { state, setSavedSearches, setLists, getPreferenceSummary, getFullContextForLLM, recordSearchView } = useAgent();
  const trackLike = useTrackLike();
  const trackDislike = useTrackDislike();
  const trackView = useTrackView();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [activeSearchId, setActiveSearchId] = useState<number | null>(null);
  const [aiResponse, setAiResponse] = useState<string>('');

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new AuthError("Please sign in to continue");
      }

      // Load people feed
      const peopleResponse = await fetchPeople(token, {
        limit: 30,
        offset: 0,
      });
      setPeople(peopleResponse.items || []);

      // Load saved searches (if API key available)
      // Note: fetchSavedSearches requires API key, not JWT
      // For now, we'll load lists which use JWT
      const listsResponse = await fetchLists(token);
      setLists(listsResponse);

    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, []);

  const handleLike = useCallback(async (person: Person) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const token = await getToken();
      if (token) {
        await likePerson(token, person.id);
        trackLike(person);
        // Update local state
        setPeople(prev => prev.filter(p => p.id !== person.id));
      }
    } catch (err) {
      console.error("Like error:", err);
    }
  }, [getToken, trackLike]);

  const handleDislike = useCallback(async (person: Person) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const token = await getToken();
      if (token) {
        await dislikePerson(token, person.id);
        trackDislike(person);
        // Update local state
        setPeople(prev => prev.filter(p => p.id !== person.id));
      }
    } catch (err) {
      console.error("Dislike error:", err);
    }
  }, [getToken, trackDislike]);

  const handlePersonPress = useCallback((person: Person) => {
    trackView(person);
    navigation.navigate("PersonDetail", { personId: person.id });
  }, [navigation, trackView]);

  const handleSearchPress = useCallback((search: SavedSearch) => {
    setActiveSearchId(search.id);
    recordSearchView(search.id);
    Haptics.selectionAsync();
    // Record search interaction
    inputManager.recordSearch(search.name, { searchId: search.id, productType: search.product_type });
    // TODO: Load search results
  }, [recordSearchView]);

  const handleAICommand = useCallback((intent: CommandIntent) => {
    // Handle different command intents
    switch (intent.type) {
      case 'search':
        inputManager.recordSearch(intent.query);
        // TODO: Trigger search
        break;
      case 'filter':
        inputManager.recordFilterChange(intent.filters);
        // TODO: Apply filters
        break;
      case 'action':
        if (intent.action === 'like' && people.length > 0) {
          handleLike(people[0]);
        } else if (intent.action === 'dislike' && people.length > 0) {
          handleDislike(people[0]);
        }
        break;
      case 'navigate':
        if (intent.destination.includes('settings')) {
          navigation.navigate('Settings');
        }
        break;
    }
  }, [people, handleLike, handleDislike, navigation]);

  const preferenceSummary = getPreferenceSummary();
  const fullContext = getFullContextForLLM();

  // ============================================
  // RENDER
  // ============================================

  if (isLoading && people.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading your feed...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 20 },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Specter</Text>
            <Text style={styles.headerSubtitle}>Your Investor OS</Text>
          </View>
          <Pressable
            style={styles.settingsBtn}
            onPress={() => navigation.navigate("Settings")}
          >
            <Ionicons name="settings-outline" size={24} color="#1E293B" />
          </Pressable>
        </View>

        {/* AI Status */}
        <AIStatusHeader
          preferenceSummary={preferenceSummary}
          isLoading={state.isLoading}
        />

        {/* Saved Searches */}
        {state.memory.savedSearches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Saved Searches</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillsContainer}
            >
              {state.memory.savedSearches.map((search) => (
                <SavedSearchPill
                  key={search.id}
                  search={search}
                  isActive={activeSearchId === search.id}
                  onPress={() => handleSearchPress(search)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Lists Quick Access */}
        {state.memory.lists.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Lists</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillsContainer}
            >
              {state.memory.lists.map((list) => (
                <Pressable key={list.id} style={styles.listPill}>
                  <Ionicons name="folder-outline" size={14} color="#64748B" />
                  <Text style={styles.listPillText}>{list.name}</Text>
                  {list.person_count && (
                    <Text style={styles.listCount}>{list.person_count}</Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Smart Feed */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Smart Feed</Text>
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={12} color="#3B82F6" />
              <Text style={styles.aiBadgeText}>AI Prioritized</Text>
            </View>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={48} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={loadData}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : people.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>No results found</Text>
              <Text style={styles.emptySubtext}>
                Adjust your filters or check back later
              </Text>
            </View>
          ) : (
            people.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                onPress={() => handlePersonPress(person)}
                onLike={() => handleLike(person)}
                onDislike={() => handleDislike(person)}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* AI Command Bar - Global AI Assistant */}
      <AICommandBar
        onResponse={setAiResponse}
        onCommand={handleAICommand}
        placeholder="Ask anything or give a command..."
        showQuickActions={false}
        collapsed={false}
      />
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748B",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#64748B",
  },
  settingsBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  // AI Header
  aiHeader: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  aiStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  aiIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },
  aiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
    marginRight: 8,
  },
  aiDotPulsing: {
    backgroundColor: "#FBBF24",
  },
  aiStatusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  aiSummary: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 12,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiBadgeText: {
    fontSize: 12,
    color: "#3B82F6",
    marginLeft: 4,
    fontWeight: "500",
  },

  // Search Pills
  pillsContainer: {
    paddingRight: 16,
    gap: 8,
    flexDirection: "row",
  },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  searchPillActive: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  searchPillText: {
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "500",
  },
  searchPillTextActive: {
    color: "#fff",
  },
  newBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  newBadgeText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "600",
  },

  // List Pills
  listPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  listPillText: {
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "500",
  },
  listCount: {
    fontSize: 12,
    color: "#64748B",
    marginLeft: 4,
  },

  // Person Card
  personCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748B",
  },
  cardInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 2,
  },
  personRole: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 2,
  },
  personLocation: {
    fontSize: 12,
    color: "#94A3B8",
  },
  highlightsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  highlightTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  highlightText: {
    fontSize: 11,
    fontWeight: "600",
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  // Error/Empty States
  errorContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 16,
    color: "#EF4444",
    marginTop: 12,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#3B82F6",
    borderRadius: 12,
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#64748B",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 4,
  },
});

