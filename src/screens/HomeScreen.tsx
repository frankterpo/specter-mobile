/**
 * HomeScreen - The new default landing screen
 * 
 * Shows saved searches as the primary content, with a floating
 * master button to switch between feeds (People, Companies, Talent, Investor Interest).
 * 
 * Includes AI-assisted saved search creation via Cactus.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Modal,
  TextInput,
  Dimensions,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Linking,
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
  likePerson,
  dislikePerson,
} from "../api/specter";
import { logger } from "../utils/logger";
import { getFounderAgent } from "../ai/founderAgent";
import { getAgentMemory, InvestmentPersona, EntityFeatures } from "../ai/agentMemory";
import BulkActionSheet, { BulkActionEntity } from "../components/BulkActionSheet";
import { Alert } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = 80; // Minimum swipe distance to trigger action
const PAGE_SIZE = 20; // Items per page for pagination
const SCROLL_THRESHOLD = 500; // Pixels from bottom to trigger load more

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<MainStackParamList, "Dashboard">;
};

type FeedType = "people" | "companies" | "talent" | "investors" | "interest";

// Track which cards are being swiped
type SwipeState = {
  [key: string]: {
    translateX: Animated.Value;
    isProcessing: boolean;
  };
};

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
  const [resultsTotal, setResultsTotal] = useState<number | null>(null); // Total from API response
  // Pagination state - using refs to avoid stale closure issues
  const [resultsOffset, setResultsOffset] = useState(0);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const resultsOffsetRef = useRef(0);
  const hasMoreRef = useRef(false);
  const isLoadingMoreRef = useRef(false);
  
  // Keep refs in sync with state
  useEffect(() => { resultsOffsetRef.current = resultsOffset; }, [resultsOffset]);
  useEffect(() => { hasMoreRef.current = hasMoreResults; }, [hasMoreResults]);
  useEffect(() => { isLoadingMoreRef.current = isLoadingMore; }, [isLoadingMore]);

  // Dropdown state for search sections - start expanded so user can select a search
  const [globalExpanded, setGlobalExpanded] = useState(true);
  const [personalExpanded, setPersonalExpanded] = useState(true);

  // Feed state
  const [currentFeed, setCurrentFeed] = useState<FeedType>("people");
  
  // Agent actions modal state
  const [agentActionsVisible, setAgentActionsVisible] = useState(false);
  const agentActionsAnim = useRef(new Animated.Value(0)).current;
  const masterButtonAnim = useRef(new Animated.Value(1)).current;
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  
  // Persona state
  const [personas, setPersonas] = useState<InvestmentPersona[]>([]);
  const [activePersona, setActivePersonaState] = useState<InvestmentPersona | null>(null);
  const [autoProcessProgress, setAutoProcessProgress] = useState(0);
  
  // Bulk Action Sheet state
  const [bulkSheetVisible, setBulkSheetVisible] = useState(false);
  const [bulkSheetAction, setBulkSheetAction] = useState<'like' | 'dislike'>('like');
  const [bulkEntities, setBulkEntities] = useState<BulkActionEntity[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // AI Search Creator state
  const [aiSearchModalVisible, setAiSearchModalVisible] = useState(false);
  const [aiSearchPrompt, setAiSearchPrompt] = useState("");
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [aiSearchSuggestion, setAiSearchSuggestion] = useState<string | null>(null);

  // Swipe state for cards
  const [swipeStates, setSwipeStates] = useState<SwipeState>({});
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Expanded profile state - which card is expanded inline
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
    // Clear selection and results when switching feeds
    setSelectedSearch(null);
    setSearchResults([]);
    setCompanyResults([]);
    setInterestResults([]);
    // Reset dropdowns to expanded
    setGlobalExpanded(true);
    setPersonalExpanded(true);
    
    loadSavedSearches();
  }, [currentFeed]);

  const handleSearchSelect = async (search: SavedSearch) => {
    setSelectedSearch(search);
    setIsLoadingResults(true);
    // Collapse dropdowns to give room for results
    setGlobalExpanded(false);
    setPersonalExpanded(false);
    // Clear previous results and reset pagination
    setSearchResults([]);
    setCompanyResults([]);
    setInterestResults([]);
    setResultsTotal(null);
    setResultsOffset(0);
    setHasMoreResults(false);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const token = await getToken();
      if (!token) throw new AuthError("Not authenticated");

      // Helper to extract features for scoring
      const extractPersonFeatures = (p: Person): EntityFeatures => {
        const experienceArray = Array.isArray(p.experience) ? p.experience : (p.experience ? [p.experience] : []);
        const eduArray = Array.isArray(p.education) ? p.education : (p.education ? [p.education] : []);
        return {
          industry: experienceArray.find(e => e.is_current)?.industry,
          seniority: p.seniority,
          region: p.region,
          highlights: p.people_highlights,
          companies: experienceArray.map(e => e.company_name).filter(Boolean) as string[],
          education: eduArray.map(e => e.name || e.school_name || e.school).filter(Boolean) as string[],
        };
      };

      const memory = getAgentMemory();

      switch (search.product_type) {
        case 'people':
          setResultType('person');
          const peopleResults = await fetchPeopleSavedSearchResults(token, search.id, { limit: PAGE_SIZE, offset: 0 });
          // Rank results by preference score
          const rankedPeople = peopleResults.items
            .map(p => ({
              ...p,
              _matchScore: memory.calculateMatchScore(extractPersonFeatures(p)).score,
              _matchReasons: memory.calculateMatchScore(extractPersonFeatures(p)).reasons,
            }))
            .sort((a, b) => b._matchScore - a._matchScore);
          setSearchResults(rankedPeople);
          setResultsTotal(peopleResults.total ?? rankedPeople.length);
          // KEY: hasMore = got full page (might be more)
          setHasMoreResults(rankedPeople.length === PAGE_SIZE);
          setResultsOffset(PAGE_SIZE);
          logger.info("HomeScreen", `[PAGINATION] Initial load: ${rankedPeople.length} people, hasMore: ${rankedPeople.length === PAGE_SIZE}`);
          break;
          
        case 'talent':
          setResultType('person');
          // Talent signals returns full person data with signal metadata
          const talentResults = await fetchTalentSignals(token, search.id, { limit: PAGE_SIZE, offset: 0 });
          // Map talent signals to Person-like objects with scores
          const mappedTalent = talentResults.items
            .filter(signal => signal.person_id) // Only include signals with person_id
            .map(signal => {
              const features: EntityFeatures = {
                region: signal.region,
                seniority: signal.level_of_seniority,
                signalType: signal.signal_type,
              };
              const { score, reasons } = memory.calculateMatchScore(features);
              return {
                id: signal.person_id, // CRITICAL: Map person_id to id
                full_name: signal.full_name || 'Unknown',
                first_name: signal.first_name || '',
                last_name: signal.last_name || '',
                profile_image_url: signal.profile_picture_url,
                tagline: signal.tagline || `${signal.signal_type}: ${signal.new_position_company_name || 'New Role'}`,
                region: signal.region,
                seniority: signal.level_of_seniority,
                experience: signal.experience ? [signal.experience] : [],
                _matchScore: score,
                _matchReasons: reasons,
                signal_type: signal.signal_type, // Preserve signal type for scoring
              };
            }) as (Person & { _matchScore: number; _matchReasons: string[], signal_type?: string })[];
          // Sort by match score
          mappedTalent.sort((a, b) => b._matchScore - a._matchScore);
          setSearchResults(mappedTalent);
          setResultsTotal(talentResults.total ?? mappedTalent.length);
          // KEY: hasMore = got full page (might be more)
          setHasMoreResults(talentResults.items.length === PAGE_SIZE);
          setResultsOffset(PAGE_SIZE);
          logger.info("HomeScreen", `[PAGINATION] Initial load: ${mappedTalent.length} talent, hasMore: ${talentResults.items.length === PAGE_SIZE}`);
          break;
          
        case 'company':
          setResultType('company');
          const companyRes = await fetchCompanySavedSearchResults(token, search.id, { limit: PAGE_SIZE, offset: 0 });
          setCompanyResults(companyRes.items);
          setResultsTotal(companyRes.total ?? companyRes.items.length);
          setHasMoreResults(companyRes.items.length === PAGE_SIZE);
          setResultsOffset(PAGE_SIZE);
          logger.info("HomeScreen", `[PAGINATION] Initial load: ${companyRes.items.length} companies, hasMore: ${companyRes.items.length === PAGE_SIZE}`);
          break;
          
        case 'investors':
          // Investor searches use the same interest signals API
          setResultType('interest');
          const investorRes = await fetchInvestorInterestSignals(token, search.id, { limit: PAGE_SIZE, offset: 0 });
          setInterestResults(investorRes.items);
          setResultsTotal(investorRes.total ?? investorRes.items.length);
          setHasMoreResults(investorRes.items.length === PAGE_SIZE);
          setResultsOffset(PAGE_SIZE);
          logger.info("HomeScreen", `[PAGINATION] Initial load: ${investorRes.items.length} investor signals, hasMore: ${investorRes.items.length === PAGE_SIZE}`);
          break;
          
        case 'stratintel':
          // Strategic intelligence / Interest signals
          setResultType('interest');
          const stratRes = await fetchInvestorInterestSignals(token, search.id, { limit: PAGE_SIZE, offset: 0 });
          setInterestResults(stratRes.items);
          setResultsTotal(stratRes.total ?? stratRes.items.length);
          setHasMoreResults(stratRes.items.length === PAGE_SIZE);
          setResultsOffset(PAGE_SIZE);
          logger.info("HomeScreen", `[PAGINATION] Initial load: ${stratRes.items.length} interest signals, hasMore: ${stratRes.items.length === PAGE_SIZE}`);
          break;
          
        default:
          logger.warn("HomeScreen", `Unknown product_type: ${search.product_type}`);
          setResultType('person');
      }
      setIsLoadingResults(false);
    } catch (err: any) {
      logger.error("HomeScreen", "Failed to load search results", err);
    } finally {
      setIsLoadingResults(false);
    }
  };

  const loadMoreResults = async () => {
    // GUARDS using refs to get current values (avoids stale closure)
    if (!selectedSearch || isLoadingMoreRef.current || !hasMoreRef.current) {
      console.log('[PAGINATION] loadMore blocked:', { 
        hasSearch: !!selectedSearch, 
        isLoading: isLoadingMoreRef.current, 
        hasMore: hasMoreRef.current,
        currentOffset: resultsOffsetRef.current,
      });
      return;
    }

    const currentOffset = resultsOffsetRef.current;
    console.log(`[PAGINATION] Loading more... offset=${currentOffset}`);
    
    // Set loading state immediately via both ref and state
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    
    try {
      const token = await getToken();
      if (!token) throw new AuthError("Not authenticated");

      const memory = getAgentMemory();
      const extractPersonFeatures = (p: Person): EntityFeatures => {
        const experienceArray = Array.isArray(p.experience) ? p.experience : (p.experience ? [p.experience] : []);
        const eduArray = Array.isArray((p as any).education) ? (p as any).education : ((p as any).education ? [(p as any).education] : []);
        return {
          industry: experienceArray.find((e: any) => e.is_current)?.industry,
          seniority: p.seniority,
          region: p.region,
          highlights: p.people_highlights,
          companies: experienceArray.map((e: any) => e.company_name).filter(Boolean) as string[],
          education: eduArray.map((e: any) => e.name || e.school_name || e.school).filter(Boolean) as string[],
        };
      };

      let fetchedCount = 0;

      switch (selectedSearch.product_type) {
        case 'people': {
          const res = await fetchPeopleSavedSearchResults(token, selectedSearch.id, { limit: PAGE_SIZE, offset: currentOffset });
          fetchedCount = res.items.length;
          const ranked = res.items.map(p => ({
            ...p,
            _matchScore: memory.calculateMatchScore(extractPersonFeatures(p)).score,
            _matchReasons: memory.calculateMatchScore(extractPersonFeatures(p)).reasons,
          })).sort((a, b) => b._matchScore - a._matchScore);
          setSearchResults(prev => [...prev, ...ranked]);
          break;
        }
        case 'talent': {
          const res = await fetchTalentSignals(token, selectedSearch.id, { limit: PAGE_SIZE, offset: currentOffset });
          fetchedCount = res.items.length;
          const mapped = res.items.filter(s => s.person_id).map(signal => {
            const { score, reasons } = memory.calculateMatchScore({
              region: signal.region,
              seniority: signal.level_of_seniority,
              signalType: signal.signal_type,
            });
            return {
              id: signal.person_id,
              full_name: signal.full_name || 'Unknown',
              first_name: signal.first_name || '',
              last_name: signal.last_name || '',
              profile_image_url: signal.profile_picture_url,
              tagline: signal.tagline || `${signal.signal_type}: ${signal.new_position_company_name || 'New Role'}`,
              region: signal.region,
              seniority: signal.level_of_seniority,
              experience: signal.experience ? [signal.experience] : [],
              _matchScore: score,
              _matchReasons: reasons,
              signal_type: signal.signal_type,
            };
          }) as (Person & { _matchScore: number; _matchReasons: string[], signal_type?: string })[];
          mapped.sort((a, b) => b._matchScore - a._matchScore);
          setSearchResults(prev => [...prev, ...mapped]);
          break;
        }
        case 'company': {
          const res = await fetchCompanySavedSearchResults(token, selectedSearch.id, { limit: PAGE_SIZE, offset: currentOffset });
          fetchedCount = res.items.length;
          setCompanyResults(prev => [...prev, ...res.items]);
          break;
        }
        case 'investors':
        case 'stratintel': {
          const res = await fetchInvestorInterestSignals(token, selectedSearch.id, { limit: PAGE_SIZE, offset: currentOffset });
          fetchedCount = res.items.length;
          setInterestResults(prev => [...prev, ...res.items]);
          break;
        }
      }

      // KEY LOGIC: If we got a full page, assume there's more
      const moreAvailable = fetchedCount === PAGE_SIZE;
      const newOffset = currentOffset + PAGE_SIZE;
      
      // Update both refs and state
      hasMoreRef.current = moreAvailable;
      resultsOffsetRef.current = newOffset;
      setHasMoreResults(moreAvailable);
      setResultsOffset(newOffset);
      
      console.log(`[PAGINATION] Loaded ${fetchedCount} items. hasMore=${moreAvailable}, newOffset=${newOffset}`);
      
    } catch (err: any) {
      logger.error("HomeScreen", "Failed to load more results", err);
      // On error, stop trying to load more
      hasMoreRef.current = false;
      setHasMoreResults(false);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
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

  // ============================================
  // QUICK ACTIONS - Like/Dislike without navigation
  // ============================================

  const handleQuickLike = async (person: Person) => {
    const personId = person.id || (person as any).person_id;
    if (!personId || processingIds.has(personId)) return;

    setProcessingIds(prev => new Set(prev).add(personId));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      // Call API
      await likePerson(token, personId);

      // Record to memory with +1.0 reward
      const memory = getAgentMemory();
      const currentJob = person.experience?.find(e => e.is_current);
      memory.recordLike(
        { id: personId, name: person.full_name || 'Unknown' },
        `Quick liked from feed`
      );
      memory.learnFromLike({
        industry: currentJob?.industry,
        seniority: person.seniority,
        region: person.region,
        highlights: person.people_highlights,
      });

      // Remove from list (show next)
      setSearchResults(prev => prev.filter(p => (p.id || (p as any).person_id) !== personId));
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      logger.info("HomeScreen", `Quick liked: ${person.full_name}`, { personId, reward: +1.0 });
    } catch (err: any) {
      logger.error("HomeScreen", "Quick like failed", err);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(personId);
        return next;
      });
    }
  };

  const handleQuickDislike = async (person: Person) => {
    const personId = person.id || (person as any).person_id;
    if (!personId || processingIds.has(personId)) return;

    setProcessingIds(prev => new Set(prev).add(personId));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      // Call API
      await dislikePerson(token, personId);

      // Record to memory with -1.0 reward
      const memory = getAgentMemory();
      const currentJob = person.experience?.find(e => e.is_current);
      memory.recordDislike(
        { id: personId, name: person.full_name || 'Unknown' },
        `Quick disliked from feed`
      );
      memory.learnFromDislike({
        industry: currentJob?.industry,
        seniority: person.seniority,
        region: person.region,
        highlights: person.people_highlights,
      });

      // Remove from list (show next)
      setSearchResults(prev => prev.filter(p => (p.id || (p as any).person_id) !== personId));
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      logger.info("HomeScreen", `Quick disliked: ${person.full_name}`, { personId, reward: -1.0 });
    } catch (err: any) {
      logger.error("HomeScreen", "Quick dislike failed", err);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(personId);
        return next;
      });
    }
  };

  // Get or create swipe animation value for a card
  const getSwipeAnim = (id: string): Animated.Value => {
    if (!swipeStates[id]) {
      const newAnim = new Animated.Value(0);
      setSwipeStates(prev => ({
        ...prev,
        [id]: { translateX: newAnim, isProcessing: false }
      }));
      return newAnim;
    }
    return swipeStates[id].translateX;
  };

  // Handle expanding/collapsing a person card inline
  const handleExpandPerson = (person: Person) => {
    const personId = person.id || (person as any).person_id;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (expandedPersonId === personId) {
      // Collapse
      setExpandedPersonId(null);
    } else {
      // Expand (no AI analysis on expand - keep it fast)
      setExpandedPersonId(personId);
    }
  };

  // Handle expanding/collapsing a company card inline
  const handleExpandCompany = async (company: Company) => {
    const companyId = company.id || company.company_id || company.organization_name;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (expandedCompanyId === companyId) {
      // Collapse
      setExpandedCompanyId(null);
    } else {
      // Expand
      setExpandedCompanyId(companyId);
    }
  };

  // Create pan responder for swipe gestures
  const createPanResponder = (person: Person) => {
    const personId = person.id || (person as any).person_id;
    if (!personId) return null;

    const translateX = new Animated.Value(0);

    return {
      translateX,
      panResponder: PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Only capture horizontal swipes
          return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 20;
        },
        onPanResponderGrant: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
        onPanResponderMove: (_, gestureState) => {
          translateX.setValue(gestureState.dx);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > SWIPE_THRESHOLD) {
            // Swipe right = Like
            Animated.timing(translateX, {
              toValue: SCREEN_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              handleQuickLike(person);
            });
          } else if (gestureState.dx < -SWIPE_THRESHOLD) {
            // Swipe left = Dislike
            Animated.timing(translateX, {
              toValue: -SCREEN_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              handleQuickDislike(person);
            });
          } else {
            // Snap back
            Animated.spring(translateX, {
              toValue: 0,
              friction: 5,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    };
  };

  // Load personas
  const loadPersonas = async () => {
    const memory = getAgentMemory();
    await memory.load();
    setPersonas(memory.getPersonas());
    setActivePersonaState(memory.getActivePersona());
  };

  // Set active persona
  const handleSetActivePersona = async (personaId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const memory = getAgentMemory();
    memory.setActivePersona(personaId);
    setActivePersonaState(memory.getActivePersona());
  };

  // Agent Actions Modal Animation
  const toggleAgentActions = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Load personas when opening
    if (!agentActionsVisible) {
      loadPersonas();
    }
    
    if (agentActionsVisible) {
      // Close - animate down
      Animated.spring(agentActionsAnim, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }).start(() => setAgentActionsVisible(false));
    } else {
      // Open - set to 0 first, then animate to 1
      agentActionsAnim.setValue(0);
      setAgentActionsVisible(true);
      Animated.spring(agentActionsAnim, {
        toValue: 1,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }).start();
    }
  };

  // Prepare bulk action - shows the BulkActionSheet for user confirmation
  const handleAutoProcess = async (action: 'like' | 'dislike') => {
    if (!selectedSearch || searchResults.length === 0) {
      Alert.alert("No Results", "Select a saved search first to auto-process signals.");
      return;
    }

    toggleAgentActions(); // Close the agent actions modal
    
    const memory = getAgentMemory();
    await memory.load();
    
    // Helper to infer funding stage
    const inferFundingStage = (amount?: number): string | undefined => {
      if (!amount) return undefined;
      if (amount < 1000000) return 'pre-seed';
      if (amount < 5000000) return 'seed';
      if (amount < 20000000) return 'series_a';
      if (amount < 50000000) return 'series_b';
      return 'growth';
    };
    
    // Prepare entities for the bulk action sheet
    const entitiesToProcess: BulkActionEntity[] = searchResults
      .slice(0, 20) // Limit to 20 at a time
      .map(person => {
        const personId = person.id || (person as any).person_id;
        const currentJob = person.experience?.find(e => e.is_current);
        
        // Score entity against active persona
        const features = {
          industry: currentJob?.industry,
          seniority: person.seniority,
          region: person.region,
          highlights: person.people_highlights,
          signalType: (person as any).signal_type,
          fundingStage: inferFundingStage(currentJob?.total_funding_amount),
        };
        const { score, reasons } = memory.scoreEntityForPersona(features);
        
        return {
          id: personId,
          name: person.full_name || 'Unknown',
          type: 'person' as const,
          subtitle: currentJob ? `${currentJob.title} at ${currentJob.company_name}` : undefined,
          imageUrl: person.profile_image_url,
          matchScore: score,
          matchReasons: reasons,
          features,
        };
      })
      .filter(e => e.id); // Filter out entities without IDs
    
    // Sort by match score (highest first for likes, lowest first for dislikes)
    entitiesToProcess.sort((a, b) => {
      const scoreA = a.matchScore || 0;
      const scoreB = b.matchScore || 0;
      return action === 'like' ? scoreB - scoreA : scoreA - scoreB;
    });
    
    setBulkEntities(entitiesToProcess);
    setBulkSheetAction(action);
    setBulkSheetVisible(true);
    
    logger.info("HomeScreen", `Prepared ${entitiesToProcess.length} entities for bulk ${action}`, {
      avgScore: entitiesToProcess.reduce((sum, e) => sum + (e.matchScore || 0), 0) / entitiesToProcess.length,
    });
  };

  // Execute the confirmed bulk action
  const handleBulkConfirm = async (selectedIds: string[], action: 'like' | 'dislike') => {
    setIsBulkProcessing(true);
    
    const memory = getAgentMemory();
    
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      let processed = 0;
      const total = selectedIds.length;

      for (const personId of selectedIds) {
        const person = searchResults.find(p => (p.id || (p as any).person_id) === personId);
        if (!person) continue;

        // Skip if already processed
        if (memory.isLiked(personId) || memory.isDisliked(personId)) {
          processed++;
          continue;
        }

        try {
          const currentJob = person.experience?.find(e => e.is_current);
          const features = {
            industry: currentJob?.industry,
            seniority: person.seniority,
            region: person.region,
            highlights: person.people_highlights,
          };

          if (action === 'like') {
            await likePerson(token, personId);
            memory.recordLike(
              { id: personId, name: person.full_name || 'Unknown', type: 'person', features },
              'Bulk liked via AI agent'
            );
          } else {
            await dislikePerson(token, personId);
            memory.recordDislike(
              { id: personId, name: person.full_name || 'Unknown', type: 'person', features },
              'Bulk passed via AI agent'
            );
          }
          processed++;
        } catch (err) {
          logger.warn("HomeScreen", `Failed to ${action} ${personId}`, err);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 150));
      }

      // Remove processed items from list
      setSearchResults(prev => prev.filter(p => !selectedIds.includes(p.id || (p as any).person_id)));
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Bulk Action Complete", 
        `${action === 'like' ? 'Liked' : 'Passed on'} ${processed} signals.`
      );
      
      logger.info("HomeScreen", `Bulk ${action} completed`, { processed, total });
    } catch (err: any) {
      logger.error("HomeScreen", "Bulk action failed", err);
      Alert.alert("Error", err.message || "Failed to process bulk action");
    } finally {
      setIsBulkProcessing(false);
      setBulkSheetVisible(false);
      setBulkEntities([]);
    }
  };

  // Open thesis refinement chat
  const handleThesisRefinement = () => {
    toggleAgentActions();
    // Navigate to a chat/memory refinement screen or open a modal
    // For now, show the AI search modal repurposed for thesis chat
    setAiSearchPrompt("");
    setAiSearchSuggestion(null);
    setAiSearchModalVisible(true);
  };

  // View AI Learning / Memory stats
  const handleViewAILearning = () => {
    toggleAgentActions();
    navigation.navigate("Diagnostics");
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
              {search.product_type}
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

  // Render person result card with inline actions, swipe, and expandable profile
  const renderPersonCard = (person: Person & { _matchScore?: number; _matchReasons?: string[] }) => {
    const currentJob = person.experience?.find(e => e.is_current);
    const personId = person.id || (person as any).person_id;
    const isProcessing = processingIds.has(personId);
    const isExpanded = expandedPersonId === personId;
    
    // Create swipe handler (only if not expanded)
    const swipeHandler = !isExpanded ? createPanResponder(person) : null;
    
    // Match score - use pre-calculated if available, otherwise calculate
    const memory = getAgentMemory();
    const features: EntityFeatures = {
      industry: currentJob?.industry,
      seniority: person.seniority,
      region: person.region,
      highlights: person.people_highlights,
    };
    const matchScore = person._matchScore ?? memory.calculateMatchScore(features).score;
    const matchReasons = person._matchReasons ?? memory.calculateMatchScore(features).reasons;
    
    return (
      <View style={styles.expandableCardContainer}>
        <Animated.View
          style={[
            styles.swipeableCard,
            swipeHandler && {
              transform: [{ translateX: swipeHandler.translateX }],
            },
          ]}
          {...(swipeHandler?.panResponder.panHandlers)}
        >

          {/* Main card - tap to expand */}
          <Pressable
            onPress={() => handleExpandPerson(person)}
            style={({ pressed }) => [
              styles.personCard,
              isExpanded && styles.personCardExpanded,
              pressed && !isExpanded && styles.personCardPressed,
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
              <View style={styles.personNameRow}>
                <Text style={styles.personName} numberOfLines={1}>
                  {person.full_name}
                </Text>
                {/* Match Score Badge */}
                {matchScore >= 60 && (
                  <View style={[
                    styles.matchScoreBadge,
                    matchScore >= 80 ? styles.matchScoreHigh : 
                    matchScore >= 70 ? styles.matchScoreMedium : styles.matchScoreLow
                  ]}>
                    <Text style={styles.matchScoreText}>{matchScore}%</Text>
                  </View>
                )}
              </View>
              {currentJob && (
                <Text style={styles.personRole} numberOfLines={1}>
                  {currentJob.title} at {currentJob.company_name}
                </Text>
              )}
              {/* Quick highlight or match reason */}
              {!isExpanded && (matchReasons.length > 0 && !matchReasons[0]?.includes('No specific criteria') ? (
                <View style={styles.quickHighlight}>
                  <Ionicons name="checkmark-circle" size={10} color="#22C55E" />
                  <Text style={styles.quickHighlightText} numberOfLines={1}>
                    {matchReasons[0]?.replace(/[✓🔥👍🎯]/g, '').trim()}
                  </Text>
                </View>
              ) : person.people_highlights?.[0] && (
                <View style={styles.quickHighlight}>
                  <Ionicons name="star" size={10} color="#F59E0B" />
                  <Text style={styles.quickHighlightText} numberOfLines={1}>
                    {person.people_highlights[0].replace(/_/g, ' ')}
                  </Text>
                </View>
              ))}
            </View>

            {/* Inline Quick Actions */}
            <View style={styles.quickActions}>
              <Pressable
                onPress={(e) => { e.stopPropagation(); handleQuickLike(person); }}
                disabled={isProcessing}
                style={({ pressed }) => [
                  styles.quickActionButton,
                  styles.quickActionLike,
                  pressed && styles.quickActionPressed,
                ]}
              >
                {isProcessing ? (
                  <ActivityIndicator size={14} color="#22C55E" />
                ) : (
                  <Ionicons name="star-outline" size={16} color="#000" />
                )}
              </Pressable>
              <Pressable
                onPress={(e) => { e.stopPropagation(); handleQuickDislike(person); }}
                disabled={isProcessing}
                style={({ pressed }) => [
                  styles.quickActionButton,
                  styles.quickActionDislike,
                  pressed && styles.quickActionPressed,
                ]}
              >
                {isProcessing ? (
                  <ActivityIndicator size={14} color="#EF4444" />
                ) : (
                  <Ionicons name="close-circle-outline" size={16} color="#000" />
                )}
              </Pressable>
            </View>
            
            {/* Expand indicator */}
            <Ionicons 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={16} 
              color="#94A3B8" 
              style={styles.expandIndicator}
            />
          </Pressable>
        </Animated.View>

        {/* Expanded Profile Section - Clean Card Style */}
        {isExpanded && (
          <View style={styles.expandedProfile}>
            {/* Tagline Section */}
            <View style={styles.expSection}>
              <Text style={styles.expLabel}>Tagline</Text>
              <Text style={styles.expValue}>{person.tagline || currentJob?.title || 'No tagline'}</Text>
            </View>

            {/* Current Experience with Company Logo */}
            {currentJob && (
              <View style={styles.expSection}>
                <Text style={styles.expLabel}>Current Experience</Text>
                <View style={styles.expCompanyRow}>
                  <Image
                    source={{ uri: `https://app.tryspecter.com/logo?domain=${currentJob.company_name?.toLowerCase().replace(/\s+/g, '')}.com` }}
                    style={styles.expCompanyLogo}
                    contentFit="contain"
                  />
                  <View style={styles.expCompanyInfo}>
                    <Text style={styles.expCompanyName}>{currentJob.company_name}</Text>
                    <Text style={styles.expCompanyTitle}>{currentJob.title}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Previous Experience Logos */}
            {person.experience && person.experience.length > 1 && (
              <View style={styles.expSection}>
                <Text style={styles.expLabel}>Previous</Text>
                <View style={styles.expPrevLogos}>
                  {person.experience.slice(1, 4).map((exp, idx) => (
                    <Image
                      key={idx}
                      source={{ uri: `https://app.tryspecter.com/logo?domain=${exp.company_name?.toLowerCase().replace(/\s+/g, '')}.com` }}
                      style={styles.expPrevLogo}
                      contentFit="contain"
                    />
                  ))}
                  {person.experience.length > 4 && (
                    <View style={styles.expMoreBadge}>
                      <Text style={styles.expMoreText}>+{person.experience.length - 4}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Two Column Stats */}
            <View style={styles.expStatsRow}>
              <View style={styles.expStatCol}>
                <Text style={styles.expLabel}>Region</Text>
                <Text style={styles.expStatValue}>{person.region || 'Unknown'}</Text>
              </View>
              <View style={styles.expStatCol}>
                <Text style={styles.expLabel}>Seniority</Text>
                <Text style={styles.expStatValue}>{person.seniority || 'Unknown'}</Text>
              </View>
            </View>

            <View style={styles.expStatsRow}>
              <View style={styles.expStatCol}>
                <Text style={styles.expLabel}>Followers</Text>
                <Text style={styles.expStatValue}>
                  {person.followers_count ? person.followers_count.toLocaleString() : '—'}
                </Text>
              </View>
              <View style={styles.expStatCol}>
                <Text style={styles.expLabel}>Connections</Text>
                <Text style={styles.expStatValue}>
                  {person.connections_count ? person.connections_count.toLocaleString() : '—'}
                </Text>
              </View>
            </View>

            {/* Socials - LinkedIn opens profile */}
            <View style={styles.expSection}>
              <Text style={styles.expLabel}>Socials</Text>
              <View style={styles.expSocials}>
                <Pressable 
                  style={styles.socialIcon}
                  onPress={() => {
                    const linkedinUrl = person.linkedin_url || `https://linkedin.com/in/${person.full_name?.toLowerCase().replace(/\s+/g, '-')}`;
                    Linking.openURL(linkedinUrl);
                  }}
                >
                  <Ionicons name="logo-linkedin" size={16} color="#0A66C2" />
                </Pressable>
                {person.email && (
                  <Pressable 
                    style={styles.socialIcon}
                    onPress={() => Linking.openURL(`mailto:${person.email}`)}
                  >
                    <Ionicons name="mail-outline" size={16} color="#64748B" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* View Full Profile */}
            <Pressable
              onPress={() => {
                setExpandedPersonId(null);
                navigation.navigate("PersonDetail", { personId });
              }}
              style={styles.expFullProfile}
            >
              <Text style={styles.expFullProfileText}>View Full Profile</Text>
              <Ionicons name="arrow-forward" size={14} color="#3B82F6" />
            </Pressable>
          </View>
        )}
      </View>
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
        onPress={() => {
          // Navigate to company detail screen with full company data
          logger.info("HomeScreen", `Tapped company: ${companyName}`);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate("CompanyDetail", { companyId: companyId, companyData: company });
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

  // Skeleton loading card component
  const SkeletonCard = ({ index }: { index: number }) => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }, []);

    const opacity = shimmerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.7],
    });

    return (
      <Animated.View 
        style={[
          styles.skeletonCard, 
          { opacity, transform: [{ translateY: index * 2 }] }
        ]}
      >
        <View style={styles.skeletonHeader}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonHeaderText}>
            <View style={styles.skeletonName} />
            <View style={styles.skeletonRole} />
          </View>
        </View>
        <View style={styles.skeletonBody}>
          <View style={styles.skeletonLine} />
          <View style={[styles.skeletonLine, { width: '60%' }]} />
        </View>
        <View style={styles.skeletonActions}>
          <View style={styles.skeletonButton} />
          <View style={styles.skeletonButton} />
        </View>
      </Animated.View>
    );
  };

  // Render skeleton loading state
  const renderSkeletonLoading = () => (
    <View style={styles.skeletonContainer}>
      {[0, 1, 2, 3].map((i) => (
        <SkeletonCard key={i} index={i} />
      ))}
    </View>
  );

  // Render results based on type
  const renderResults = () => {
    if (isLoadingResults) {
      return renderSkeletonLoading();
    }

    const renderFooter = () => {
      if (!isLoadingMore) return null;
      return (
        <View style={styles.loadMoreFooter}>
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text style={styles.loadMoreText}>Loading more...</Text>
        </View>
      );
    };

    switch (resultType) {
      case 'person':
        if (searchResults.length === 0) {
          return (
            <View style={styles.emptyResults}>
              <Ionicons name="people-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyResultsTitle}>No people found</Text>
              <Text style={styles.emptyResultsSubtitle}>Try selecting a different search</Text>
            </View>
          );
        }
        return (
          <View style={styles.resultsList}>
            {searchResults.map((item, index) => (
              <View key={`person-${item.id || index}-${index}`}>
                {renderPersonCard(item)}
              </View>
            ))}
            {renderFooter()}
          </View>
        );
        
      case 'company':
        if (companyResults.length === 0) {
          return (
            <View style={styles.emptyResults}>
              <Ionicons name="business-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyResultsTitle}>No companies found</Text>
              <Text style={styles.emptyResultsSubtitle}>Try selecting a different search</Text>
            </View>
          );
        }
        return (
          <View style={styles.resultsList}>
            {companyResults.map((item, index) => (
              <View key={`company-${item.id || item.company_id || index}-${index}`}>
                {renderCompanyCard(item)}
              </View>
            ))}
            {renderFooter()}
          </View>
        );
        
      case 'interest':
        if (interestResults.length === 0) {
          return (
            <View style={styles.emptyResults}>
              <Ionicons name="trending-up-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyResultsTitle}>No interest signals found</Text>
              <Text style={styles.emptyResultsSubtitle}>Try selecting a different search</Text>
            </View>
          );
        }
        return (
          <View style={styles.resultsList}>
            {interestResults.map((item, index) => (
              <View key={`interest-${item.signal_id || index}-${index}`}>
                {renderInterestCard(item)}
              </View>
            ))}
            {renderFooter()}
          </View>
        );
        
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
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header skeleton */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Ionicons name="prism" size={18} color="#1E3A5F" />
            </View>
            <Text style={styles.headerTitle}>Specter</Text>
          </View>
        </View>
        {/* Loading content */}
        <View style={styles.initialLoadingContainer}>
          <View style={styles.initialLoadingContent}>
            <View style={styles.loadingPulse}>
              <Ionicons name="search-outline" size={32} color="#3B82F6" />
            </View>
            <Text style={styles.initialLoadingTitle}>Loading your searches...</Text>
            <Text style={styles.initialLoadingSubtitle}>
              Fetching saved searches and preferences
            </Text>
          </View>
        </View>
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

      {/* Feed Tabs */}
      <View style={styles.feedTabsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.feedTabsContent}
        >
          {FEED_OPTIONS.map((option) => (
            <Pressable
              key={option.type}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setCurrentFeed(option.type);
              }}
              style={[
                styles.feedTab,
                currentFeed === option.type && styles.feedTabActive,
                currentFeed === option.type && { borderBottomColor: option.color },
              ]}
            >
              <Ionicons 
                name={option.icon} 
                size={16} 
                color={currentFeed === option.type ? option.color : "#64748B"} 
              />
              <Text style={[
                styles.feedTabText,
                currentFeed === option.type && styles.feedTabTextActive,
                currentFeed === option.type && { color: option.color },
              ]}>
                {option.label}
              </Text>
              {currentFeed === option.type && (
                <View style={[styles.feedTabCountBadge, { backgroundColor: option.color + '20' }]}>
                  <Text style={[styles.feedTabCount, { color: option.color }]}>
                    {globalSearches.length + personalSearches.length}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        onScroll={({ nativeEvent }) => {
          if (!selectedSearch || isLoadingMore || !hasMoreResults) return;
          
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const paddingToBottom = 600; // Trigger when 600px from bottom
          const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
          
          if (isCloseToBottom) {
            console.log('[HomeScreen] Scroll detected near bottom, loading more...', {
              offset: resultsOffset,
              hasMore: hasMoreResults,
              currentCount: getResultCount(),
              total: resultsTotal,
            });
            loadMoreResults();
          }
        }}
        scrollEventThrottle={200}
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
                {/* Active Search Header */}
                <View style={styles.activeSearchHeader}>
                  <View style={styles.activeSearchInfo}>
                    <View style={styles.activeSearchIcon}>
                      <Ionicons 
                        name={selectedSearch.is_global ? "globe-outline" : "bookmark"} 
                        size={16} 
                        color="#3B82F6" 
                      />
                    </View>
                    <View style={styles.activeSearchText}>
                      <Text style={styles.activeSearchName} numberOfLines={1}>
                        {selectedSearch.name}
                      </Text>
                      <Text style={styles.activeSearchMeta}>
                        {(() => {
                          const currentCount = getResultCount();
                          
                          // While loading, show "Loading..." instead of incorrect metadata
                          if (isLoadingResults && resultsTotal === null) {
                            return 'Loading...';
                          }
                          
                          // After API response, use corrected total
                          if (resultsTotal !== null) {
                            // API has returned - use corrected total
                            const displayTotal = (resultsTotal === 1 && currentCount > 1) ? currentCount : resultsTotal;
                            return `${currentCount} of ${displayTotal.toLocaleString()} results`;
                          }
                          
                          // Fallback: show current count if we have items but no total yet
                          if (currentCount > 0) {
                            return `${currentCount} results`;
                          }
                          
                          // No data yet
                          return 'No results';
                        })()}
                      </Text>
                    </View>
                  </View>
                  <Pressable 
                    onPress={() => {
                      setSelectedSearch(null);
                      setSearchResults([]);
                      setCompanyResults([]);
                      setInterestResults([]);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={styles.clearSearchButton}
                  >
                    <Ionicons name="close" size={18} color="#64748B" />
                  </Pressable>
                </View>
                {renderResults()}
              </View>
            )}
          </>
        )}

      </ScrollView>

      {/* Agent Actions Tab Button - Folder Tab Style at Bottom Right */}
      {!agentActionsVisible && (
        <View style={styles.agentTabWrapper}>
          <Animated.View
            style={[
              styles.agentTabContainer,
              {
                transform: [{ scale: masterButtonAnim }],
              },
            ]}
          >
            <Pressable onPress={toggleAgentActions} style={styles.agentTab}>
              <View style={styles.agentTabContent}>
                <View style={styles.agentTabIcon}>
                  <Ionicons name="flash" size={18} color="#FFF" />
                </View>
                <Text style={styles.agentTabText}>AI Agent</Text>
                <Ionicons name="chevron-up" size={16} color="#FFF" />
              </View>
            </Pressable>
          </Animated.View>
          {/* Safe area padding */}
          <View style={{ height: insets.bottom, backgroundColor: '#8B5CF6' }} />
        </View>
      )}

      {/* Agent Actions Bottom Sheet */}
      {agentActionsVisible && (
        <View style={styles.agentSheetOverlay}>
          <Pressable style={styles.agentSheetBackdrop} onPress={toggleAgentActions} />
          <Animated.View
            style={[
              styles.agentSheet,
              {
                paddingBottom: insets.bottom + 20,
                transform: [
                  {
                    translateY: agentActionsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [600, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Drag Handle */}
            <View style={styles.agentSheetHandle} />
            
            {/* Header */}
            <View style={styles.agentModalHeader}>
              <View style={styles.agentModalHeaderIcon}>
                <Ionicons name="flash" size={20} color="#FFF" />
              </View>
              <Text style={styles.agentModalTitle}>Agent Actions</Text>
              <Pressable onPress={toggleAgentActions} style={styles.agentModalClose}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>
            
            {/* Persona Selector - Sleek Pill Style */}
            {personas.length > 0 ? (
              <View style={styles.personaSelectorContainer}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.personaSelectorContent}
                >
                  {personas.map((persona, index) => {
                    const colors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899'];
                    const color = colors[index % colors.length];
                    const isActive = persona.id === activePersona?.id;
                    return (
                      <Pressable
                        key={persona.id}
                        onPress={() => handleSetActivePersona(persona.id)}
                        style={[
                          styles.personaPill,
                          isActive && { backgroundColor: color, borderColor: color },
                        ]}
                      >
                        {isActive && (
                          <View style={styles.personaPillCheck}>
                            <Ionicons name="checkmark" size={10} color={color} />
                          </View>
                        )}
                        <Text style={[
                          styles.personaPillText,
                          isActive && styles.personaPillTextActive,
                        ]} numberOfLines={1}>
                          {persona.name.length > 15 ? persona.name.slice(0, 15) + '...' : persona.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => {
                      toggleAgentActions();
                      navigation.navigate("Persona" as never);
                    }}
                    style={styles.personaPillAdd}
                  >
                    <Ionicons name="add" size={16} color="#3B82F6" />
                  </Pressable>
                </ScrollView>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  const memory = getAgentMemory();
                  memory.initializeDefaultPersonas();
                  loadPersonas();
                }}
                style={styles.initPersonasCard}
              >
                <View style={styles.initPersonasIcon}>
                  <Ionicons name="people" size={20} color="#8B5CF6" />
                </View>
                <View style={styles.initPersonasInfo}>
                  <Text style={styles.initPersonasTitle}>Create Personas</Text>
                  <Text style={styles.initPersonasDesc}>Set up investment theses</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
              </Pressable>
            )}

            {/* Active Persona Banner */}
            {activePersona && (
              <View style={styles.activePersonaBanner}>
                <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                <Text style={styles.activePersonaBannerText}>
                  Using <Text style={styles.activePersonaBannerName}>{activePersona.name}</Text> criteria
                </Text>
              </View>
            )}
            
            {/* Action Cards - Glass Morphism Style */}
            <View style={styles.actionCardsContainer}>
              {/* Auto-Like */}
              <Pressable
                onPress={() => handleAutoProcess('like')}
                disabled={isAutoProcessing || searchResults.length === 0}
                style={({ pressed }) => [
                  styles.actionCard,
                  styles.actionCardLike,
                  pressed && styles.actionCardPressed,
                  (isAutoProcessing || searchResults.length === 0) && styles.actionCardDisabled,
                ]}
              >
                <View style={styles.actionCardGlow} />
                <View style={styles.actionCardContent}>
                  <View style={[styles.actionCardIcon, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                    <Ionicons name="heart" size={24} color="#22C55E" />
                  </View>
                  <View style={styles.actionCardText}>
                    <Text style={styles.actionCardTitle}>Like Matches</Text>
                    <Text style={styles.actionCardSubtitle}>
                      {searchResults.length} signals ready
                    </Text>
                  </View>
                  <View style={styles.actionCardArrow}>
                    <Ionicons name="arrow-forward" size={18} color="#22C55E" />
                  </View>
                </View>
              </Pressable>

              {/* Auto-Pass */}
              <Pressable
                onPress={() => handleAutoProcess('dislike')}
                disabled={isAutoProcessing || searchResults.length === 0}
                style={({ pressed }) => [
                  styles.actionCard,
                  styles.actionCardPass,
                  pressed && styles.actionCardPressed,
                  (isAutoProcessing || searchResults.length === 0) && styles.actionCardDisabled,
                ]}
              >
                <View style={styles.actionCardContent}>
                  <View style={[styles.actionCardIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </View>
                  <View style={styles.actionCardText}>
                    <Text style={styles.actionCardTitle}>Pass Low</Text>
                    <Text style={styles.actionCardSubtitle}>
                      Skip non-matches
                    </Text>
                  </View>
                  <View style={styles.actionCardArrow}>
                    <Ionicons name="arrow-forward" size={18} color="#EF4444" />
                  </View>
                </View>
              </Pressable>
            </View>

            {/* Secondary Actions */}
            <View style={styles.secondaryActions}>
              <Pressable
                onPress={handleThesisRefinement}
                style={styles.secondaryAction}
              >
                <View style={[styles.secondaryActionIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="chatbubble-ellipses" size={18} color="#3B82F6" />
                </View>
                <Text style={styles.secondaryActionText}>Refine Thesis</Text>
              </Pressable>

              <View style={styles.secondaryActionDivider} />

              <Pressable
                onPress={handleViewAILearning}
                style={styles.secondaryAction}
              >
                <View style={[styles.secondaryActionIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="analytics" size={18} color="#F59E0B" />
                </View>
                <Text style={styles.secondaryActionText}>AI Memory</Text>
              </Pressable>
            </View>

            {/* Progress indicator during auto-processing */}
            {isAutoProcessing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.processingText}>Processing...</Text>
                <View style={styles.processingBar}>
                  <View style={[styles.processingFill, { width: `${autoProcessProgress}%` }]} />
                </View>
              </View>
            )}
          </Animated.View>
        </View>
      )}

      {/* Bulk Action Sheet */}
      <BulkActionSheet
        visible={bulkSheetVisible}
        onClose={() => {
          setBulkSheetVisible(false);
          setBulkEntities([]);
        }}
        onConfirm={handleBulkConfirm}
        entities={bulkEntities}
        actionType={bulkSheetAction}
        isProcessing={isBulkProcessing}
      />

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
  // Feed Tabs
  feedTabsContainer: {
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    height: 48,
  },
  feedTabsContent: {
    paddingHorizontal: 8,
    alignItems: "center",
    height: 48,
  },
  feedTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 48,
    gap: 6,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  feedTabActive: {
    borderBottomWidth: 3,
  },
  feedTabText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
  },
  feedTabTextActive: {
    fontWeight: "600",
  },
  feedTabCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  feedTabCount: {
    fontSize: 11,
    fontWeight: "600",
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
    padding: 16,
    paddingTop: 8,
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
  // Active Search Header
  activeSearchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EFF6FF",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  activeSearchInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  activeSearchIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  activeSearchText: {
    flex: 1,
  },
  activeSearchName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E40AF",
  },
  activeSearchMeta: {
    fontSize: 12,
    color: "#3B82F6",
    marginTop: 1,
  },
  clearSearchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
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
  // Skeleton loading styles
  skeletonContainer: {
    gap: 12,
  },
  skeletonCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  skeletonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F1F5F9",
  },
  skeletonHeaderText: {
    flex: 1,
    gap: 6,
  },
  skeletonName: {
    height: 14,
    width: "70%",
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
  },
  skeletonRole: {
    height: 10,
    width: "50%",
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
  },
  skeletonBody: {
    gap: 8,
    marginBottom: 12,
  },
  skeletonLine: {
    height: 10,
    width: "90%",
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
  },
  skeletonActions: {
    flexDirection: "row",
    gap: 8,
  },
  skeletonButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
  },
  // Empty results state
  emptyResults: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyResultsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 8,
  },
  emptyResultsSubtitle: {
    fontSize: 13,
    color: "#94A3B8",
  },
  loadMoreFooter: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    color: "#64748B",
  },
  // Initial loading screen
  initialLoadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 100,
  },
  initialLoadingContent: {
    alignItems: "center",
    gap: 12,
  },
  loadingPulse: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  initialLoadingTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
  },
  initialLoadingSubtitle: {
    fontSize: 14,
    color: "#64748B",
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
  personCardExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  expandIndicator: {
    marginLeft: 4,
  },
  expandableCardContainer: {
    marginBottom: 10,
  },
  // Expanded Profile - Clean Card Style
  expandedProfile: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#E2E8F0",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 16,
  },
  expSection: {
    marginBottom: 14,
  },
  expLabel: {
    fontSize: 11,
    color: "#94A3B8",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  expValue: {
    fontSize: 14,
    color: "#1E293B",
    lineHeight: 20,
  },
  // Company row with logo
  expCompanyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  expCompanyLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
  },
  expCompanyInfo: {
    flex: 1,
  },
  expCompanyName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  expCompanyTitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  // Previous experience logos
  expPrevLogos: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  expPrevLogo: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#F8FAFC",
  },
  expMoreBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  expMoreText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
  },
  expStatsRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  expStatCol: {
    flex: 1,
  },
  expStatValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
  },
  expSocials: {
    flexDirection: "row",
    gap: 10,
  },
  socialIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  expFullProfile: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  expFullProfileText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
  },
  // Swipeable card container
  swipeableCard: {
    position: 'relative',
    marginBottom: 8,
  },
  swipeIndicators: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  swipeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  swipeIndicatorLeft: {
    backgroundColor: '#EF4444',
  },
  swipeIndicatorRight: {
    backgroundColor: '#22C55E',
  },
  swipeIndicatorText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 12,
  },
  // Quick action buttons
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  quickActionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  quickActionLike: {
    backgroundColor: '#F0FDF4',
    borderColor: '#22C55E',
  },
  quickActionDislike: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  quickActionPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.95 }],
  },
  // Quick highlight badge
  quickHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  quickHighlightText: {
    fontSize: 10,
    color: '#B45309',
    fontWeight: '500',
    textTransform: 'capitalize',
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
  personNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  personName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    flex: 1,
  },
  matchScoreBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  matchScoreHigh: {
    backgroundColor: "#DCFCE7",
  },
  matchScoreMedium: {
    backgroundColor: "#FEF3C7",
  },
  matchScoreLow: {
    backgroundColor: "#E0F2FE",
  },
  matchScoreText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#065F46",
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
  // Agent Tab - Folder Tab Style
  agentTabWrapper: {
    position: "absolute",
    bottom: 0,
    right: 16,
    zIndex: 100,
  },
  agentTabContainer: {
  },
  agentTab: {
    backgroundColor: "#8B5CF6",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  agentTabContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  agentTabIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  agentTabText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },
  // Legacy styles
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
  // Legacy feed switcher styles (kept for reference)
  feedSwitcherOptions: {
    gap: 12,
  },
  // Agent Actions Bottom Sheet
  agentSheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
  },
  agentSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
  },
  agentSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 20,
    maxHeight: "80%",
  },
  agentSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  // Legacy modal styles (kept for reference)
  agentModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
    zIndex: 200,
  },
  agentModal: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 34,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  agentModalHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  agentModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  agentModalHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  agentModalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  agentModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  // Persona Selector - Pill Style
  personaSelectorContainer: {
    marginBottom: 16,
  },
  personaSelectorContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  personaPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  personaPillCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  personaPillText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
  },
  personaPillTextActive: {
    color: "#FFF",
    fontWeight: "600",
  },
  personaPillAdd: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    borderStyle: "dashed",
  },
  // Init Personas Card
  initPersonasCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    backgroundColor: "#FAF5FF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  initPersonasIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  initPersonasInfo: {
    flex: 1,
  },
  initPersonasTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#7C3AED",
  },
  initPersonasDesc: {
    fontSize: 12,
    color: "#A78BFA",
    marginTop: 2,
  },
  // Active Persona Banner
  activePersonaBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 8,
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  activePersonaBannerText: {
    fontSize: 12,
    color: "#166534",
  },
  activePersonaBannerName: {
    fontWeight: "700",
  },
  // Action Cards - Glass Morphism
  actionCardsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  actionCardLike: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  actionCardPass: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  actionCardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  actionCardDisabled: {
    opacity: 0.4,
  },
  actionCardGlow: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  actionCardContent: {
    padding: 16,
    alignItems: "center",
  },
  actionCardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  actionCardText: {
    alignItems: "center",
    marginBottom: 12,
  },
  actionCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  actionCardSubtitle: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
  },
  actionCardArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  // Secondary Actions
  secondaryActions: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 4,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  secondaryActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  secondaryActionDivider: {
    width: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 8,
  },
  // Processing Overlay
  processingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  processingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
  },
  processingBar: {
    width: 200,
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  processingFill: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 3,
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

