import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  TextInput,
  PanResponder,
  Animated,
  Dimensions,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useAuth } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import {
  fetchPersonDetail,
  likePerson,
  dislikePerson,
  Person,
  getCurrentJob,
  getFullName,
  getInitials,
  formatHighlight,
  TalentSignal,
} from "../api/specter";
import type { FounderAnalysisResult } from "../ai/founderAgent";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { inputManager, VoiceCommand } from "../ai/inputManager";
import { getAgentMemory, REWARD_SIGNALS, EntityNote } from "../ai/agentMemory";
import { useAgent, useModelStatus } from "../context/AgentContext";
import { logger } from "../utils/logger";
import { getFounderAgent } from "../ai/founderAgent";
import { VoiceInputButton } from "../components/VoiceInputButton";

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

type TabType = 'overview' | 'experience' | 'education' | 'skills' | 'signals' | 'investor';

// Highlight colors matching the Specter web design
const HIGHLIGHT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  prior_exit: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  serial_founder: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
  prior_vc_backed_founder: { bg: '#FCE7F3', text: '#9D174D', border: '#F9A8D4' },
  fortune_500_experience: { bg: '#F3E8FF', text: '#6B21A8', border: '#C4B5FD' },
  unicorn_experience: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  prior_vc_backed_experience: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  top_university: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
  influencer: { bg: '#FCE7F3', text: '#9D174D', border: '#F9A8D4' },
  hyper_connector: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
  repeat_founder: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
  default: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
};

const getHighlightColor = (highlight: string) => {
  const key = highlight.toLowerCase().replace(/\s+/g, '_');
  return HIGHLIGHT_COLORS[key] || HIGHLIGHT_COLORS.default;
};

// Default lists for saving
const DEFAULT_LISTS = [
  { id: 'shortlist', name: 'Shortlist', icon: 'star' },
  { id: 'reach_out', name: 'Reach Out', icon: 'mail' },
  { id: 'watching', name: 'Watching', icon: 'eye' },
  { id: 'passed', name: 'Passed', icon: 'close-circle' },
];

