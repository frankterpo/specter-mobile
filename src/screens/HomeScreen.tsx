/**
 * HomeScreen - The new default landing screen
 * 
 * Shows saved searches as the primary content, with a floating
 * master button to switch between feeds (People, Companies, Talent, Investor Interest).
 * 
 * Includes AI-assisted saved search creation via Cactus.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Modal,
  TextInput,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useAuth } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import { useModelStatus, useAgent } from "../context/AgentContext";
import { MainStackParamList } from "../types/navigation";
import {
  fetchSavedSearches,
  fetchPeopleSavedSearchResults,
  fetchCompanySavedSearchResults,
  fetchTalentSignals,
  fetchInvestorInterestSignals,
  SavedSearch,
  Person,
  Company,
  TalentSignal,
  InvestorInterestSignal,
  AuthError,
} from "../api/specter";
import { logger } from "../utils/logger";
import { getFounderAgent } from "../ai/founderAgent";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<MainStackParamList, "Dashboard">;
};

type FeedType = "people" | "companies" | "talent" | "investors" | "interest";

const FEED_OPTIONS: { type: FeedType; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { type: "people", label: "People", icon: "people", color: "#3B82F6" },
  { type: "companies", label: "Companies", icon: "business", color: "#10B981" },
  { type: "talent", label: "Talent", icon: "trending-up", color: "#F59E0B" },
  { type: "investors", label: "Investors", icon: "cash", color: "#8B5CF6" },
  { type: "interest", label: "Interest", icon: "eye", color: "#EC4899" },
];

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { getToken, signOut } = useAuth();
  const { status: modelStatus, progress: modelProgress, isReady: modelReady } = useModelStatus();
  const { getPreferenceSummary, trackInteraction } = useAgent();

  // State
  const [globalSearches, setGlobalSearches] = useState<SavedSearch[]>([]);
  const [personalSearches, setPersonalSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSearch, setSelectedSearch] = useState<SavedSearch | null>(null);
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [companyResults, setCompanyResults] = useState<Company[]>([]);
  const [interestResults, setInterestResults] = useState<InvestorInterestSignal[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [resultType, setResultType] = useState<'person' | 'company' | 'interest'>('person');

  // Dropdown state for search sections
  const [globalExpanded, setGlobalExpanded] = useState(false);
  const [personalExpanded, setPersonalExpanded] = useState(false);

  // Feed switcher state
  const [feedSwitcherVisible, setFeedSwitcherVisible] = useState(false);
  const [currentFeed, setCurrentFeed] = useState<FeedType>("people");
  const feedSwitcherAnim = useRef(new Animated.Value(0)).current;
  const masterButtonAnim = useRef(new Animated.Value(1)).current;

  // AI Search Creator state
  const [aiSearchModalVisible, setAiSearchModalVisible] = useState(false);
  const [aiSearchPrompt, setAiSearchPrompt] = useState("");
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [aiSearchSuggestion, setAiSearchSuggestion] = useState<string | null>(null);

  // Load saved searches on mount
  useEffect(() => {
    console.log("[HomeScreen] Mounted, loading saved searches...");
    loadSavedSearches();
  }, []);

  const loadSavedSearches = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new AuthError("Not authenticated");
      }

      console.log("[HomeScreen] Fetching saved searches with token...");
      const searches = await fetchSavedSearches(token);
      console.log("[HomeScreen] Raw searches from API:", searches?.length, searches);
      
      // Filter by current feed type - separate into global and personal
      const productTypeFilter = (s: SavedSearch) => {
        if (currentFeed === "people") return s.product_type === "people";
        if (currentFeed === "companies") return s.product_type === "company";
        if (currentFeed === "talent") return s.product_type === "talent";
        if (currentFeed === "investors") return s.product_type === "investors";
        if (currentFeed === "interest") return s.product_type === "stratintel" || s.product_type === "interest_signals";
        return true;
      };
      
      const filteredByType = searches.filter(productTypeFilter);
      const global = filteredByType.filter(s => s.is_global === true);
      const personal = filteredByType.filter(s => s.is_global === false);

      console.log("[HomeScreen] Global searches:", global.length, "Personal searches:", personal.length, "for feed:", currentFeed);
      setGlobalSearches(global);
      setPersonalSearches(personal);
      logger.info("HomeScreen", `Loaded ${global.length} global, ${personal.length} personal searches`);
    } catch (err: any) {
      // Don't sign out on errors - just show error message
      logger.error("HomeScreen", "Failed to load saved searches", err);
      setError(err.message || "Failed to load saved searches");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSavedSearches();
  };

  // Reload when feed type changes
  useEffect(() => {
    loadSavedSearches();
  }, [currentFeed]);

  const handleSearchSelect = async (search: SavedSearch) => {
    setSelectedSearch(search);
    setIsLoadingResults(true);
    // Clear previous results
    setSearchResults([]);
    setCompanyResults([]);
    setInterestResults([]);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const token = await getToken();
      if (!token) throw new AuthError("Not authenticated");

      switch (search.product_type) {
        case 'people':
          setResultType('person');
          const peopleResults = await fetchPeopleSavedSearchResults(token, search.id, { limit: 20 });
          setSearchResults(peopleResults.items);
          logger.info("HomeScreen", `Loaded ${peopleResults.items.length} people`);
          break;
          
        case 'talent':
          setResultType('person');
          // Talent signals returns full person data with signal metadata
          const talentResults = await fetchTalentSignals(token, search.id, { limit: 20 });
          if (talentResults.items[0]) {
            console.log("[HomeScreen] Raw talent signal sample:", JSON.stringify(talentResults.items[0]).slice(0, 500));
          }
          // Map talent signals to Person-like objects
          // The API returns person_id, so we need to map it to id for Person interface
          const mappedTalent = talentResults.items
            .filter(signal => signal.person_id) // Only include signals with person_id
            .map(signal => {
              const mapped = {
                id: signal.person_id, // CRITICAL: Map person_id to id
                full_name: signal.full_name || 'Unknown',
                first_name: signal.first_name || '',
                last_name: signal.last_name || '',
                profile_image_url: signal.profile_picture_url,
                tagline: signal.tagline || `${signal.signal_type}: ${signal.new_position_company_name || 'New Role'}`,
                region: signal.region,
                seniority: signal.level_of_seniority,
                experience: signal.experience ? [signal.experience] : [],
              };
              console.log("[HomeScreen] Mapped talent:", mapped.full_name, "-> id:", mapped.id);
              return mapped;
            }) as Person[];
          setSearchResults(mappedTalent);
          logger.info("HomeScreen", `Mapped ${mappedTalent.length} talent signals to person cards`);
          break;
          
        case 'company':
          setResultType('company');
          const companyRes = await fetchCompanySavedSearchResults(token, search.id, { limit: 20 });
          setCompanyResults(companyRes.items);
          logger.info("HomeScreen", `Loaded ${companyRes.items.length} companies`);
          break;
          
        case 'investors':
          // Investor searches use the same interest signals API
          setResultType('interest');
          const investorRes = await fetchInvestorInterestSignals(token, search.id, { limit: 20 });
          setInterestResults(investorRes.items);
          logger.info("HomeScreen", `Loaded ${investorRes.items.length} investor signals`);
          break;
          
        case 'stratintel':
          // Strategic intelligence / Interest signals
          setResultType('interest');
          const stratRes = await fetchInvestorInterestSignals(token, search.id, { limit: 20 });
          setInterestResults(stratRes.items);
          logger.info("HomeScreen", `Loaded ${stratRes.items.length} interest signals`);
          break;
          
        default:
          logger.warn("HomeScreen", `Unknown product_type: ${search.product_type}`);
          setResultType('person');
      }
    } catch (err: any) {
      logger.error("HomeScreen", "Failed to load search results", err);
    } finally {
      setIsLoadingResults(false);
    }
  };

  const handlePersonTap = (person: Person) => {
    // Handle both 'id' and 'person_id' fields since talent signals use person_id
    const personId = person.id || (person as any).person_id;
    console.log("[HomeScreen] handlePersonTap - personId:", personId, "full_name:", person.full_name);
    if (!personId) {
      logger.error("HomeScreen", "Cannot navigate - no person ID found", person);
      return;
    }
    navigation.navigate("PersonDetail", { personId });
  };

  // Feed Switcher Animation
  const toggleFeedSwitcher = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (feedSwitcherVisible) {
      // Close
      Animated.parallel([
        Animated.timing(feedSwitcherAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(masterButtonAnim, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start(() => setFeedSwitcherVisible(false));
    } else {
      // Open
      setFeedSwitcherVisible(true);
      Animated.parallel([
        Animated.timing(feedSwitcherAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(masterButtonAnim, {
          toValue: 0.9,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const selectFeed = async (feed: FeedType) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentFeed(feed);
    toggleFeedSwitcher();
  };

  // AI Search Creation
  const handleAISearchCreate = async () => {
    if (!aiSearchPrompt.trim() || !modelReady) return;

    setAiSearchLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // For now, provide a simple suggestion
      // TODO: Integrate with Cactus for proper search criteria generation
      setAiSearchSuggestion(
        `Based on "${aiSearchPrompt}", I suggest:\n\n` +
        `• Seniority: Executive, Director\n` +
        `• Experience: 10+ years\n` +
        `• Highlights: Founded company, Serial entrepreneur\n\n` +
        `Create this search on tryspecter.com to save it.`
      );

      logger.info("HomeScreen", "AI generated search criteria", { prompt: aiSearchPrompt });
    } catch (err: any) {
      logger.error("HomeScreen", "AI search creation failed", err);
      setAiSearchSuggestion("Sorry, I couldn't generate search criteria. Try being more specific about what you're looking for.");
    } finally {
      setAiSearchLoading(false);
    }
  };

  const getCurrentFeedConfig = () => {
    return FEED_OPTIONS.find(f => f.type === currentFeed) || FEED_OPTIONS[0];
  };

  // Render saved search card
  const renderSearchCard = (search: SavedSearch) => {
    const isSelected = selectedSearch?.id === search.id;
    
    return (
      <Pressable
        key={search.id}
        onPress={() => handleSearchSelect(search)}
        style={({ pressed }) => [
          styles.searchCard,
          isSelected && styles.searchCardSelected,
          pressed && styles.searchCardPressed,
        ]}
      >
        <View style={styles.searchCardHeader}>
          <View style={styles.searchCardIcon}>
            <Ionicons
              name={search.is_global ? "globe" : "bookmark"}
              size={16}
              color={isSelected ? "#FFF" : "#64748B"}
            />
          </View>
          <View style={styles.searchCardInfo}>
            <Text style={[styles.searchCardName, isSelected && styles.searchCardNameSelected]} numberOfLines={1}>
              {search.name}
            </Text>
            <Text style={[styles.searchCardType, isSelected && styles.searchCardTypeSelected]}>
              {search.product_type} • {search.full_count.toLocaleString()} results
            </Text>
          </View>
        </View>
        {search.new_count > 0 && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>+{search.new_count} new</Text>
          </View>
        )}
      </Pressable>
    );
  };

  // Render person result card
  const renderPersonCard = (person: Person) => {
    const currentJob = person.experience?.find(e => e.is_current);
    
    return (
      <Pressable
        key={person.id}
        onPress={() => handlePersonTap(person)}
        style={({ pressed }) => [
          styles.personCard,
          pressed && styles.personCardPressed,
        ]}
      >
        {person.profile_image_url ? (
          <Image
            source={{ uri: person.profile_image_url }}
            style={styles.personAvatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.personAvatar, styles.personAvatarPlaceholder]}>
            <Text style={styles.personAvatarText}>
              {person.first_name?.[0]}{person.last_name?.[0]}
            </Text>
          </View>
        )}
        <View style={styles.personInfo}>
          <Text style={styles.personName} numberOfLines={1}>
            {person.full_name}
          </Text>
          {currentJob && (
            <Text style={styles.personRole} numberOfLines={1}>
              {currentJob.title} at {currentJob.company_name}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
      </Pressable>
    );
  };

  // Render company result card
  const renderCompanyCard = (company: Company) => {
    const fundingText = company.funding?.total_funding_usd 
      ? `$${(company.funding.total_funding_usd / 1000000).toFixed(1)}M raised`
      : company.growth_stage || 'Startup';
    
    // Get company name - API returns 'organization_name' for search results
    const companyName = company.organization_name || company.name || 'Unknown Company';
    
    // Get logo URL - prefer Specter logo API with domain, fallback to logo_url
    const domain = company.website?.domain;
    const logoUrl = domain 
      ? `https://app.tryspecter.com/logo?domain=${domain}`
      : company.logo_url;
    
    // Get company ID - API may return 'id' or 'company_id'
    const companyId = company.id || company.company_id || companyName;
    
    return (
      <Pressable
        key={companyId}
        onPress={() => {
          // Navigate to company detail screen
          logger.info("HomeScreen", `Tapped company: ${companyName}`);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate("CompanyDetail", { companyId: companyId });
        }}
        style={({ pressed }) => [
          styles.personCard,
          pressed && styles.personCardPressed,
        ]}
      >
        {logoUrl ? (
          <Image
            source={{ uri: logoUrl }}
            style={styles.companyLogo}
            contentFit="contain"
          />
        ) : (
          <View style={[styles.companyLogo, styles.companyLogoPlaceholder]}>
            <Ionicons name="business" size={20} color="#64748B" />
          </View>
        )}
        <View style={styles.personInfo}>
          <Text style={styles.personName} numberOfLines={1}>
            {companyName}
          </Text>
          <Text style={styles.personRole} numberOfLines={1}>
            {company.industries?.slice(0, 2).join(', ') || 'Company'}
          </Text>
          <View style={styles.companyMeta}>
            <Text style={styles.companyMetaText}>{fundingText}</Text>
            {company.hq?.city && (
              <Text style={styles.companyMetaText}> • {company.hq.city}</Text>
            )}
          </View>
        </View>
        <View style={styles.companyHighlights}>
          {company.highlights?.slice(0, 2).map((h, i) => (
            <View key={i} style={styles.highlightBadge}>
              <Text style={styles.highlightText}>
                {h.replace(/_/g, ' ').slice(0, 12)}
              </Text>
            </View>
          ))}
        </View>
      </Pressable>
    );
  };

  // Render interest signal card
  const renderInterestCard = (signal: InvestorInterestSignal) => {
    const entityName = signal.company?.name || signal.person?.full_name || 'Unknown';
    const entityType = signal.company ? 'Company' : 'Person';
    const investors = signal.signal_investors?.map(i => i.name).join(', ') || 'Unknown investors';
    
    // Get logo URL for company signals using Specter logo API
    const companyWebsite = signal.company?.website;
    const companyLogoUrl = companyWebsite 
      ? `https://app.tryspecter.com/logo?domain=${companyWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
      : null;
    
    return (
      <Pressable
        key={signal.signal_id}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          // Navigate to person if it's a person signal, company if company signal
          if (signal.person && signal.entity_id) {
            navigation.navigate("PersonDetail", { personId: signal.entity_id });
          } else if (signal.company && signal.entity_id) {
            navigation.navigate("CompanyDetail", { companyId: signal.entity_id });
          } else {
            logger.info("HomeScreen", `Tapped interest signal for: ${entityName}`);
          }
        }}
        style={({ pressed }) => [
          styles.personCard,
          styles.interestCard,
          pressed && styles.personCardPressed,
        ]}
      >
        {signal.company && companyLogoUrl ? (
          <Image
            source={{ uri: companyLogoUrl }}
            style={styles.interestLogo}
            contentFit="contain"
          />
        ) : (
          <View style={styles.interestIcon}>
            <Ionicons 
              name={signal.company ? "business" : "person"} 
              size={20} 
              color="#EC4899" 
            />
          </View>
        )}
        <View style={styles.personInfo}>
          <View style={styles.interestHeader}>
            <Text style={styles.personName} numberOfLines={1}>
              {entityName}
            </Text>
            <View style={styles.signalScoreBadge}>
              <Text style={styles.signalScoreText}>{signal.signal_score}/10</Text>
            </View>
          </View>
          <Text style={styles.personRole} numberOfLines={1}>
            {signal.signal_type} • {entityType}
          </Text>
          <Text style={styles.interestInvestors} numberOfLines={1}>
            Interest from: {investors}
          </Text>
          {signal.signal_total_funding_usd && (
            <Text style={styles.interestFunding}>
              ${(signal.signal_total_funding_usd / 1000000).toFixed(1)}M total funding
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
      </Pressable>
    );
  };

  // Render results based on type
  const renderResults = () => {
    if (isLoadingResults) {
      return (
        <View style={styles.resultsLoading}>
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text style={styles.resultsLoadingText}>Loading results...</Text>
        </View>
      );
    }

    switch (resultType) {
      case 'person':
        if (searchResults.length === 0) {
          return <Text style={styles.noResultsText}>No people found</Text>;
        }
        return <View style={styles.resultsList}>{searchResults.map(renderPersonCard)}</View>;
        
      case 'company':
        if (companyResults.length === 0) {
          return <Text style={styles.noResultsText}>No companies found</Text>;
        }
        return <View style={styles.resultsList}>{companyResults.map(renderCompanyCard)}</View>;
        
      case 'interest':
        if (interestResults.length === 0) {
          return <Text style={styles.noResultsText}>No interest signals found</Text>;
        }
        return <View style={styles.resultsList}>{interestResults.map(renderInterestCard)}</View>;
        
      default:
        return null;
    }
  };

  // Get result count based on type
  const getResultCount = () => {
    switch (resultType) {
      case 'person': return searchResults.length;
      case 'company': return companyResults.length;
      case 'interest': return interestResults.length;
      default: return 0;
    }
  };

  if (isLoading && !isRefreshing) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#1a365d" />
        <Text style={styles.loadingText}>Loading your searches...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Ionicons name="prism" size={20} color="#1a365d" />
          </View>
          <Text style={styles.logo}>Specter</Text>
          {/* AI Status */}
          {modelStatus === 'downloading' && (
            <View style={styles.aiStatusBadge}>
              <ActivityIndicator size={10} color="#38BDF8" />
              <Text style={styles.aiStatusText}>AI {modelProgress}%</Text>
            </View>
          )}
          {modelReady && (
            <View style={[styles.aiStatusBadge, styles.aiStatusReady]}>
              <Ionicons name="sparkles" size={10} color="#22C55E" />
              <Text style={[styles.aiStatusText, { color: '#22C55E' }]}>AI</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={() => setAiSearchModalVisible(true)} style={styles.iconButton}>
            <Ionicons name="add-circle-outline" size={22} color="#3B82F6" />
          </Pressable>
          <Pressable onPress={() => navigation.navigate("Settings")} style={styles.iconButton}>
            <Ionicons name="settings-outline" size={22} color="#64748b" />
          </Pressable>
        </View>
      </View>

      {/* Current Feed Indicator */}
      <View style={styles.feedIndicator}>
        <View style={[styles.feedIndicatorDot, { backgroundColor: getCurrentFeedConfig().color }]} />
        <Text style={styles.feedIndicatorText}>
          {getCurrentFeedConfig().label}
        </Text>
        <Text style={styles.feedIndicatorCount}>
          {globalSearches.length + personalSearches.length} searches
        </Text>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={handleRefresh} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (globalSearches.length === 0 && personalSearches.length === 0) ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Saved Searches</Text>
            <Text style={styles.emptySubtitle}>
              Create searches on tryspecter.com or use AI to create one
            </Text>
            <Pressable
              onPress={() => setAiSearchModalVisible(true)}
              style={styles.createSearchButton}
            >
              <Ionicons name="sparkles" size={18} color="#FFF" />
              <Text style={styles.createSearchButtonText}>Create with AI</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Recommended (Global) Searches Dropdown */}
            {globalSearches.length > 0 && (
              <View style={styles.searchesSection}>
                <Pressable 
                  onPress={() => {
                    setGlobalExpanded(!globalExpanded);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.dropdownHeader}
                >
                  <View style={styles.dropdownHeaderLeft}>
                    <Ionicons name="globe-outline" size={18} color="#3B82F6" />
                    <Text style={styles.dropdownTitle}>Recommended</Text>
                    <View style={styles.dropdownBadge}>
                      <Text style={styles.dropdownBadgeText}>{globalSearches.length}</Text>
                    </View>
                  </View>
                  <Ionicons 
                    name={globalExpanded ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#64748B" 
                  />
                </Pressable>
                {globalExpanded && (
                  <View style={styles.searchesGrid}>
                    {globalSearches.map(renderSearchCard)}
                  </View>
                )}
              </View>
            )}

            {/* Personal Searches Dropdown */}
            {personalSearches.length > 0 && (
              <View style={styles.searchesSection}>
                <Pressable 
                  onPress={() => {
                    setPersonalExpanded(!personalExpanded);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.dropdownHeader}
                >
                  <View style={styles.dropdownHeaderLeft}>
                    <Ionicons name="bookmark-outline" size={18} color="#8B5CF6" />
                    <Text style={styles.dropdownTitle}>Your Searches</Text>
                    <View style={[styles.dropdownBadge, { backgroundColor: "#F3E8FF" }]}>
                      <Text style={[styles.dropdownBadgeText, { color: "#8B5CF6" }]}>{personalSearches.length}</Text>
                    </View>
                  </View>
                  <Ionicons 
                    name={personalExpanded ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#64748B" 
                  />
                </Pressable>
                {personalExpanded && (
                  <View style={styles.searchesGrid}>
                    {personalSearches.map(renderSearchCard)}
                  </View>
                )}
              </View>
            )}

            {/* Selected Search Results */}
            {selectedSearch && (
              <View style={styles.resultsSection}>
                <View style={styles.resultsSectionHeader}>
                  <Text style={styles.sectionTitle}>{selectedSearch.name}</Text>
                  <Text style={styles.resultsCount}>
                    {getResultCount()} of {selectedSearch.full_count.toLocaleString()}
                  </Text>
                </View>
                {renderResults()}
              </View>
            )}
          </>
        )}

        {/* AI Preferences Summary */}
        <View style={styles.preferencesCard}>
          <View style={styles.preferencesHeader}>
            <Ionicons name="sparkles" size={18} color="#8B5CF6" />
            <Text style={styles.preferencesTitle}>AI Learning</Text>
          </View>
          <Text style={styles.preferencesText}>
            {getPreferenceSummary()}
          </Text>
        </View>
      </ScrollView>

      {/* Master Feed Switcher Button */}
      <Animated.View
        style={[
          styles.masterButtonContainer,
          {
            bottom: insets.bottom + 20,
            transform: [{ scale: masterButtonAnim }],
          },
        ]}
      >
        <Pressable onPress={toggleFeedSwitcher} style={styles.masterButton}>
          <View style={[styles.masterButtonIcon, { backgroundColor: getCurrentFeedConfig().color }]}>
            <Ionicons name={getCurrentFeedConfig().icon} size={24} color="#FFF" />
          </View>
        </Pressable>
      </Animated.View>

      {/* Feed Switcher Modal */}
      {feedSwitcherVisible && (
        <Pressable style={styles.feedSwitcherOverlay} onPress={toggleFeedSwitcher}>
          <Animated.View
            style={[
              styles.feedSwitcherModal,
              {
                opacity: feedSwitcherAnim,
                transform: [
                  {
                    scale: feedSwitcherAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.feedSwitcherTitle}>Switch Feed</Text>
            <View style={styles.feedSwitcherOptions}>
              {FEED_OPTIONS.map((option) => (
                <Pressable
                  key={option.type}
                  onPress={() => selectFeed(option.type)}
                  style={[
                    styles.feedSwitcherOption,
                    currentFeed === option.type && styles.feedSwitcherOptionActive,
                  ]}
                >
                  <View style={[styles.feedSwitcherOptionIcon, { backgroundColor: option.color }]}>
                    <Ionicons name={option.icon} size={24} color="#FFF" />
                  </View>
                  <Text
                    style={[
                      styles.feedSwitcherOptionLabel,
                      currentFeed === option.type && styles.feedSwitcherOptionLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {currentFeed === option.type && (
                    <Ionicons name="checkmark-circle" size={20} color={option.color} />
                  )}
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </Pressable>
      )}

      {/* AI Search Creator Modal */}
      <Modal
        visible={aiSearchModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAiSearchModalVisible(false)}
      >
        <View style={styles.aiModalOverlay}>
          <View style={styles.aiModalContainer}>
            <View style={styles.aiModalHeader}>
              <View style={styles.aiModalTitleRow}>
                <Ionicons name="sparkles" size={20} color="#8B5CF6" />
                <Text style={styles.aiModalTitle}>AI Search Creator</Text>
              </View>
              <Pressable onPress={() => setAiSearchModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            <Text style={styles.aiModalDescription}>
              Describe what you're looking for and AI will help create search criteria.
            </Text>

            <TextInput
              style={styles.aiModalInput}
              placeholder="e.g., Series A fintech founders in London with prior exits..."
              placeholderTextColor="#94A3B8"
              value={aiSearchPrompt}
              onChangeText={setAiSearchPrompt}
              multiline
              numberOfLines={3}
            />

            {aiSearchSuggestion && (
              <View style={styles.aiSuggestionBox}>
                <Text style={styles.aiSuggestionLabel}>AI Suggestion:</Text>
                <Text style={styles.aiSuggestionText}>{aiSearchSuggestion}</Text>
              </View>
            )}

            <View style={styles.aiModalFooter}>
              <Pressable
                onPress={() => {
                  setAiSearchPrompt("");
                  setAiSearchSuggestion(null);
                }}
                style={styles.aiModalClearButton}
              >
                <Text style={styles.aiModalClearButtonText}>Clear</Text>
              </Pressable>
              <Pressable
                onPress={handleAISearchCreate}
                disabled={!aiSearchPrompt.trim() || aiSearchLoading || !modelReady}
                style={[
                  styles.aiModalCreateButton,
                  (!aiSearchPrompt.trim() || aiSearchLoading || !modelReady) &&
                    styles.aiModalCreateButtonDisabled,
                ]}
              >
                {aiSearchLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color="#FFF" />
                    <Text style={styles.aiModalCreateButtonText}>Generate</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a365d",
    letterSpacing: -0.5,
  },
  aiStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
  },
  aiStatusReady: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderColor: "rgba(34, 197, 94, 0.2)",
  },
  aiStatusText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#38BDF8",
  },
  headerRight: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  feedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    gap: 8,
  },
  feedIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  feedIndicatorText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    flex: 1,
  },
  feedIndicatorCount: {
    fontSize: 12,
    color: "#64748B",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#3B82F6",
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 8,
  },
  createSearchButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#8B5CF6",
    borderRadius: 12,
  },
  createSearchButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },
  searchesSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
  },
  dropdownHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dropdownTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  dropdownBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  dropdownBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3B82F6",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 12,
  },
  searchesGrid: {
    gap: 12,
  },
  searchCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchCardSelected: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  searchCardPressed: {
    opacity: 0.8,
  },
  searchCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  searchCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  searchCardInfo: {
    flex: 1,
  },
  searchCardName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  searchCardNameSelected: {
    color: "#FFF",
  },
  searchCardType: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  searchCardTypeSelected: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  newBadge: {
    backgroundColor: "#22C55E",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  newBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFF",
  },
  resultsSection: {
    padding: 20,
    paddingTop: 0,
  },
  resultsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  resultsCount: {
    fontSize: 12,
    color: "#64748B",
  },
  resultsLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 8,
  },
  resultsLoadingText: {
    fontSize: 14,
    color: "#64748B",
  },
  resultsList: {
    gap: 8,
  },
  personCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  personCardPressed: {
    opacity: 0.8,
  },
  personAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  personAvatarPlaceholder: {
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  personAvatarText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  personRole: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  // Company card styles
  companyLogo: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
  },
  companyLogoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  companyMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  companyMetaText: {
    fontSize: 11,
    color: "#94A3B8",
  },
  companyHighlights: {
    flexDirection: "column",
    gap: 4,
    alignItems: "flex-end",
  },
  highlightBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  highlightText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#059669",
    textTransform: "capitalize",
  },
  // Interest signal card styles
  interestCard: {
    borderLeftWidth: 3,
    borderLeftColor: "#EC4899",
  },
  interestIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FDF2F8",
    alignItems: "center",
    justifyContent: "center",
  },
  interestLogo: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
  },
  interestHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  signalScoreBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  signalScoreText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D97706",
  },
  interestInvestors: {
    fontSize: 11,
    color: "#EC4899",
    marginTop: 4,
  },
  interestFunding: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  noResultsText: {
    textAlign: "center",
    color: "#64748B",
    fontSize: 14,
    padding: 20,
  },
  preferencesCard: {
    margin: 20,
    padding: 16,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  preferencesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  preferencesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  preferencesText: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 20,
  },
  masterButtonContainer: {
    position: "absolute",
    right: 20,
    zIndex: 100,
  },
  masterButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  masterButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  feedSwitcherOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 200,
  },
  feedSwitcherModal: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 24,
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 360,
  },
  feedSwitcherTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 20,
  },
  feedSwitcherOptions: {
    gap: 12,
  },
  feedSwitcherOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    gap: 12,
  },
  feedSwitcherOptionActive: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  feedSwitcherOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  feedSwitcherOptionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
  },
  feedSwitcherOptionLabelActive: {
    color: "#3B82F6",
  },
  aiModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  aiModalContainer: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  aiModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  aiModalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
  },
  aiModalDescription: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 16,
    lineHeight: 20,
  },
  aiModalInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: "#1E293B",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    minHeight: 80,
    textAlignVertical: "top",
  },
  aiSuggestionBox: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#F5F3FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  aiSuggestionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7C3AED",
    marginBottom: 8,
  },
  aiSuggestionText: {
    fontSize: 14,
    color: "#1E293B",
    lineHeight: 20,
  },
  aiModalFooter: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  aiModalClearButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  aiModalClearButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
  },
  aiModalCreateButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#8B5CF6",
  },
  aiModalCreateButtonDisabled: {
    backgroundColor: "#CBD5E1",
  },
  aiModalCreateButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFF",
  },
});

