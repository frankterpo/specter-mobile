/**
 * AgentContext - AI Memory Management for Specter Mobile
 * 
 * This context tracks user interactions (likes, dislikes, saved searches)
 * and builds a dynamic system prompt for the Cactus LLM to personalize
 * AI insights based on user preferences.
 * 
 * Integrates with InputManager for multi-modal input tracking.
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Person, SavedSearch, List } from '../api/specter';
import { logger } from '../utils/logger';
import { inputManager, UserInput } from '../ai/inputManager';
import { getCactusClient } from '../ai/cactusClient';

// ============================================
// TYPES
// ============================================

export interface UserPreferences {
  // Derived from likes
  likedIndustries: string[];
  likedSeniorities: string[];
  likedHighlights: string[];
  likedRegions: string[];
  
  // Derived from dislikes
  dislikedIndustries: string[];
  dislikedSeniorities: string[];
  dislikedRegions: string[];
  
  // Interaction counts
  totalLikes: number;
  totalDislikes: number;
  totalViewed: number;
}

export interface InteractionRecord {
  entityId: string;
  entityType: 'person' | 'company';
  action: 'like' | 'dislike' | 'view';
  timestamp: string;
  metadata?: {
    industry?: string;
    seniority?: string;
    highlights?: string[];
    region?: string;
  };
}

export interface AgentMemory {
  preferences: UserPreferences;
  recentInteractions: InteractionRecord[];
  savedSearches: SavedSearch[];
  savedSearchActivity: Record<number, number>; // searchId -> view count
  lists: List[];
  lastUpdated: string;
}

export interface AgentState {
  memory: AgentMemory;
  isLoading: boolean;
  systemPrompt: string;
  modelStatus: 'idle' | 'downloading' | 'initializing' | 'ready' | 'error';
  modelProgress: number; // 0-100
}

type AgentAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_MEMORY'; payload: AgentMemory }
  | { type: 'ADD_INTERACTION'; payload: InteractionRecord }
  | { type: 'SET_SAVED_SEARCHES'; payload: SavedSearch[] }
  | { type: 'INCREMENT_SEARCH_ACTIVITY'; payload: number }
  | { type: 'SET_LISTS'; payload: List[] }
  | { type: 'SET_MODEL_STATUS'; payload: { status: AgentState['modelStatus']; progress?: number } }
  | { type: 'CLEAR_MEMORY' };

interface AgentContextValue {
  state: AgentState;
  trackInteraction: (interaction: Omit<InteractionRecord, 'timestamp'>) => void;
  recordSearchView: (searchId: number) => void;
  setSavedSearches: (searches: SavedSearch[]) => void;
  setLists: (lists: List[]) => void;
  buildSystemPrompt: () => string;
  getPreferenceSummary: () => string;
  getFullContextForLLM: () => string;
  clearMemory: () => Promise<void>;
  isModelReady: () => boolean;
  warmUpModel: () => Promise<void>;
}

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEY = '@specter_agent_memory';
const MAX_RECENT_INTERACTIONS = 100;

const DEFAULT_PREFERENCES: UserPreferences = {
  likedIndustries: [],
  likedSeniorities: [],
  likedHighlights: [],
  likedRegions: [],
  dislikedIndustries: [],
  dislikedSeniorities: [],
  dislikedRegions: [],
  totalLikes: 0,
  totalDislikes: 0,
  totalViewed: 0,
};

const DEFAULT_MEMORY: AgentMemory = {
  preferences: DEFAULT_PREFERENCES,
  recentInteractions: [],
  savedSearches: [],
  savedSearchActivity: {},
  lists: [],
  lastUpdated: new Date().toISOString(),
};

const DEFAULT_STATE: AgentState = {
  memory: DEFAULT_MEMORY,
  isLoading: true,
  systemPrompt: '',
  modelStatus: 'idle',
  modelProgress: 0,
};

// ============================================
// HELPERS
// ============================================

function extractPreferencesFromInteractions(interactions: InteractionRecord[]): UserPreferences {
  const prefs: UserPreferences = { ...DEFAULT_PREFERENCES };
  
  const likedIndustries = new Set<string>();
  const likedSeniorities = new Set<string>();
  const likedHighlights = new Set<string>();
  const likedRegions = new Set<string>();
  const dislikedIndustries = new Set<string>();
  const dislikedSeniorities = new Set<string>();
  const dislikedRegions = new Set<string>();
  
  for (const interaction of interactions) {
    const meta = interaction.metadata;
    
    if (interaction.action === 'like') {
      prefs.totalLikes++;
      if (meta?.industry) likedIndustries.add(meta.industry);
      if (meta?.seniority) likedSeniorities.add(meta.seniority);
      if (meta?.highlights) meta.highlights.forEach(h => likedHighlights.add(h));
      if (meta?.region) likedRegions.add(meta.region);
    } else if (interaction.action === 'dislike') {
      prefs.totalDislikes++;
      if (meta?.industry) dislikedIndustries.add(meta.industry);
      if (meta?.seniority) dislikedSeniorities.add(meta.seniority);
      if (meta?.region) dislikedRegions.add(meta.region);
    } else if (interaction.action === 'view') {
      prefs.totalViewed++;
    }
  }
  
  prefs.likedIndustries = Array.from(likedIndustries);
  prefs.likedSeniorities = Array.from(likedSeniorities);
  prefs.likedHighlights = Array.from(likedHighlights);
  prefs.likedRegions = Array.from(likedRegions);
  prefs.dislikedIndustries = Array.from(dislikedIndustries);
  prefs.dislikedSeniorities = Array.from(dislikedSeniorities);
  prefs.dislikedRegions = Array.from(dislikedRegions);
  
  return prefs;
}

function buildSystemPromptFromMemory(memory: AgentMemory): string {
  const parts: string[] = [
    'You are an AI analyst helping a venture capital investor evaluate founders and companies.',
    'Be concise, direct, and highlight the most important information.',
  ];
  
  const prefs = memory.preferences;
  
  // Add preference context
  if (prefs.likedIndustries.length > 0) {
    parts.push(`User actively prefers: ${prefs.likedIndustries.slice(0, 5).join(', ')}.`);
  }
  
  if (prefs.likedHighlights.length > 0) {
    const formatted = prefs.likedHighlights
      .slice(0, 3)
      .map(h => h.replace(/_/g, ' ').toLowerCase())
      .join(', ');
    parts.push(`User values founders with: ${formatted}.`);
  }
  
  if (prefs.dislikedIndustries.length > 0) {
    parts.push(`User tends to avoid: ${prefs.dislikedIndustries.slice(0, 3).join(', ')}.`);
  }
  
  // Add saved search context
  const activeSearches = memory.savedSearches.filter(s => !s.is_global);
  if (activeSearches.length > 0) {
    const searchNames = activeSearches.slice(0, 3).map(s => s.name).join(', ');
    parts.push(`User tracks saved searches: ${searchNames}.`);
  }
  
  // Add engagement stats
  if (prefs.totalLikes > 10) {
    parts.push(`User has evaluated ${prefs.totalLikes} founders positively.`);
  }
  
  // Add most active search
  const searchActivity = Object.entries(memory.savedSearchActivity);
  if (searchActivity.length > 0) {
    const [mostActiveId] = searchActivity.sort((a, b) => b[1] - a[1])[0];
    const mostActiveSearch = memory.savedSearches.find(s => s.id === Number(mostActiveId));
    if (mostActiveSearch) {
      parts.push(`User frequently checks: "${mostActiveSearch.name}".`);
    }
  }
  
  return parts.join(' ');
}

// ============================================
// REDUCER
// ============================================

function agentReducer(state: AgentState, action: AgentAction): AgentState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
      
    case 'SET_MEMORY': {
      const systemPrompt = buildSystemPromptFromMemory(action.payload);
      return { ...state, memory: action.payload, systemPrompt };
    }
    
    case 'ADD_INTERACTION': {
      const newInteractions = [
        action.payload,
        ...state.memory.recentInteractions,
      ].slice(0, MAX_RECENT_INTERACTIONS);
      
      const preferences = extractPreferencesFromInteractions(newInteractions);
      const newMemory: AgentMemory = {
        ...state.memory,
        recentInteractions: newInteractions,
        preferences,
        lastUpdated: new Date().toISOString(),
      };
      
      const systemPrompt = buildSystemPromptFromMemory(newMemory);
      return { ...state, memory: newMemory, systemPrompt };
    }
    
    case 'SET_SAVED_SEARCHES': {
      const newMemory: AgentMemory = {
        ...state.memory,
        savedSearches: action.payload,
        lastUpdated: new Date().toISOString(),
      };
      const systemPrompt = buildSystemPromptFromMemory(newMemory);
      return { ...state, memory: newMemory, systemPrompt };
    }
    
    case 'INCREMENT_SEARCH_ACTIVITY': {
      const searchId = action.payload;
      const newActivity = {
        ...state.memory.savedSearchActivity,
        [searchId]: (state.memory.savedSearchActivity[searchId] || 0) + 1,
      };
      const newMemory: AgentMemory = {
        ...state.memory,
        savedSearchActivity: newActivity,
        lastUpdated: new Date().toISOString(),
      };
      const systemPrompt = buildSystemPromptFromMemory(newMemory);
      return { ...state, memory: newMemory, systemPrompt };
    }
    
    case 'SET_LISTS': {
      const newMemory: AgentMemory = {
        ...state.memory,
        lists: action.payload,
        lastUpdated: new Date().toISOString(),
      };
      return { ...state, memory: newMemory };
    }
    
    case 'SET_MODEL_STATUS':
      return { 
        ...state, 
        modelStatus: action.payload.status,
        modelProgress: action.payload.progress ?? state.modelProgress,
      };
    
    case 'CLEAR_MEMORY':
      return { ...DEFAULT_STATE, isLoading: false, modelStatus: state.modelStatus, modelProgress: state.modelProgress };
      
    default:
      return state;
  }
}

// ============================================
// CONTEXT
// ============================================

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(agentReducer, DEFAULT_STATE);
  
  // Pre-warm the Cactus model on app startup
  const warmUpModel = useCallback(async () => {
    // Don't start if already in progress or ready
    if (state.modelStatus === 'downloading' || state.modelStatus === 'initializing' || state.modelStatus === 'ready') {
      return;
    }
    
    try {
      const client = getCactusClient();
      const currentState = client.getState();
      
      // If already ready, just update state
      if (currentState.isReady) {
        dispatch({ type: 'SET_MODEL_STATUS', payload: { status: 'ready', progress: 100 } });
        logger.info('AgentContext', 'Model already ready');
        return;
      }
      
      // Start downloading
      dispatch({ type: 'SET_MODEL_STATUS', payload: { status: 'downloading', progress: 0 } });
      logger.info('AgentContext', 'Starting model download...');
      
      await client.download((progress) => {
        dispatch({ type: 'SET_MODEL_STATUS', payload: { status: 'downloading', progress: Math.round(progress * 100) } });
      });
      
      // Initialize model
      dispatch({ type: 'SET_MODEL_STATUS', payload: { status: 'initializing', progress: 100 } });
      logger.info('AgentContext', 'Model downloaded, initializing...');
      
      await client.ensureReady();
      
      dispatch({ type: 'SET_MODEL_STATUS', payload: { status: 'ready', progress: 100 } });
      logger.info('AgentContext', 'Model ready for inference');
      
    } catch (error) {
      logger.error('AgentContext', 'Failed to warm up model', error);
      dispatch({ type: 'SET_MODEL_STATUS', payload: { status: 'error', progress: 0 } });
    }
  }, [state.modelStatus]);
  
  // Load memory from storage on mount and start input session
  useEffect(() => {
    async function initialize() {
      try {
        // Start input manager session
        await inputManager.startSession();
        
        // Load memory from storage
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const memory = JSON.parse(stored) as AgentMemory;
          dispatch({ type: 'SET_MEMORY', payload: memory });
          logger.info('AgentContext', 'Loaded memory from storage', {
            interactions: memory.recentInteractions.length,
            searches: memory.savedSearches.length,
          });
        }
      } catch (error) {
        logger.error('AgentContext', 'Failed to initialize', error);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }
    initialize();
    
    // Listen for new inputs from InputManager
    const unsubscribe = inputManager.addInputListener((input: UserInput) => {
      logger.debug('AgentContext', 'New input from InputManager', { source: input.source });
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Pre-warm model after initial load (delayed to not block UI)
  useEffect(() => {
    if (!state.isLoading && state.modelStatus === 'idle') {
      // Delay model warmup slightly to let UI render first
      const timer = setTimeout(() => {
        warmUpModel();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.isLoading, state.modelStatus, warmUpModel]);
  
  // Persist memory to storage whenever it changes
  useEffect(() => {
    if (!state.isLoading) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.memory)).catch(error => {
        logger.error('AgentContext', 'Failed to persist memory', error);
      });
    }
  }, [state.memory, state.isLoading]);
  
  const trackInteraction = useCallback((interaction: Omit<InteractionRecord, 'timestamp'>) => {
    const fullInteraction: InteractionRecord = {
      ...interaction,
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_INTERACTION', payload: fullInteraction });
    logger.debug('AgentContext', 'Tracked interaction', { 
      action: interaction.action, 
      entityId: interaction.entityId 
    });
  }, []);
  
  const recordSearchView = useCallback((searchId: number) => {
    dispatch({ type: 'INCREMENT_SEARCH_ACTIVITY', payload: searchId });
  }, []);
  
  const setSavedSearches = useCallback((searches: SavedSearch[]) => {
    dispatch({ type: 'SET_SAVED_SEARCHES', payload: searches });
  }, []);
  
  const setLists = useCallback((lists: List[]) => {
    dispatch({ type: 'SET_LISTS', payload: lists });
  }, []);
  
  const buildSystemPrompt = useCallback(() => {
    return state.systemPrompt || buildSystemPromptFromMemory(state.memory);
  }, [state.systemPrompt, state.memory]);
  
  const getPreferenceSummary = useCallback(() => {
    const prefs = state.memory.preferences;
    const parts: string[] = [];
    
    if (prefs.totalLikes > 0 || prefs.totalDislikes > 0) {
      parts.push(`${prefs.totalLikes} likes, ${prefs.totalDislikes} dislikes`);
    }
    
    if (prefs.likedIndustries.length > 0) {
      parts.push(`Prefers: ${prefs.likedIndustries.slice(0, 2).join(', ')}`);
    }
    
    if (state.memory.savedSearches.length > 0) {
      parts.push(`${state.memory.savedSearches.length} saved searches`);
    }
    
    return parts.length > 0 ? parts.join(' • ') : 'No preferences recorded yet';
  }, [state.memory]);
  
  const getFullContextForLLM = useCallback(() => {
    // Combine AgentContext memory with InputManager session data
    const memoryContext = state.systemPrompt || buildSystemPromptFromMemory(state.memory);
    const inputContext = inputManager.buildContextForLLM();
    const patterns = inputManager.getInteractionPatterns();
    
    const parts: string[] = [memoryContext];
    
    if (inputContext) {
      parts.push(inputContext);
    }
    
    // Add engagement metrics
    if (patterns.engagementScore > 0) {
      parts.push(`User engagement score: ${patterns.engagementScore}/100`);
    }
    
    if (patterns.averageViewTime > 0) {
      parts.push(`Average time on profiles: ${Math.round(patterns.averageViewTime / 1000)}s`);
    }
    
    return parts.join('\n\n');
  }, [state.systemPrompt, state.memory]);
  
  const clearMemory = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await inputManager.clearHistory();
      dispatch({ type: 'CLEAR_MEMORY' });
      logger.info('AgentContext', 'Memory cleared');
    } catch (error) {
      logger.error('AgentContext', 'Failed to clear memory', error);
    }
  }, []);
  
  const isModelReady = useCallback(() => {
    return state.modelStatus === 'ready';
  }, [state.modelStatus]);
  
  const value: AgentContextValue = {
    state,
    trackInteraction,
    recordSearchView,
    setSavedSearches,
    setLists,
    buildSystemPrompt,
    getPreferenceSummary,
    getFullContextForLLM,
    clearMemory,
    isModelReady,
    warmUpModel,
  };
  
  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent(): AgentContextValue {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
}

// ============================================
// HELPER HOOKS
// ============================================

/**
 * Extract interaction metadata from a Person object
 */
