/**
 * CompanyDetailScreen - Detailed view of a company
 * 
 * This screen displays comprehensive company information and captures
 * user interactions (like/dislike/save) for the RL agent's memory.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useAgent } from "../context/AgentContext";
import { MainStackParamList } from "../types/navigation";
import { Company, fetchCompanyDetail } from "../api/specter";
import { logger } from "../utils/logger";
import { getAgentMemory } from "../ai/agentMemory";
import { useAuth } from "@clerk/clerk-expo";

type Props = NativeStackScreenProps<MainStackParamList, "CompanyDetail">;

export default function CompanyDetailScreen({ route, navigation }: Props) {
  const { companyId, companyData } = route.params;
  const insets = useSafeAreaInsets();
  const { trackInteraction } = useAgent();
  const { getToken } = useAuth();
  
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [canExit, setCanExit] = useState(false);
  
  // Track time spent on profile for RL reward
  const viewStartTime = useRef(Date.now());

  useEffect(() => {
    loadCompanyDetails();
    
    // Track profile view when component unmounts
    return () => {
      const timeSpent = (Date.now() - viewStartTime.current) / 1000;
      if (company) {
        trackInteraction('view', {
          type: 'company',
          id: companyId,
          name: company.organization_name || company.name || 'Unknown',
          timeSpent,
        });
        logger.info("CompanyDetail", `View tracked: ${timeSpent.toFixed(1)}s on ${company.organization_name || company.name}`);
      }
    };
  }, [companyId]);

  // Allow exit after 10 seconds even without action
  useEffect(() => {
    const timer = setTimeout(() => {
      setCanExit(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  // Block back navigation until action taken or 10s elapsed
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (hasInteracted || canExit || isLoading || error) {
        return;
      }

      e.preventDefault();

      Alert.alert(
        'Take Action First',
        'Please like, dislike, or save this company before leaving. This helps train your personalized deal agent.',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Skip (Dislike)',
            style: 'destructive',
            onPress: async () => {
              if (company) {
                const memory = getAgentMemory();
                await memory.recordDislike(
                  { id: companyId, name: company.organization_name || company.name || 'Unknown' },
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
  }, [navigation, hasInteracted, canExit, isLoading, error, company]);

  const loadCompanyDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      logger.info("CompanyDetail", `Loading company: ${companyId}`);
      
      // If we already have company data passed in, use it
      if (companyData) {
        logger.info("CompanyDetail", `Using passed company data: ${companyData.organization_name || companyData.name}`);
        setCompany(companyData);
        setIsLoading(false);
        return;
      }
      
      // Otherwise fetch from API
      const token = await getToken();
      const data = await fetchCompanyDetail(token || undefined, companyId);
      
      if (data) {
        logger.info("CompanyDetail", `Loaded company: ${data.organization_name || data.name}`);
        setCompany(data);
      } else {
        setError("Company not found");
      }
    } catch (err: any) {
      logger.error("CompanyDetail", "Failed to load company", err);
      setError(err.message || "Failed to load company details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async () => {
    if (!company) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLiked(true);
    
    trackInteraction('like', {
      type: 'company',
      id: companyId,
      name: company.organization_name || company.name || 'Unknown',
      industries: company.industries,
      region: company.hq?.region,
      fundingStage: company.growth_stage,
      metadata: {
        companies: [company.organization_name || company.name || ''].filter(Boolean),
      }
    });
    
    logger.info("CompanyDetail", `Liked company: ${company.organization_name || company.name}`);
  };

  const handleDislike = async () => {
    if (!company) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLiked(false);
    
    trackInteraction('dislike', {
      type: 'company',
      id: companyId,
      name: company.organization_name || company.name || 'Unknown',
      industries: company.industries,
      region: company.hq?.region,
      fundingStage: company.growth_stage,
      metadata: {
        companies: [company.organization_name || company.name || ''].filter(Boolean),
      }
    });
    
    logger.info("CompanyDetail", `Disliked company: ${company.organization_name || company.name}`);
  };

  const handleSave = async () => {
    if (!company) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    trackInteraction('save', {
      type: 'company',
      id: companyId,
      name: company.organization_name || company.name || 'Unknown',
      industries: company.industries,
      region: company.hq?.region,
      fundingStage: company.growth_stage,
      metadata: {
        companies: [company.organization_name || company.name || ''].filter(Boolean),
      }
    });
    
    logger.info("CompanyDetail", `Saved company: ${company.organization_name || company.name}`);
  };

  const companyName = company?.organization_name || company?.name || 'Unknown Company';
  const domain = company?.website?.domain;
  const logoUrl = domain 
    ? `https://app.tryspecter.com/logo?domain=${domain}`
    : company?.logo_url;

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading company...</Text>
      </View>
    );
  }

  if (error || !company) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error || "Company not found"}</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // Get active persona for display
  const agentMemory = getAgentMemory();
  const activePersona = agentMemory.getActivePersona();
  const matchScore = company ? agentMemory.calculateMatchScore({
    industry: company.industries?.[0],
    fundingStage: company.funding?.last_funding_type,
    region: company.hq?.country,
    companies: [company.organization_name || company.name || ''].filter(Boolean),
  }) : { score: 50, reasons: [] };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Company</Text>
        <Pressable onPress={handleSave} style={styles.headerButton}>
          <Ionicons name="bookmark-outline" size={24} color="#1E293B" />
        </Pressable>
      </View>

      {/* Persona & AI Status Bar */}
      <View style={styles.personaBar}>
        <View style={styles.personaInfo}>
          <View style={[styles.personaBadge, { backgroundColor: activePersona ? '#8B5CF6' : '#6B7280' }]}>
            <Ionicons name="person-circle" size={14} color="#FFF" />
            <Text style={styles.personaBadgeText}>
              {activePersona?.name || 'Global'}
            </Text>
          </View>
          <View style={[
            styles.matchScoreBadge,
            { backgroundColor: matchScore.score >= 70 ? '#22C55E' : matchScore.score >= 40 ? '#F59E0B' : '#EF4444' }
          ]}>
            <Text style={styles.matchScoreText}>{matchScore.score}% Match</Text>
          </View>
        </View>
        <Pressable 
          style={styles.aiQuickBtn}
          onPress={() => navigation.navigate('Diagnostics' as any)}
        >
          <Ionicons name="sparkles" size={16} color="#8B5CF6" />
          <Text style={styles.aiQuickBtnText}>AI</Text>
        </Pressable>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Company Header Card */}
        <View style={styles.profileCard}>
          {logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              style={styles.companyLogo}
              contentFit="contain"
            />
          ) : (
            <View style={[styles.companyLogo, styles.logoPlaceholder]}>
              <Ionicons name="business" size={40} color="#64748B" />
            </View>
          )}
          
          <Text style={styles.companyName}>{companyName}</Text>
          
          {company.tagline && (
            <Text style={styles.tagline}>{company.tagline}</Text>
          )}
          
          <View style={styles.metaRow}>
            {company.industries && company.industries.length > 0 && (
              <View style={styles.metaItem}>
                <Ionicons name="layers-outline" size={16} color="#64748B" />
                <Text style={styles.metaText}>{company.industries.slice(0, 2).join(', ')}</Text>
              </View>
            )}
            {company.hq?.city && (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={16} color="#64748B" />
                <Text style={styles.metaText}>{company.hq.city}, {company.hq.country}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          {company.funding?.total_funding_usd && (
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                ${(company.funding.total_funding_usd / 1000000).toFixed(1)}M
              </Text>
              <Text style={styles.statLabel}>Total Funding</Text>
            </View>
          )}
          {company.employee_count && (
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{company.employee_count}</Text>
              <Text style={styles.statLabel}>Employees</Text>
            </View>
          )}
          {company.founded_year && (
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{company.founded_year}</Text>
              <Text style={styles.statLabel}>Founded</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {company.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{company.description}</Text>
          </View>
        )}

        {/* Highlights */}
        {company.highlights && company.highlights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Highlights</Text>
            <View style={styles.highlightsGrid}>
              {company.highlights.map((highlight, index) => (
                <View key={index} style={styles.highlightBadge}>
                  <Ionicons name="sparkles" size={12} color="#059669" />
                  <Text style={styles.highlightText}>
                    {highlight.replace(/_/g, ' ')}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Founders */}
        {company.founder_info && company.founder_info.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Founders</Text>
            {company.founder_info.map((founder, index) => (
              <Pressable
                key={index}
                style={styles.founderCard}
                onPress={() => {
                  if (founder.specter_person_id) {
                    navigation.push("PersonDetail", { personId: founder.specter_person_id });
                  }
                }}
              >
                <View style={styles.founderAvatar}>
                  <Ionicons name="person" size={20} color="#64748B" />
                </View>
                <View style={styles.founderInfo}>
                  <Text style={styles.founderName}>{founder.full_name}</Text>
                  <Text style={styles.founderTitle}>{founder.title}</Text>
                </View>
                {founder.specter_person_id && (
                  <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Links</Text>
          <View style={styles.linksRow}>
            {company.website?.url && (
              <Pressable
                style={styles.linkButton}
                onPress={() => Linking.openURL(company.website!.url!)}
              >
                <Ionicons name="globe-outline" size={20} color="#3B82F6" />
                <Text style={styles.linkText}>Website</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Spacer for action buttons */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={handleDislike}
          style={[
            styles.actionButton,
            styles.dislikeButton,
            liked === false && styles.actionButtonActive,
          ]}
        >
          <Ionicons 
            name={liked === false ? "close" : "close-outline"} 
            size={28} 
            color={liked === false ? "#FFF" : "#EF4444"} 
          />
        </Pressable>
        
        <Pressable
          onPress={handleSave}
          style={[styles.actionButton, styles.saveButton]}
        >
          <Ionicons name="bookmark-outline" size={24} color="#8B5CF6" />
        </Pressable>
        
        <Pressable
          onPress={handleLike}
          style={[
            styles.actionButton,
            styles.likeButton,
            liked === true && styles.actionButtonActive,
          ]}
        >
          <Ionicons 
            name={liked === true ? "heart" : "heart-outline"} 
            size={28} 
            color={liked === true ? "#FFF" : "#22C55E"} 
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748B",
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#3B82F6",
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 0,
    borderBottomColor: "#E2E8F0",
  },
  // Persona & AI Status Bar
  personaBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  personaInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  personaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  personaBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  matchScoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  matchScoreText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  aiQuickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F5F3FF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  aiQuickBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8B5CF6",
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1E293B",
    flex: 1,
    textAlign: "center",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  profileCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  companyLogo: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    marginBottom: 16,
  },
  logoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  companyName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
  },
  tagline: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    marginTop: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: "#64748B",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: "#475569",
    lineHeight: 24,
  },
  highlightsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  highlightBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  highlightText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#059669",
    textTransform: "capitalize",
  },
  founderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
  },
  founderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  founderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  founderName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  founderTitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  linksRow: {
    flexDirection: "row",
    gap: 12,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#3B82F6",
  },
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    paddingTop: 16,
    paddingHorizontal: 20,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  dislikeButton: {
    borderColor: "#EF4444",
    backgroundColor: "#FFF",
  },
  likeButton: {
    borderColor: "#22C55E",
    backgroundColor: "#FFF",
  },
  saveButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderColor: "#8B5CF6",
    backgroundColor: "#FFF",
  },
  actionButtonActive: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
  },
});

