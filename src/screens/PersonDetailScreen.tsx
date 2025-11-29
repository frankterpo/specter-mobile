import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useAuth } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  fetchPersonDetail,
  likePerson,
  dislikePerson,
  Person,
  getCurrentJob,
  getFullName,
  getInitials,
  formatHighlight,
} from "../api/specter";
import AIInsightsCard from "../components/AIInsightsCard";
import AICommandBar from "../components/AICommandBar";
import type { FounderAnalysisResult } from "../ai/founderAgent";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { inputManager } from "../ai/inputManager";
import { getAgentMemory } from "../ai/agentMemory";
import { useAgent } from "../context/AgentContext";

type MainStackParamList = {
  PeopleList: undefined;
  SwipeDeck: { updatedPerson?: Person } | undefined;
  PersonDetail: { personId: string };
  Settings: undefined;
};

type PersonDetailScreenProps = {
  navigation: NativeStackNavigationProp<MainStackParamList, "PersonDetail">;
  route: RouteProp<MainStackParamList, "PersonDetail">;
};

export default function PersonDetailScreen({
  navigation,
  route,
}: PersonDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { personId } = route.params;

  const [person, setPerson] = useState<Person | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<"like" | "dislike" | "save" | null>(null);
  const [cachedAnalysis, setCachedAnalysis] = useState<FounderAnalysisResult | null>(null);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [whyYouMightLike, setWhyYouMightLike] = useState<string[] | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [canExit, setCanExit] = useState(false);
  const { getPreferenceSummary } = useAgent();

  // Cache key for AI analysis
  const getCacheKey = (id: string) => `ai_analysis_${id}`;

  // Track view start time for engagement metrics
  useEffect(() => {
    if (person) {
      inputManager.recordView(personId, 'person', getFullName(person));
    }
    return () => {
      inputManager.recordViewEnd(personId);
    };
  }, [person, personId]);

  // Allow exit after 10 seconds even without action (but track as skip)
  useEffect(() => {
    const timer = setTimeout(() => {
      setCanExit(true);
    }, 10000); // 10 seconds
    
    return () => clearTimeout(timer);
  }, []);

  // Block back navigation until action taken or 10s elapsed
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (hasInteracted || canExit || isLoading || error) {
        // Allow navigation if user has interacted, 10s elapsed, or still loading/error
        return;
      }

      // Prevent default behavior of leaving the screen
      e.preventDefault();

      // Show prompt to take action
      Alert.alert(
        'Take Action First',
        'Please like, dislike, or save this profile before leaving. This helps train your personalized deal agent.',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Skip (Dislike)',
            style: 'destructive',
            onPress: async () => {
              // Record skip as implicit dislike
              if (person) {
                const memory = getAgentMemory();
                await memory.recordDislike(
                  { id: person.id, name: getFullName(person) },
                  'Skipped without action'
                );
              }
              setHasInteracted(true);
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, hasInteracted, canExit, isLoading, error, person]);

  useEffect(() => {
    loadPersonDetail();
    loadCachedAnalysis();
  }, [personId]);

  // Compute "Why you might like this" based on memory preferences
  useEffect(() => {
    if (!person) return;
    
    const computeWhyYouMightLike = async () => {
      const memory = getAgentMemory();
      await memory.load();
      
      const reasons: string[] = [];
      const currentJob = person.experience?.find(e => e.is_current);
      
      // Check industry match
      if (currentJob?.industry) {
        const prefSummary = getPreferenceSummary();
        if (prefSummary.toLowerCase().includes(currentJob.industry.toLowerCase())) {
          reasons.push(`Works in ${currentJob.industry} - matches your preferences`);
        }
      }
      
      // Check seniority match
      if (person.seniority) {
        const prefSummary = getPreferenceSummary();
        if (prefSummary.toLowerCase().includes(person.seniority.toLowerCase())) {
          reasons.push(`${person.seniority} level - aligns with your focus`);
        }
      }
      
      // Check region match
      if (person.region) {
        const prefSummary = getPreferenceSummary();
        if (prefSummary.toLowerCase().includes(person.region.toLowerCase())) {
          reasons.push(`Based in ${person.region} - your target region`);
        }
      }
      
      // Check highlights
      if (person.people_highlights?.length) {
        const importantHighlights = person.people_highlights.filter(h => 
          h.toLowerCase().includes('founder') || 
          h.toLowerCase().includes('serial') ||
          h.toLowerCase().includes('unicorn') ||
          h.toLowerCase().includes('ipo')
        );
        if (importantHighlights.length > 0) {
          reasons.push(`Notable: ${importantHighlights.slice(0, 2).join(', ')}`);
        }
      }
      
      // Check experience
      if (person.years_of_experience && person.years_of_experience >= 10) {
        reasons.push(`${person.years_of_experience}+ years of experience`);
      }
      
      // If no specific matches, show general reasons
      if (reasons.length === 0 && currentJob) {
        reasons.push(`${currentJob.title} at ${currentJob.company_name}`);
        if (person.location) {
          reasons.push(`Located in ${person.location}`);
        }
      }
      
      setWhyYouMightLike(reasons.slice(0, 3));
    };
    
    computeWhyYouMightLike();
  }, [person, getPreferenceSummary]);

  const loadPersonDetail = async () => {
    console.log("[PersonDetailScreen] loadPersonDetail called with personId:", personId);
    setIsLoading(true);
    setError(null);

    try {
      if (!personId) {
        throw new Error("No personId in route params");
      }
      
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const data = await fetchPersonDetail(token, personId);
      setPerson(data);
    } catch (err: any) {
      setError(err.message || "Failed to load person details");
      console.error("Load person detail error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCachedAnalysis = async () => {
    try {
      const cached = await AsyncStorage.getItem(getCacheKey(personId));
      if (cached) {
        setCachedAnalysis(JSON.parse(cached));
      }
    } catch (err) {
      console.error("Failed to load cached analysis:", err);
    }
  };

  const handleAnalysisComplete = async (analysis: FounderAnalysisResult) => {
    setCachedAnalysis(analysis);
    try {
      await AsyncStorage.setItem(getCacheKey(personId), JSON.stringify(analysis));
    } catch (err) {
      console.error("Failed to cache analysis:", err);
    }
  };

  const handleLike = async () => {
    if (!person) return;

    setActionLoading("like");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      await likePerson(token, person.id);
      
      // Record to AgentMemory for RL training
      const memory = getAgentMemory();
      // Handle both array and single object experience
      const experienceArray = Array.isArray(person.experience) ? person.experience : (person.experience ? [person.experience] : []);
      const currentJob = getCurrentJob(experienceArray);
      await memory.recordLike({
        id: person.id,
        name: getFullName(person),
        industry: currentJob?.industry,
        seniority: person.seniority,
        region: person.region,
        highlights: person.people_highlights,
      });
      await memory.learnFromLike({
        industry: currentJob?.industry,
        seniority: person.seniority,
        region: person.region,
        highlights: person.people_highlights,
      });
      
      // Update local state - REPLACE status
      const updatedPerson = {
        ...person,
        entity_status: {
          status: "liked" as const,
          updated_at: new Date().toISOString(),
        },
      };
      
      setPerson(updatedPerson);
      setHasInteracted(true);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Navigate back after short delay
      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to like person");
      console.error("Like error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDislike = async () => {
    if (!person) return;

    setActionLoading("dislike");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      await dislikePerson(token, person.id);
      
      // Record to AgentMemory for RL training
      const memory = getAgentMemory();
      // Handle both array and single object experience
      const experienceArray = Array.isArray(person.experience) ? person.experience : (person.experience ? [person.experience] : []);
      const currentJob = getCurrentJob(experienceArray);
      await memory.recordDislike({
        id: person.id,
        name: getFullName(person),
        industry: currentJob?.industry,
        seniority: person.seniority,
        region: person.region,
        highlights: person.people_highlights,
      });
      await memory.learnFromDislike({
        industry: currentJob?.industry,
        seniority: person.seniority,
        region: person.region,
        highlights: person.people_highlights,
      });
      
      // Update local state - REPLACE status
      setPerson({
        ...person,
        entity_status: {
          status: "disliked" as const,
          updated_at: new Date().toISOString(),
        },
      });
      setHasInteracted(true);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Navigate back after short delay
      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to dislike person");
      console.error("Dislike error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSave = async () => {
    if (!person) return;

    setActionLoading("save");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      // Record to AgentMemory with high reward (+2.0)
      const memory = getAgentMemory();
      // Handle both array and single object experience
      const experienceArray = Array.isArray(person.experience) ? person.experience : (person.experience ? [person.experience] : []);
      const currentJob = getCurrentJob(experienceArray);
      await memory.recordSave({
        id: person.id,
        name: getFullName(person),
        industry: currentJob?.industry,
        seniority: person.seniority,
        region: person.region,
        highlights: person.people_highlights,
      });
      // Save is a strong positive signal - learn from it
      await memory.learnFromLike({
        industry: currentJob?.industry,
        seniority: person.seniority,
        region: person.region,
        highlights: person.people_highlights,
      });
      
      setHasInteracted(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", `${getFullName(person)} has been saved to your list.`);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save person");
      console.error("Save error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#0F172A', '#1E293B']}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#38BDF8" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (error || !person) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#0F172A', '#1E293B']}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={styles.errorText}>{error || "Person not found"}</Text>
        <Pressable onPress={loadPersonDetail} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={styles.backToListButton}>
          <Text style={styles.backToListButtonText}>Back to List</Text>
        </Pressable>
      </View>
    );
  }

  const currentJob = getCurrentJob(person.experience);
  const fullName = getFullName(person);
  const initials = getInitials(person);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#0F172A', '#1E293B']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {fullName}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          {person.profile_image_url ? (
            <Image
              source={{ uri: person.profile_image_url }}
              style={styles.profileImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
              <Text style={styles.profileImageText}>{initials}</Text>
            </View>
          )}

          <Text style={styles.fullName}>{fullName}</Text>

          {currentJob && (
            <Text style={styles.currentJob}>
              {currentJob.title} at {currentJob.company_name}
            </Text>
          )}

          <View style={styles.metaRow}>
            {person.location && (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={16} color="#94A3B8" />
                <Text style={styles.metaText}>{person.location}</Text>
              </View>
            )}
            {person.seniority && (
              <View style={styles.metaItem}>
                <Ionicons name="briefcase-outline" size={16} color="#94A3B8" />
                <Text style={styles.metaText}>{person.seniority}</Text>
              </View>
            )}
            {person.years_of_experience !== undefined && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={16} color="#94A3B8" />
                <Text style={styles.metaText}>{person.years_of_experience} years</Text>
              </View>
            )}
          </View>
        </View>

        {/* Why You Might Like This - Memory-based matching */}
        {whyYouMightLike && whyYouMightLike.length > 0 && (
          <View style={styles.whyYouMightLikeCard}>
            <View style={styles.whyYouMightLikeHeader}>
              <Ionicons name="sparkles" size={16} color="#8B5CF6" />
              <Text style={styles.whyYouMightLikeTitle}>Why You Might Like This</Text>
            </View>
            {whyYouMightLike.map((reason, index) => (
              <View key={index} style={styles.whyYouMightLikeItem}>
                <View style={styles.whyYouMightLikeBullet} />
                <Text style={styles.whyYouMightLikeText}>{reason}</Text>
              </View>
            ))}
          </View>
        )}

        {/* AI Insights Section */}
        <AIInsightsCard
          person={person}
          cachedAnalysis={cachedAnalysis}
          onAnalysisComplete={handleAnalysisComplete}
        />

        {/* AI Command Bar - Ask follow-up questions */}
        <View style={styles.aiCommandSection}>
          <AICommandBar
            person={person}
            onResponse={setAiResponse}
            placeholder="Ask about this founder..."
            showQuickActions={true}
            collapsed={true}
          />
        </View>

        {/* Tagline Section */}
        {person.tagline && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.tagline}>{person.tagline}</Text>
          </View>
        )}

        {/* Highlights Section */}
        {person.people_highlights && person.people_highlights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Highlights</Text>
            <View style={styles.highlightsContainer}>
              {person.people_highlights.map((highlight, index) => (
                <View key={index} style={styles.highlightBadge}>
                  <Text style={styles.highlightText}>{formatHighlight(highlight)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Experience Section */}
        {person.experience && person.experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
            {person.experience.map((exp, index) => (
              <View key={index} style={styles.experienceItem}>
                <View style={styles.experienceHeader}>
                  <Text style={styles.companyName}>{exp.company_name}</Text>
                  {exp.is_current && (
                    <View style={styles.currentBadge}>
                      <View style={styles.currentDot} />
                      <Text style={styles.currentText}>Current</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.jobTitle}>{exp.title}</Text>
                {exp.company_size && (
                  <Text style={styles.companyDetail}>Size: {exp.company_size}</Text>
                )}
                {exp.total_funding_amount !== undefined && exp.total_funding_amount > 0 && (
                  <Text style={styles.companyDetail}>
                    Funding: ${(exp.total_funding_amount / 1000000).toFixed(1)}M
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Bottom Padding */}
        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      {/* Action Buttons - Forced Interaction Bar */}
      <View style={[styles.actionButtons, { paddingBottom: insets.bottom + 16 }]}>
        {/* Dislike Button */}
        <Pressable
          onPress={handleDislike}
          disabled={actionLoading !== null}
          style={({ pressed }) => [
            styles.actionButtonCircle,
            styles.dislikeButtonCircle,
            (pressed || actionLoading === "dislike") && styles.actionButtonPressed,
          ]}
        >
          {actionLoading === "dislike" ? (
            <ActivityIndicator color="#EF4444" size="small" />
          ) : (
            <Ionicons name="close" size={28} color="#EF4444" />
          )}
        </Pressable>

        {/* Save Button */}
        <Pressable
          onPress={handleSave}
          disabled={actionLoading !== null}
          style={({ pressed }) => [
            styles.actionButtonCircle,
            styles.saveButtonCircle,
            (pressed || actionLoading === "save") && styles.actionButtonPressed,
          ]}
        >
          {actionLoading === "save" ? (
            <ActivityIndicator color="#8B5CF6" size="small" />
          ) : (
            <Ionicons name="bookmark-outline" size={24} color="#8B5CF6" />
          )}
        </Pressable>

        {/* Like Button */}
        <Pressable
          onPress={handleLike}
          disabled={actionLoading !== null}
          style={({ pressed }) => [
            styles.actionButtonCircle,
            styles.likeButtonCircle,
            (pressed || actionLoading === "like") && styles.actionButtonPressed,
          ]}
        >
          {actionLoading === "like" ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Ionicons name="heart" size={28} color="#FFF" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  aiCommandSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#F8FAFC",
    textAlign: "center",
    marginHorizontal: 8,
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  profileImagePlaceholder: {
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  profileImageText: {
    fontSize: 40,
    fontWeight: "600",
    color: "#F8FAFC",
  },
  fullName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#F8FAFC",
    textAlign: "center",
    marginBottom: 8,
  },
  currentJob: {
    fontSize: 16,
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  metaText: {
    fontSize: 14,
    color: "#CBD5E1",
    fontWeight: "500",
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94A3B8",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: "#E2E8F0",
    lineHeight: 24,
  },
  highlightsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  highlightBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  highlightText: {
    color: "#38BDF8",
    fontSize: 13,
    fontWeight: "600",
  },
  experienceItem: {
    marginBottom: 24,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 16,
    borderRadius: 16,
  },
  experienceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F8FAFC",
    flex: 1,
  },
  currentBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  currentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  currentText: {
    fontSize: 11,
    color: "#22C55E",
    fontWeight: "600",
  },
  jobTitle: {
    fontSize: 15,
    color: "#94A3B8",
    marginBottom: 8,
    fontWeight: "500",
  },
  companyDetail: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "#0F172A",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  actionButtonCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  likeButtonCircle: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  dislikeButtonCircle: {
    backgroundColor: "transparent",
    borderColor: "#EF4444",
  },
  saveButtonCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "transparent",
    borderColor: "#8B5CF6",
  },
  likeButton: {
    backgroundColor: "#38BDF8",
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  dislikeButton: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  actionButtonText: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
  },
  likeButtonText: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "600",
  },
  actionButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#94A3B8",
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: "#38BDF8",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "600",
  },
  backToListButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  backToListButtonText: {
    color: "#94A3B8",
    fontSize: 15,
  },
  // Why You Might Like This - Memory-based matching
  whyYouMightLikeCard: {
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  whyYouMightLikeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  whyYouMightLikeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8B5CF6",
    letterSpacing: 0.5,
  },
  whyYouMightLikeItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    paddingLeft: 4,
  },
  whyYouMightLikeBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#8B5CF6",
    marginTop: 6,
    marginRight: 10,
  },
  whyYouMightLikeText: {
    fontSize: 14,
    color: "#E2E8F0",
    flex: 1,
    lineHeight: 20,
  },
});