export function extractPersonMetadata(person: Person): InteractionRecord['metadata'] {
  const currentJob = person.experience?.find(e => e.is_current);
  return {
    industry: currentJob?.industry,
    seniority: person.seniority,
    highlights: person.people_highlights,
    region: person.region,
  };
}

/**
 * Hook to get the system prompt for Cactus
 */
export function useSystemPrompt(): string {
  const { buildSystemPrompt } = useAgent();
  return buildSystemPrompt();
}

/**
 * Hook to track a like action
 */
export function useTrackLike() {
  const { trackInteraction } = useAgent();
  
  return useCallback((person: Person) => {
    trackInteraction({
      entityId: person.id,
      entityType: 'person',
      action: 'like',
      metadata: extractPersonMetadata(person),
    });
  }, [trackInteraction]);
}

/**
 * Hook to track a dislike action
 */
export function useTrackDislike() {
  const { trackInteraction } = useAgent();
  
  return useCallback((person: Person) => {
    trackInteraction({
      entityId: person.id,
      entityType: 'person',
      action: 'dislike',
      metadata: extractPersonMetadata(person),
    });
  }, [trackInteraction]);
}

/**
 * Hook to track a view action
 */
export function useTrackView() {
  const { trackInteraction } = useAgent();
  
  return useCallback((person: Person) => {
    trackInteraction({
      entityId: person.id,
      entityType: 'person',
      action: 'view',
      metadata: extractPersonMetadata(person),
    });
  }, [trackInteraction]);
}

/**
 * Hook to get model status and progress
 */
export function useModelStatus() {
  const { state, warmUpModel } = useAgent();
  
  return {
    status: state.modelStatus,
    progress: state.modelProgress,
    isReady: state.modelStatus === 'ready', // Direct comparison instead of function call
    warmUp: warmUpModel,
  };
}