export default function PersonDetailScreen({
  navigation,
  route,
}: PersonDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { personId } = route.params;
  const { isReady: modelReady } = useModelStatus();

  const [person, setPerson] = useState<Person | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<"like" | "dislike" | "save" | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [canExit, setCanExit] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [profileType, setProfileType] = useState<'person' | 'investor'>('person');
  
  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  
  // Talent Signals state - from the person data
  const [talentSignals, setTalentSignals] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // Save to list modal
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [customListName, setCustomListName] = useState('');
  const [selectedList, setSelectedList] = useState<string | null>(null);
  
  // Voice/Text note input
  const [noteInputVisible, setNoteInputVisible] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [pendingAction, setPendingAction] = useState<'like' | 'dislike' | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [existingNotes, setExistingNotes] = useState<EntityNote[]>([]);
  
  // Annotation State
  const [annotatingItems, setAnnotatingItems] = useState<{ type: string, value: string, id?: string }[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleSelection = (item: { type: string, value: string, id?: string }) => {
    setAnnotatingItems(prev => {
      const exists = prev.find(i => i.value === item.value && i.type === item.type);
      if (exists) {
        // Deselect
        const next = prev.filter(i => i.value !== item.value || i.type !== item.type);
        if (next.length === 0) setIsSelectionMode(false); // Exit mode if empty
        return next;
      }
      Haptics.selectionAsync();
      return [...prev, item];
    });
  };

  const startAnnotation = (item: { type: string, value: string, id?: string }) => {
    setIsSelectionMode(true);
    setAnnotatingItems([item]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const isItemSelected = (type: string, value: string) => {
    return annotatingItems.some(i => i.type === type && i.value === value);
  };

  // Swipe gesture state
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const { getPreferenceSummary } = useAgent();
  
  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderGrant: () => {
        // Reset direction when starting
        setSwipeDirection(null);
      },
      onPanResponderMove: (_, gestureState) => {
        swipeAnim.setValue(gestureState.dx);
        // Show direction indicator
        if (gestureState.dx > 50) {
          setSwipeDirection('right');
        } else if (gestureState.dx < -50) {
          setSwipeDirection('left');
        } else {
          setSwipeDirection(null);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD && actionLoading === null) {
          // Swipe right = Like
          Animated.parallel([
            Animated.timing(swipeAnim, {
              toValue: SCREEN_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            handleLike();
          });
        } else if (gestureState.dx < -SWIPE_THRESHOLD && actionLoading === null) {
          // Swipe left = Pass
          Animated.parallel([
            Animated.timing(swipeAnim, {
              toValue: -SCREEN_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            handleDislike();
          });
        } else {
          // Reset position
          Animated.spring(swipeAnim, {
            toValue: 0,
            friction: 5,
            useNativeDriver: true,
          }).start();
          setSwipeDirection(null);
        }
      },
    })
  ).current;

  const getCacheKey = (id: string) => `ai_analysis_${id}`;

  useEffect(() => {
    loadPersonDetail();
    loadCachedAnalysis();
  }, [personId]);

  useEffect(() => {
    if (personId) {
      const memory = getAgentMemory();
      setExistingNotes(memory.getEntityNotes(personId));
    }
  }, [personId, noteInputVisible]);

  useEffect(() => {
    if (person) {
      inputManager.recordView(personId, 'person', getFullName(person));
      // Check if person is also an investor
      if (person.is_investor || person.investor_info) {
        setProfileType('investor');
      }
    }
    return () => {
      inputManager.recordViewEnd(personId);
    };
  }, [person, personId]);

  useEffect(() => {
    const timer = setTimeout(() => setCanExit(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (hasInteracted || canExit || isLoading || error) return;
      e.preventDefault();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        "Take Action",
        "Please Like, Pass, or Save this profile before leaving.",
        [{ text: "OK", style: "default" }]
      );
    });
    return unsubscribe;
  }, [navigation, hasInteracted, canExit, isLoading, error]);

  // Run AI analysis when person loads
  useEffect(() => {
    if (person && modelReady && !aiAnalysis && !isAnalyzing) {
      runAIAnalysis();
    }
  }, [person, modelReady]);

  const runAIAnalysis = async () => {
    if (!person || isAnalyzing) return;
    
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      const agent = getFounderAgent();
      const memory = getAgentMemory();
      const userContext = memory.buildFullContext();
      
      const result = await agent.analyzeFounder(person, {
        userContext,
        onStream: (text) => setAiAnalysis(text),
      });
      
      setAiAnalysis(result.summary || 'Analysis complete.');
      
      // Cache the result
      await AsyncStorage.setItem(getCacheKey(personId), JSON.stringify(result));
    } catch (err: any) {
      logger.error("PersonDetail", "AI analysis failed", err);
      setAnalysisError('AI analysis unavailable');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadPersonDetail = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!personId) throw new Error("No personId provided");
      const token = await getToken();
      if (!token) throw new Error("Authentication required");
      const data = await fetchPersonDetail(token, personId);
      setPerson(data);
    } catch (err: any) {
      setError(err.message || "Failed to load profile");
      logger.error("PersonDetail", "Load failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCachedAnalysis = async () => {
    try {
      const cached = await AsyncStorage.getItem(getCacheKey(personId));
      if (cached) {
        const parsed = JSON.parse(cached);
        setAiAnalysis(parsed.summary || '');
      }
    } catch (err) {
      logger.error("PersonDetail", "Cache load failed", err);
    }
  };

  // Handle voice command from VoiceInputButton
  const handleVoiceCommand = useCallback((command: VoiceCommand) => {
    setVoiceTranscript(command.transcript);
    // Record voice input reward
    const memory = getAgentMemory();
    if (person) {
      const experienceArray = Array.isArray(person.experience) ? person.experience : (person.experience ? [person.experience] : []);
      const eduArray = Array.isArray(person.education) ? person.education : (person.education ? [person.education] : []);
      const currentJob = getCurrentJob(experienceArray);
      
      const features = {
        industry: currentJob?.industry,
        seniority: person.seniority,
        region: person.region,
        highlights: person.people_highlights,
        companies: experienceArray.map(e => e.company_name).filter(Boolean) as string[],
        education: eduArray.map(e => e.name || e.school_name || e.school).filter(Boolean) as string[],
      };

      memory.recordInteraction({
        entityId: person.id,
        entityType: 'person',
        action: 'VOICE_INPUT',
        features,
        context: command.transcript,
      });
    }
  }, [person]);

  // Open note input before action
  const promptForNote = (action: 'like' | 'dislike') => {
    setPendingAction(action);
    setNoteInputVisible(true);
  };

  // Execute action with optional note
  const executeActionWithNote = async (note?: string) => {
    if (!person) return;

    const action = pendingAction;
    const currentNote = note || noteText || voiceTranscript || '';
    
    setNoteInputVisible(false);
    setPendingAction(null);
    
    // Handle specific annotations
    if (annotatingItems.length > 0 && currentNote) {
      const memory = getAgentMemory();
      // Default to positive if just annotating, otherwise follow action
      const sentiment = action === 'dislike' ? 'negative' : 'positive';
      
      await memory.recordEntityNote(
        person.id,
        getFullName(person),
        annotatingItems.map(i => ({ field: i.type as any, value: i.value, id: i.id })),
        currentNote,
        sentiment
      );
      
      // If we were just annotating (no pending action), we're done
      if (!action) {
        setAnnotatingItems([]);
        setIsSelectionMode(false);
        setNoteText('');
        setVoiceTranscript(null);
        Alert.alert("Note Added", "Your feedback has been recorded.");
        return;
      }
    }
    
    if (action === 'like') {
      await handleLike(currentNote);
    } else if (action === 'dislike') {
      await handleDislike(currentNote);
    }
    
    // Clear note state
    setNoteText('');
    setVoiceTranscript(null);
    setAnnotatingItems([]);
    setIsSelectionMode(false);
  };

  const handleLike = async (note?: string) => {
    if (!person) return;
    setActionLoading("like");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required");
      await likePerson(token, person.id);
      
      const memory = getAgentMemory();
      const experienceArray = Array.isArray(person.experience) ? person.experience : (person.experience ? [person.experience] : []);
      const eduArray = Array.isArray(person.education) ? person.education : (person.education ? [person.education] : []);
      const currentJob = getCurrentJob(experienceArray);
      
      const features = {
        industry: currentJob?.industry,
        seniority: person.seniority,
        region: person.region,
        highlights: person.people_highlights,
        companies: experienceArray.map(e => e.company_name).filter(Boolean) as string[],
        education: eduArray.map(e => e.name || e.school_name || e.school).filter(Boolean) as string[],
      };

      await memory.recordLike({
        id: person.id,
        name: getFullName(person),
        type: 'person',
        features,
        context: note || voiceTranscript || undefined,
      });
      
      // Record text input reward if note provided
      if (note) {
        await memory.recordInteraction({
          entityId: person.id,
          entityType: 'person',
          action: 'TEXT_INPUT',
          features,
          context: note,
        });
        }
      
      setHasInteracted(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => navigation.goBack(), 300);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDislike = async (note?: string) => {
    if (!person) return;
    setActionLoading("dislike");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required");
      await dislikePerson(token, person.id);
      
      const memory = getAgentMemory();
      const experienceArray = Array.isArray(person.experience) ? person.experience : (person.experience ? [person.experience] : []);
      const eduArray = Array.isArray(person.education) ? person.education : (person.education ? [person.education] : []);
      const currentJob = getCurrentJob(experienceArray);
      
      const features = {
        industry: currentJob?.industry,
        seniority: person.seniority,
        region: person.region,
        highlights: person.people_highlights,
        companies: experienceArray.map(e => e.company_name).filter(Boolean) as string[],
        education: eduArray.map(e => e.name || e.school_name || e.school).filter(Boolean) as string[],
      };

      await memory.recordDislike({
        id: person.id,
        name: getFullName(person),
        type: 'person',
        features,
        context: note || voiceTranscript || undefined,
      });

      // Record text input reward if note provided
      if (note) {
        await memory.recordInteraction({
          entityId: person.id,
          entityType: 'person',
          action: 'TEXT_INPUT',
          features,
          context: note,
      });
      }

      setHasInteracted(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => navigation.goBack(), 300);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setActionLoading(null);
    }
  };
  
  // Skip action (explicit pass without viewing fully)
  const handleSkip = async () => {
    if (!person) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const memory = getAgentMemory();
    const experienceArray = Array.isArray(person.experience) ? person.experience : (person.experience ? [person.experience] : []);
    const eduArray = Array.isArray(person.education) ? person.education : (person.education ? [person.education] : []);
    const currentJob = getCurrentJob(experienceArray);
    
    const features = {
      industry: currentJob?.industry,
      seniority: person.seniority,
      region: person.region,
      highlights: person.people_highlights,
      companies: experienceArray.map(e => e.company_name).filter(Boolean) as string[],
      education: eduArray.map(e => e.name || e.school_name || e.school).filter(Boolean) as string[],
    };

    await memory.recordInteraction({
      entityId: person.id,
      entityType: 'person',
      action: 'SKIP',
      features,
    });
    
    setHasInteracted(true);
        navigation.goBack();
  };

  const handleSaveToList = async (listId: string, listName: string) => {
    if (!person) return;
    
    setActionLoading("save");
    setSaveModalVisible(false);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    try {
      const memory = getAgentMemory();
      const experienceArray = Array.isArray(person.experience) ? person.experience : (person.experience ? [person.experience] : []);
      const eduArray = Array.isArray(person.education) ? person.education : (person.education ? [person.education] : []);
      const currentJob = getCurrentJob(experienceArray);
      
      const features = {
        industry: currentJob?.industry,
        seniority: person.seniority,
        region: person.region,
        highlights: person.people_highlights,
        companies: experienceArray.map(e => e.company_name).filter(Boolean) as string[],
        education: eduArray.map(e => e.name || e.school_name || e.school).filter(Boolean) as string[],
      };

      await memory.recordSave({
        id: person.id,
        name: getFullName(person),
        type: 'person',
        features,
      }, listName);
      
      setHasInteracted(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", `${getFullName(person)} added to "${listName}"`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setActionLoading(null);
      setSelectedList(null);
      setCustomListName('');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (error || !person) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={styles.errorText}>{error || "Profile not found"}</Text>
        <Pressable onPress={loadPersonDetail} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const currentJob = getCurrentJob(person.experience || []);
  const fullName = getFullName(person);
  const initials = getInitials(person);
  const isInvestor = person.is_investor || person.investor_info;

  const TABS: { key: TabType; label: string; count?: number; show: boolean }[] = [
    { key: 'overview', label: 'Overview', show: true },
    { key: 'experience', label: 'Experience', show: true },
    { key: 'education', label: 'Education', show: true },
    { key: 'skills', label: 'Skills', show: true },
    { key: 'signals', label: 'Talent Signals', count: person.talent_signals?.length || 0, show: true },
    { key: 'investor', label: 'Investor', show: !!isInvestor },
  ];

  // Get active persona for display
  const agentMemory = getAgentMemory();
  const activePersona = agentMemory.getActivePersona();
  
  // Extract features for scoring
  const experienceArray = Array.isArray(person?.experience) ? person.experience : (person?.experience ? [person.experience] : []);
  const eduArray = Array.isArray(person?.education) ? person.education : (person?.education ? [person.education] : []);
  const features: EntityFeatures = {
    industry: currentJob?.industry,
    seniority: person?.seniority,
    region: person?.region,
    highlights: person?.people_highlights,
    companies: experienceArray.map(e => e.company_name).filter(Boolean) as string[],
    education: eduArray.map(e => e.name || e.school_name || e.school).filter(Boolean) as string[],
  };

  const matchScore = person ? agentMemory.calculateMatchScore(features) : { score: 50, reasons: [] };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </Pressable>

        {/* Mini Profile in Header */}
        <View style={styles.headerProfile}>
          {person.profile_image_url ? (
            <Image source={{ uri: person.profile_image_url }} style={styles.headerAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
              <Text style={styles.headerAvatarText}>{initials}</Text>
            </View>
          )}
          <Text style={styles.headerName} numberOfLines={1}>{fullName}</Text>
        </View>

        {/* Person/Investor Toggle - only show if they are an investor */}
        {isInvestor && (
          <View style={styles.typeToggle}>
            <Pressable 
              style={[styles.typeToggleBtn, profileType === 'person' && styles.typeToggleBtnActive]}
              onPress={() => setProfileType('person')}
            >
              <Text style={profileType === 'person' ? styles.typeToggleTextActive : styles.typeToggleText}>Person</Text>
            </Pressable>
            <Pressable 
              style={[styles.typeToggleBtn, profileType === 'investor' && styles.typeToggleBtnActive]}
              onPress={() => { setProfileType('investor'); setActiveTab('investor'); }}
            >
              <Text style={profileType === 'investor' ? styles.typeToggleTextActive : styles.typeToggleText}>Investor</Text>
            </Pressable>
          </View>
        )}
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
          {person && (
            <View style={[
              styles.matchScoreBadge,
              { backgroundColor: matchScore.score >= 70 ? '#22C55E' : matchScore.score >= 40 ? '#F59E0B' : '#EF4444' }
            ]}>
              <Text style={styles.matchScoreText}>{matchScore.score}% Match</Text>
            </View>
          )}
        </View>
        <Pressable 
          style={styles.aiQuickBtn}
          onPress={() => navigation.navigate('Diagnostics' as any)}
        >
          <Ionicons name="sparkles" size={16} color="#8B5CF6" />
          <Text style={styles.aiQuickBtnText}>AI</Text>
        </Pressable>
      </View>

      {/* Swipe Direction Indicators */}
      {swipeDirection === 'left' && (
        <View style={styles.swipeIndicatorLeft}>
          <Ionicons name="close" size={32} color="#FFF" />
          <Text style={styles.swipeIndicatorText}>Pass</Text>
        </View>
      )}
      {swipeDirection === 'right' && (
        <View style={styles.swipeIndicatorRight}>
          <Ionicons name="heart" size={32} color="#FFF" />
          <Text style={styles.swipeIndicatorText}>Like</Text>
        </View>
      )}

      <Animated.View 
        style={[
          styles.swipeContainer,
          {
            transform: [{ translateX: swipeAnim }],
            opacity: opacityAnim,
          }
        ]}
        {...panResponder.panHandlers}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Text style={styles.tagline}>{person.tagline || currentJob?.title || 'No tagline'}</Text>
          
          {/* Location & Seniority Row */}
          <View style={styles.metaRow}>
            {person.region && (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{person.region}</Text>
              </View>
            )}
            {person.seniority && (
              <View style={[styles.metaChip, styles.metaChipBlue]}>
                <Text style={styles.metaChipTextBlue}>{person.seniority}</Text>
              </View>
            )}
            {person.years_of_experience && (
              <View style={styles.metaChip}>
                <Ionicons name="briefcase-outline" size={12} color="#64748B" />
                <Text style={styles.metaChipText}>{person.years_of_experience} years</Text>
              </View>
            )}
          </View>

          {/* Social Links & Stats - Simplified */}
          <View style={styles.socialRow}>
            <Pressable 
              style={styles.socialBtn}
              onPress={() => {
                const url = person.linkedin_url || `https://linkedin.com/in/${fullName.toLowerCase().replace(/\s+/g, '-')}`;
                Linking.openURL(url);
              }}
            >
              <Ionicons name="logo-linkedin" size={18} color="#0A66C2" />
            </Pressable>
            
            <View style={styles.statDivider} />
            
            <Text style={styles.statText}>
              {person.followers_count ? `${(person.followers_count / 1000).toFixed(1)}k followers` : '—'}
            </Text>
            <Text style={styles.statDot}>·</Text>
            <Text style={styles.statText}>
              {person.connections_count ? `${(person.connections_count / 1000).toFixed(1)}k connections` : '—'}
            </Text>
          </View>
        </View>

        {/* Tab Navigation */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.tabNav}
          contentContainerStyle={styles.tabNavContent}
        >
          {TABS.filter(t => t.show).map(tab => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            >
              <Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextActive]}>
                {tab.label}
              </Text>
              {tab.count !== undefined && tab.count > 0 && (
                <View style={styles.tabCount}>
                  <Text style={styles.tabCountText}>({tab.count})</Text>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <View style={styles.tabContent}>
            {/* About Section */}
        {person.tagline && (
          <View style={styles.section}>
                <Text style={styles.sectionTitle}>About {person.first_name}</Text>
                <Text style={styles.aboutText}>{person.tagline}</Text>
          </View>
        )}

            {/* AI Analysis Card - Clean Design */}
            <View style={styles.aiCard}>
              <View style={styles.aiCardHeader}>
                <View style={styles.aiCardTitleRow}>
                  <Ionicons name="sparkles" size={16} color="#3B82F6" />
                  <Text style={styles.aiCardTitle}>AI Analysis</Text>
                </View>
                <View style={styles.aiCardBadge}>
                  <View style={styles.aiCardBadgeDot} />
                  <Text style={styles.aiCardBadgeText}>On-Device</Text>
                </View>
              </View>
              
              {isAnalyzing ? (
                <View style={styles.aiCardLoading}>
                  <ActivityIndicator size="small" color="#3B82F6" />
                  <Text style={styles.aiCardLoadingText}>Analyzing profile...</Text>
                </View>
              ) : analysisError ? (
                <View style={styles.aiCardError}>
                  <Ionicons name="alert-circle-outline" size={16} color="#94A3B8" />
                  <Text style={styles.aiCardErrorText}>{analysisError}</Text>
                  <Pressable onPress={runAIAnalysis} style={styles.aiRetryBtn}>
                    <Text style={styles.aiRetryText}>Retry</Text>
                  </Pressable>
                </View>
              ) : aiAnalysis ? (
                <Text style={styles.aiCardText}>{aiAnalysis}</Text>
              ) : (
                <View style={styles.aiCardLoading}>
                  <Text style={styles.aiCardLoadingText}>Waiting for AI model...</Text>
                </View>
              )}
            </View>

        {/* Highlights Section */}
        {person.people_highlights && person.people_highlights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Highlights</Text>
                <View style={styles.highlightsGrid}>
                  {person.people_highlights.map((highlight, idx) => {
                    const colors = getHighlightColor(highlight);
                    return (
                      <View 
                        key={idx} 
                        style={[styles.highlightCard, { backgroundColor: colors.bg, borderColor: colors.border }]}
                      >
                        <Ionicons name="star" size={14} color={colors.text} />
                        <Text style={[styles.highlightTitle, { color: colors.text }]}>
                          {formatHighlight(highlight)}
                        </Text>
                </View>
                    );
                  })}
            </View>
              </View>
            )}
          </View>
        )}

        {activeTab === 'experience' && (
          <View style={styles.tabContent}>
            {person.experience && person.experience.length > 0 ? (
              person.experience.map((exp, idx) => {
                const itemValue = exp.company_name || 'Unknown';
                const itemNote = existingNotes.find(n => n.targets.some(t => t.value === itemValue && t.field === 'experience'));
                
                return (
                <Pressable
                  key={idx}
                  onLongPress={() => startAnnotation({ type: 'experience', value: itemValue })}
                  onPress={() => {
                    if (isSelectionMode) {
                      toggleSelection({ type: 'experience', value: itemValue });
                    } else if (itemNote) {
                      Alert.alert("Note", itemNote.note);
                    }
                  }}
                  style={[
                    styles.expCard,
                    isItemSelected('experience', itemValue) && styles.selectedCard,
                    itemNote && styles.cardWithNote
                  ]}
                >
                  {itemNote && (
                    <View style={styles.noteIndicatorOverlay}>
                      <Ionicons name="chatbubble-ellipses" size={14} color="#8B5CF6" />
                    </View>
                  )}
                  <View style={styles.expHeader}>
                    <Image
                      source={{ uri: `https://app.tryspecter.com/logo?domain=${exp.company_name?.toLowerCase().replace(/\s+/g, '')}.com` }}
                      style={styles.expLogo}
                      contentFit="contain"
                    />
                    <View style={styles.expInfo}>
                      <Text style={styles.expTitle}>{exp.title}</Text>
                      <Text style={styles.expCompany}>{exp.company_name}</Text>
                      <Text style={styles.expDate}>
                        {exp.start_date || 'Unknown'} - {exp.is_current ? 'Present' : (exp.end_date || 'Unknown')}
                      </Text>
                    </View>
                  {exp.is_current && (
                    <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Current</Text>
                    </View>
                  )}
                </View>
                  {(exp.company_size || exp.total_funding_amount) && (
                    <View style={styles.expMetaRow}>
                {exp.company_size && (
                        <View style={styles.expMetaChip}>
                          <Ionicons name="people-outline" size={12} color="#64748B" />
                          <Text style={styles.expMetaText}>{exp.company_size}</Text>
                        </View>
                )}
                {exp.total_funding_amount !== undefined && exp.total_funding_amount > 0 && (
                        <View style={styles.expMetaChip}>
                          <Ionicons name="cash-outline" size={12} color="#64748B" />
                          <Text style={styles.expMetaText}>${(exp.total_funding_amount / 1000000).toFixed(1)}M</Text>
                        </View>
                      )}
                    </View>
                  )}
                </Pressable>
              )})
            ) : (
              <Text style={styles.emptyText}>No experience data available</Text>
            )}
          </View>
        )}

        {activeTab === 'education' && (
          <View style={styles.tabContent}>
            {(() => {
              // Handle education as array or single object
              const eduArray = Array.isArray(person.education) 
                ? person.education 
                : (person.education ? [person.education] : []);
              
              if (eduArray.length > 0) {
                return eduArray.map((edu: any, idx: number) => {
                  // Handle different field names from API
                  const schoolName = edu.name || edu.school_name || edu.school || 'Unknown School';
                  const degree = edu.degree_title || edu.degree || null;
                  const fieldOfStudy = edu.field_of_study || null;
                  const description = edu.description || null;
                  const itemValue = schoolName;
                  const itemNote = existingNotes.find(n => n.targets.some(t => t.value === itemValue && t.field === 'education'));
                  
                  return (
                    <Pressable
                      key={idx}
                      onLongPress={() => startAnnotation({ type: 'education', value: itemValue })}
                      onPress={() => {
                        if (isSelectionMode) {
                          toggleSelection({ type: 'education', value: itemValue });
                        } else if (itemNote) {
                          Alert.alert("Note", itemNote.note);
                        }
                      }}
                      style={[
                        styles.eduCard,
                        isItemSelected('education', itemValue) && styles.selectedCard,
                        itemNote && styles.cardWithNote
                      ]}
                    >
                      {itemNote && (
                        <View style={styles.noteIndicatorOverlay}>
                          <Ionicons name="chatbubble-ellipses" size={14} color="#8B5CF6" />
                        </View>
                      )}
                      <View style={styles.eduIconContainer}>
                        <Ionicons name="school" size={24} color="#3B82F6" />
                      </View>
                      <View style={styles.eduInfo}>
                        <Text style={styles.eduSchool}>{schoolName}</Text>
                        {degree && (
                          <Text style={styles.eduDegree}>{degree}</Text>
                        )}
                        {fieldOfStudy && (
                          <View style={styles.eduFieldChip}>
                            <Text style={styles.eduFieldText}>{fieldOfStudy}</Text>
                          </View>
                        )}
                        {description && !degree && !fieldOfStudy && (
                          <View style={styles.eduFieldChip}>
                            <Text style={styles.eduFieldText}>{description}</Text>
                          </View>
                        )}
                        {(edu.start_date || edu.end_date) && (
                          <Text style={styles.eduDates}>
                            {edu.start_date || '?'} - {edu.end_date || 'Present'}
                  </Text>
                )}
                      </View>
                    </Pressable>
                  );
                });
              }
              
              // Fallback: show education_level and field_of_study from Person if no education array
              if (person.education_level || person.field_of_study) {
                const itemValue = person.education_level || 'Education';
                return (
                  <Pressable
                    onLongPress={() => startAnnotation({ type: 'education', value: itemValue })}
                    onPress={() => isSelectionMode ? toggleSelection({ type: 'education', value: itemValue }) : null}
                    style={[
                      styles.eduCard,
                      isItemSelected('education', itemValue) && styles.selectedCard
                    ]}
                  >
                    <View style={styles.eduIconContainer}>
                      <Ionicons name="school" size={24} color="#3B82F6" />
                    </View>
                    <View style={styles.eduInfo}>
                      {person.education_level && (
                        <Text style={styles.eduSchool}>{person.education_level}</Text>
                      )}
                      {person.field_of_study && (
                        <View style={styles.eduFieldChip}>
                          <Text style={styles.eduFieldText}>{person.field_of_study}</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              }
              
              return (
                <View style={styles.emptyState}>
                  <Ionicons name="school-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No education data available</Text>
                </View>
              );
            })()}
          </View>
        )}

        {activeTab === 'skills' && (
          <View style={styles.tabContent}>
            {person.skills && person.skills.length > 0 ? (
              <View style={styles.skillsGrid}>
                {person.skills.map((skill, idx) => {
                  const itemNote = existingNotes.find(n => n.targets.some(t => t.value === skill && t.field === 'skill'));
                  return (
                  <Pressable
                    key={idx}
                    onLongPress={() => startAnnotation({ type: 'skill', value: skill })}
                    onPress={() => {
                      if (isSelectionMode) {
                        toggleSelection({ type: 'skill', value: skill });
                      } else if (itemNote) {
                        Alert.alert("Note", itemNote.note);
                      }
                    }}
                    style={[
                      styles.skillChip,
                      isItemSelected('skill', skill) && styles.selectedCard,
                      itemNote && styles.cardWithNote
                    ]}
                  >
                    {itemNote && (
                      <View style={styles.skillNoteIndicator}>
                        <Ionicons name="chatbubble-ellipses" size={10} color="#8B5CF6" />
                      </View>
                    )}
                    <Text style={styles.skillChipText}>{skill}</Text>
                  </Pressable>
            )})}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="construct-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyText}>No skills data available</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'signals' && (
          <View style={styles.tabContent}>
            {(() => {
              // Check for talent signals in the person object
              // These come from the API when person is loaded from a talent signal search
              const signals = (person as any).talent_signals || 
                              (person as any).signals || 
                              [];
              
              // Also check for signal_type which indicates this person came from a talent signal
              const hasSignalInfo = (person as any).signal_type || 
                                    (person as any).signal_score !== undefined ||
                                    (person as any).signal_date;
              
              if (hasSignalInfo) {
                // Person has signal metadata - display it
                const signalType = (person as any).signal_type || 'Career Move';
                const signalScore = (person as any).signal_score;
                const signalDate = (person as any).signal_date;
                const signalStatus = (person as any).signal_status;
                const newCompany = (person as any).new_company_name;
                const newTitle = (person as any).new_title;
                const previousCompany = (person as any).previous_company_name;
                const previousTitle = (person as any).previous_title;
                
                return (
                  <View style={styles.signalCard}>
                    <View style={styles.signalHeader}>
                      <View style={styles.signalTypeBadge}>
                        <Ionicons 
                          name={
                            signalType.toLowerCase().includes('founder') ? 'rocket' :
                            signalType.toLowerCase().includes('depart') ? 'exit' :
                            signalType.toLowerCase().includes('hire') ? 'person-add' :
                            'trending-up'
                          } 
                          size={16} 
                          color="#3B82F6" 
                        />
                        <Text style={styles.signalTypeText}>{signalType}</Text>
                      </View>
                      {signalScore !== undefined && (
                        <View style={styles.signalScoreBadge}>
                          <Text style={styles.signalScoreText}>{signalScore}</Text>
                        </View>
                      )}
                    </View>
                    
                    {signalDate && (
                      <Text style={styles.signalDate}>
                        Detected: {new Date(signalDate).toLocaleDateString()}
                      </Text>
                    )}
                    
                    {signalStatus && (
                      <View style={styles.signalStatusRow}>
                        <Ionicons name="shield-checkmark" size={14} color="#8B5CF6" />
                        <Text style={styles.signalStatusText}>{signalStatus}</Text>
                      </View>
                    )}
                    
                    {(newCompany || newTitle) && (
                      <View style={styles.signalMoveCard}>
                        <Text style={styles.signalMoveLabel}>New Position</Text>
                        {newTitle && <Text style={styles.signalMoveTitle}>{newTitle}</Text>}
                        {newCompany && (
                          <View style={styles.signalCompanyRow}>
                            <Image 
                              source={{ uri: `https://app.tryspecter.com/logo?domain=${(person as any).new_company_domain || ''}` }}
                              style={styles.signalCompanyLogo}
                              contentFit="contain"
                            />
                            <Text style={styles.signalCompanyName}>{newCompany}</Text>
                          </View>
                        )}
                      </View>
                    )}
                    
                    {(previousCompany || previousTitle) && (
                      <View style={[styles.signalMoveCard, styles.signalMoveCardPrevious]}>
                        <Text style={styles.signalMoveLabel}>Previous Position</Text>
                        {previousTitle && <Text style={styles.signalMoveTitle}>{previousTitle}</Text>}
                        {previousCompany && (
                          <View style={styles.signalCompanyRow}>
                            <Image 
                              source={{ uri: `https://app.tryspecter.com/logo?domain=${(person as any).previous_company_domain || ''}` }}
                              style={styles.signalCompanyLogo}
                              contentFit="contain"
                            />
                            <Text style={styles.signalCompanyName}>{previousCompany}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              }
              
              if (signals.length > 0) {
                // Has array of signals
                return signals.map((signal: any, idx: number) => (
                  <View key={idx} style={styles.signalCard}>
                    <View style={styles.signalHeader}>
                      <View style={styles.signalTypeBadge}>
                        <Ionicons name="trending-up" size={16} color="#3B82F6" />
                        <Text style={styles.signalTypeText}>{signal.signal_type || 'Signal'}</Text>
                      </View>
                      {signal.signal_score !== undefined && (
                        <View style={styles.signalScoreBadge}>
                          <Text style={styles.signalScoreText}>{signal.signal_score}</Text>
                        </View>
                      )}
                    </View>
                    {signal.signal_date && (
                      <Text style={styles.signalDate}>
                        {new Date(signal.signal_date).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                ));
              }
              
              // No signals available
              return (
                <View style={styles.emptyState}>
                  <Ionicons name="trending-up-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No talent signals detected</Text>
                  <Text style={styles.emptySubtext}>
                    Talent signals appear when career moves are detected
                  </Text>
                </View>
              );
            })()}
          </View>
        )}

        {activeTab === 'investor' && isInvestor && (
          <View style={styles.tabContent}>
            <View style={styles.investorCard}>
              <View style={styles.investorHeader}>
                <Ionicons name="cash" size={24} color="#22C55E" />
                <Text style={styles.investorTitle}>Investor Profile</Text>
              </View>
              
              {person.investor_info ? (
                <>
                  {person.investor_info.fund_name && (
                    <View style={styles.investorRow}>
                      <Text style={styles.investorLabel}>Fund</Text>
                      <Text style={styles.investorValue}>{person.investor_info.fund_name}</Text>
                    </View>
                  )}
                  {person.investor_info.investment_stages && (
                    <View style={styles.investorRow}>
                      <Text style={styles.investorLabel}>Stages</Text>
                      <View style={styles.investorChips}>
                        {person.investor_info.investment_stages.map((stage, idx) => (
                          <View key={idx} style={styles.investorChip}>
                            <Text style={styles.investorChipText}>{stage}</Text>
              </View>
            ))}
                      </View>
                    </View>
                  )}
                  {person.investor_info.sectors && (
                    <View style={styles.investorRow}>
                      <Text style={styles.investorLabel}>Sectors</Text>
                      <View style={styles.investorChips}>
                        {person.investor_info.sectors.map((sector, idx) => (
                          <View key={idx} style={styles.investorChip}>
                            <Text style={styles.investorChipText}>{sector}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.investorNote}>This person is marked as an investor. Detailed investor data coming soon.</Text>
              )}
            </View>
          </View>
        )}

        <View style={{ height: 120 + insets.bottom }} />
      </ScrollView>
      </Animated.View>

      {/* Fixed Action Bar with Voice Input */}
      <View style={[styles.actionBarContainer, { paddingBottom: insets.bottom + 12 }]}>
        {/* Voice Input Row */}
        <View style={styles.voiceInputRow}>
          <VoiceInputButton 
            size="small" 
            onTranscript={(text) => {
              setVoiceTranscript(text);
              // Record voice input to memory
              const memory = getAgentMemory();
              if (person) {
                memory.recordInteraction('voice', `Voice note on ${person.full_name}: ${text}`, {
                  entityId: person.id,
                  entityType: 'person',
                  action: 'voice_note',
                  reward: 0.3,
                });
              }
            }}
            showTranscript={false}
            style={styles.voiceBtn}
          />
          {voiceTranscript ? (
            <View style={styles.voiceTranscriptBubble}>
              <Ionicons name="chatbubble" size={12} color="#3B82F6" />
              <Text style={styles.voiceTranscriptText} numberOfLines={1}>
                {voiceTranscript}
              </Text>
            </View>
          ) : (
            <Text style={styles.voiceHint}>Hold to add voice note</Text>
          )}
        </View>
        
        {/* Action Buttons Row */}
        <View style={styles.actionBar}>
          {/* Skip Button - explicit pass */}
        <Pressable
            onPress={handleSkip}
          disabled={actionLoading !== null}
            style={[styles.actionBtnSmall, styles.actionBtnSkip]}
          >
            <Ionicons name="play-skip-forward" size={18} color="#64748B" />
          </Pressable>
          
          <Pressable
            onPress={() => handleDislike()}
            onLongPress={() => promptForNote('dislike')}
            disabled={actionLoading !== null}
            style={[styles.actionBtn, styles.actionBtnPass]}
        >
          {actionLoading === "dislike" ? (
              <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
                <Ionicons name="close" size={22} color="#FFF" />
                <Text style={styles.actionBtnText}>Pass</Text>
            </>
          )}
        </Pressable>

        <Pressable
            onPress={() => setSaveModalVisible(true)}
          disabled={actionLoading !== null}
            style={[styles.actionBtn, styles.actionBtnSave]}
          >
            {actionLoading === "save" ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="bookmark" size={20} color="#FFF" />
                <Text style={styles.actionBtnText}>Save</Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={() => handleLike()}
            onLongPress={() => promptForNote('like')}
            disabled={actionLoading !== null}
            style={[styles.actionBtn, styles.actionBtnLike]}
        >
          {actionLoading === "like" ? (
              <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
                <Ionicons name="heart" size={22} color="#FFF" />
                <Text style={styles.actionBtnText}>Like</Text>
            </>
          )}
        </Pressable>
      </View>
        
        <Text style={styles.actionHint}>Long press to add note</Text>
      </View>

      {/* Selection Mode FAB */}
      {isSelectionMode && annotatingItems.length > 0 && (
        <View style={styles.selectionFabContainer}>
          <View style={styles.selectionFab}>
            <View style={styles.selectionCount}>
              <Text style={styles.selectionCountText}>{annotatingItems.length}</Text>
            </View>
            <Text style={styles.selectionText}>Selected</Text>
            
            <View style={styles.selectionActions}>
              <Pressable 
                onPress={() => {
                  setAnnotatingItems([]);
                  setIsSelectionMode(false);
                }}
                style={styles.selectionCancelBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
              <Pressable 
                onPress={() => {
                  // Open note modal without pending action (just annotation)
                  setPendingAction(null); 
                  setNoteInputVisible(true);
                }}
                style={styles.selectionNoteBtn}
              >
                <Ionicons name="create" size={20} color="#FFF" />
                <Text style={styles.selectionNoteBtnText}>Add Note</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Save to List Modal */}
      <Modal
        visible={saveModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSaveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Save to List</Text>
              <Pressable onPress={() => setSaveModalVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>
            
            <Text style={styles.modalSubtitle}>Choose a list for {person?.first_name}</Text>
            
            <View style={styles.listOptions}>
              {DEFAULT_LISTS.map(list => (
                <Pressable
                  key={list.id}
                  onPress={() => handleSaveToList(list.id, list.name)}
                  style={[styles.listOption, selectedList === list.id && styles.listOptionSelected]}
                >
                  <View style={styles.listOptionIcon}>
                    <Ionicons name={list.icon as any} size={20} color="#3B82F6" />
                  </View>
                  <Text style={styles.listOptionText}>{list.name}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </Pressable>
              ))}
            </View>
            
            <View style={styles.customListSection}>
              <Text style={styles.customListLabel}>Or create a new list</Text>
              <View style={styles.customListRow}>
                <TextInput
                  style={styles.customListInput}
                  placeholder="New list name..."
                  placeholderTextColor="#94A3B8"
                  value={customListName}
                  onChangeText={setCustomListName}
                />
                <Pressable
                  onPress={() => {
                    if (customListName.trim()) {
                      handleSaveToList(customListName.toLowerCase().replace(/\s+/g, '_'), customListName);
                    }
                  }}
                  disabled={!customListName.trim()}
                  style={[styles.customListBtn, !customListName.trim() && styles.customListBtnDisabled]}
                >
                  <Text style={styles.customListBtnText}>Create</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Note Input Modal */}
      <Modal
        visible={noteInputVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNoteInputVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.noteModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pendingAction === 'like' ? '❤️ Why do you like this?' : '👎 Why are you passing?'}
              </Text>
              <Pressable onPress={() => setNoteInputVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>
            
            <Text style={styles.noteModalSubtitle}>
              Your feedback helps train your deal agent to find better matches.
            </Text>
            
            {/* Selected Items for Annotation */}
            {annotatingItems.length > 0 && (
              <View style={styles.selectedChipsContainer}>
                {annotatingItems.map((item, idx) => (
                  <View key={idx} style={styles.selectedChip}>
                    <Ionicons 
                      name={item.type === 'experience' ? 'briefcase' : item.type === 'education' ? 'school' : 'construct'} 
                      size={12} 
                      color="#7C3AED" 
                    />
                    <Text style={styles.selectedChipText}>{item.value}</Text>
                  </View>
                ))}
              </View>
            )}
            
            {/* Voice Transcript Display */}
            {voiceTranscript && (
              <View style={styles.voiceTranscriptBox}>
                <Ionicons name="mic" size={16} color="#3B82F6" />
                <Text style={styles.voiceTranscriptText}>"{voiceTranscript}"</Text>
              </View>
            )}
            
            {/* Text Input */}
            <TextInput
              style={styles.noteInput}
              placeholder={pendingAction === 'like' 
                ? "e.g., Strong technical background, relevant domain expertise..." 
                : "e.g., Not the right stage, different industry focus..."}
              placeholderTextColor="#94A3B8"
              value={noteText}
              onChangeText={setNoteText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            
            {/* Voice Input in Modal */}
            <View style={styles.noteVoiceRow}>
              <VoiceInputButton 
                size="small" 
                onTranscript={(text) => {
                  setVoiceTranscript(text);
                  setNoteText(prev => prev ? `${prev} ${text}` : text);
                }}
                showTranscript={false}
              />
              <Text style={styles.noteVoiceHint}>Or hold to speak</Text>
            </View>
            
            {/* Action Buttons */}
            <View style={styles.noteActionRow}>
              <Pressable
                onPress={() => executeActionWithNote()}
                style={[styles.noteActionBtn, styles.noteActionBtnSkip]}
              >
                <Text style={styles.noteActionBtnSkipText}>Skip Note</Text>
              </Pressable>
              <Pressable
                onPress={() => executeActionWithNote(noteText || voiceTranscript || undefined)}
                style={[styles.noteActionBtn, styles.noteActionBtnSubmit]}
              >
                <Text style={styles.noteActionBtnSubmitText}>
                  {pendingAction === 'like' ? 'Like' : 'Pass'} with Note
                </Text>
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
    backgroundColor: "#FFF",
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748B",
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#3B82F6",
    borderRadius: 10,
  },
  retryButtonText: {
    color: "#FFF",
    fontWeight: "600",
  },
  // Header Bar
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerProfile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerAvatarPlaceholder: {
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  headerName: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
  },
  typeToggle: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 2,
  },
  typeToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  typeToggleBtnActive: {
    backgroundColor: "#3B82F6",
  },
  typeToggleText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  typeToggleTextActive: {
    fontSize: 13,
    color: "#FFF",
    fontWeight: "600",
  },
  // Swipe Gesture
  swipeContainer: {
    flex: 1,
  },
  swipeIndicatorLeft: {
    position: "absolute",
    top: "40%",
    left: 20,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    zIndex: 100,
  },
  swipeIndicatorRight: {
    position: "absolute",
    top: "40%",
    right: 20,
    backgroundColor: "#22C55E",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    zIndex: 100,
  },
  swipeIndicatorText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
    marginTop: 4,
  },
  // Scroll Content
  scrollView: {
    flex: 1,
  },
  // Profile Header
  profileHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  tagline: {
    fontSize: 16,
    color: "#475569",
    lineHeight: 24,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  metaChipBlue: {
    backgroundColor: "#DBEAFE",
  },
  metaChipText: {
    fontSize: 13,
    color: "#475569",
  },
  metaChipTextBlue: {
    fontSize: 13,
    color: "#1E40AF",
    fontWeight: "500",
  },
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  socialBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#E2E8F0",
  },
  statText: {
    fontSize: 13,
    color: "#64748B",
  },
  statDot: {
    fontSize: 13,
    color: "#94A3B8",
  },
  // Tab Navigation
  tabNav: {
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  tabNavContent: {
    paddingHorizontal: 16,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginRight: 4,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: {
    borderBottomColor: "#1E293B",
  },
  tabBtnText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  tabBtnTextActive: {
    color: "#1E293B",
    fontWeight: "600",
  },
  tabCount: {
    marginLeft: 4,
  },
  tabCountText: {
    fontSize: 13,
    color: "#3B82F6",
    fontWeight: "600",
  },
  // Tab Content
  tabContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 12,
  },
  aboutText: {
    fontSize: 15,
    color: "#475569",
    lineHeight: 24,
  },
  // AI Card - Clean Design
  aiCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  aiCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  aiCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiCardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  aiCardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  aiCardBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  aiCardBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#16A34A",
  },
  aiCardLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  aiCardLoadingText: {
    fontSize: 14,
    color: "#64748B",
  },
  aiCardError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiCardErrorText: {
    flex: 1,
    fontSize: 14,
    color: "#94A3B8",
  },
  aiRetryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#3B82F6",
    borderRadius: 6,
  },
  aiRetryText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFF",
  },
  aiCardText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
  },
  // Highlights Grid
  highlightsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  highlightCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  highlightTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  // Selection
  selectedCard: {
    borderColor: '#8B5CF6',
    backgroundColor: '#F5F3FF',
    borderWidth: 2,
  },
  cardWithNote: {
    backgroundColor: '#F8FAFC',
    borderColor: '#DDD6FE',
    borderWidth: 1,
  },
  noteIndicatorOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  skillNoteIndicator: {
    marginRight: 4,
  },
  // Experience
  expCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  expHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  expLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    marginRight: 12,
  },
  expInfo: {
    flex: 1,
  },
  expTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  expCompany: {
    fontSize: 14,
    color: "#3B82F6",
    fontWeight: "500",
    marginTop: 2,
  },
  expDate: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 4,
  },
  currentBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#16A34A",
  },
  expMetaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  expMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  expMetaText: {
    fontSize: 12,
    color: "#64748B",
  },
  // Education - Improved
  eduCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  eduIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  eduInfo: {
    flex: 1,
  },
  eduSchool: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 4,
  },
  eduDegree: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 6,
  },
  eduFieldChip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  eduFieldText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  eduDates: {
    fontSize: 12,
    color: "#94A3B8",
  },
  // Skills
  skillsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillChip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  skillChipText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    color: "#CBD5E1",
    textAlign: "center",
    marginTop: 6,
  },
  // Talent Signals Tab
  signalCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  signalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  signalTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  signalTypeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3B82F6",
  },
  signalScoreBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  signalScoreText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#D97706",
  },
  signalDate: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 12,
  },
  signalStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  signalStatusText: {
    fontSize: 13,
    color: "#8B5CF6",
    fontWeight: "500",
  },
  signalMoveCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    padding: 14,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#22C55E",
  },
  signalMoveCardPrevious: {
    backgroundColor: "#FEF3C7",
    borderLeftColor: "#F59E0B",
  },
  signalMoveLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  signalMoveTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 6,
  },
  signalCompanyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  signalCompanyLogo: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#F1F5F9",
  },
  signalCompanyName: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "500",
  },
  // Investor Tab
  investorCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  investorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  investorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#166534",
  },
  investorRow: {
    marginBottom: 16,
  },
  investorLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  investorValue: {
    fontSize: 15,
    color: "#1E293B",
    fontWeight: "500",
  },
  investorChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  investorChip: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  investorChipText: {
    fontSize: 12,
    color: "#166534",
    fontWeight: "500",
  },
  investorNote: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
  },
  // Action Bar Container with Voice Input
  actionBarContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 12,
  },
  voiceInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  voiceBtn: {
    marginRight: 12,
  },
  voiceHint: {
    flex: 1,
    fontSize: 13,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  voiceTranscriptBubble: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  voiceTranscriptText: {
    flex: 1,
    fontSize: 13,
    color: "#1E40AF",
    fontWeight: "500",
  },
  actionBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  actionBtnSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnSkip: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnPass: {
    backgroundColor: "#EF4444",
  },
  actionBtnSave: {
    backgroundColor: "#8B5CF6",
  },
  actionBtnLike: {
    backgroundColor: "#22C55E",
  },
  actionHint: {
    textAlign: "center",
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 6,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
  },
  // Save Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 20,
  },
  listOptions: {
    gap: 8,
  },
  listOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  listOptionSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#3B82F6",
  },
  listOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  listOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#1E293B",
  },
  customListSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  customListLabel: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 10,
  },
  customListRow: {
    flexDirection: "row",
    gap: 10,
  },
  customListInput: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1E293B",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  customListBtn: {
    backgroundColor: "#3B82F6",
    borderRadius: 10,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  customListBtnDisabled: {
    backgroundColor: "#CBD5E1",
  },
  customListBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },
  // Note Input Modal
  noteModalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  noteModalSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 16,
    lineHeight: 20,
  },
  voiceTranscriptBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  voiceTranscriptText: {
    flex: 1,
    fontSize: 14,
    color: "#1E40AF",
    fontStyle: "italic",
  },
  noteInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    fontSize: 15,
    color: "#1E293B",
    minHeight: 100,
    marginBottom: 16,
  },
  noteVoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  noteVoiceHint: {
    marginLeft: 12,
    fontSize: 13,
    color: "#64748B",
  },
  noteActionRow: {
    flexDirection: "row",
    gap: 12,
  },
  noteActionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  noteActionBtnSkip: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  noteActionBtnSkipText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
  },
  noteActionBtnSubmit: {
    backgroundColor: "#3B82F6",
  },
  noteActionBtnSubmitText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFF",
  },
  // Selection FAB
  selectionFabContainer: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
  },
  selectionFab: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  selectionCount: {
    backgroundColor: "#8B5CF6",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  selectionCountText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  selectionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    marginRight: 16,
  },
  selectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectionCancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionNoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  selectionNoteBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  // Selection Modal Chips
  selectedChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    borderColor: "#8B5CF6",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  selectedChipText: {
    fontSize: 12,
    color: "#7C3AED",
    fontWeight: "500",
  },
});
