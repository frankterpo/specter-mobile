/**
 * AgentMemory - Persistent memory system for the Specter AI Agent
 * 
 * Uses embeddings for semantic search, conversation history,
 * and preference learning to create a truly personalized AI.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import type { Person, SavedSearch } from '../api/specter';

// ============================================
// TYPES
// ============================================

export interface MemoryEntry {
  id: string;
  type: 'interaction' | 'preference' | 'conversation' | 'insight';
  content: string;
  embedding?: number[];
  metadata: {
    entityId?: string;
    entityType?: 'person' | 'company' | 'search';
    action?: string;
    timestamp: string;
    importance: number; // 0-1, higher = more important
    reward?: number; // Reward signal for RL training
  };
}

// ============================================
// REWARD SIGNALS FOR RL TRAINING
// ============================================

export const REWARD_SIGNALS = {
  LIKE: 1.0,           // Positive preference
  DISLIKE: -1.0,       // Negative preference (equally valuable for training)
  SAVE: 2.0,           // High-intent action
  VIEW_LONG: 0.5,      // View > 10 seconds - implicit interest
  SKIP: -0.2,          // Skipped without action - penalize passive browsing
  VOICE_INPUT: 0.3,    // Voice feedback - explicit preference expression
  TEXT_INPUT: 0.3,     // Text feedback - explicit preference expression
  AI_ACCEPTED: 1.5,    // AI recommendation accepted
  AI_REJECTED: -0.5,   // AI recommendation rejected
} as const;

export interface RewardEvent {
  timestamp: string;
  entityId: string;
  entityType: 'person' | 'company' | 'signal';
  action: keyof typeof REWARD_SIGNALS;
  reward: number;
  features: EntityFeatures;
  context?: string; // Voice/text input
}

export interface EntityFeatures {
  industry?: string;
  seniority?: string;
  region?: string;
  highlights?: string[];
  signalType?: string;
  signalScore?: number;
  fundingStage?: string;
  companies?: string[];
  education?: string[];
}

// ============================================
// ENTITY NOTES & CONTEXT TARGETS
// ============================================

export interface ContextTarget {
  field: 'experience' | 'education' | 'skill' | 'general';
  value: string; // e.g., "Google", "React", "Stanford"
  id?: string;   // unique ID if available
}

export interface EntityNote {
  id: string;
  targets: ContextTarget[]; // Array of selected items
  note: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  timestamp: string;
}

// ============================================
// INVESTMENT PERSONAS
// ============================================

export interface PersonaCriteria {
  preferredStages: string[];      // ['stealth', 'pre-seed', 'seed', 'series_a', 'series_b', 'growth']
  preferredSignals: string[];     // ['new_founder', 'spinout', 'repeat_founder', 'yc_alum']
  industryFocus: string[];        // ['AI', 'Fintech', 'Healthcare']
  seniorityPreference: string[];  // ['C-Level', 'VP', 'Director']
  regionFocus: string[];          // ['North America', 'Europe', 'Asia']
  customCriteria: string;         // Free-form thesis text
}

export interface InvestmentPersona {
  id: string;
  name: string;                   // "Stealth Founder Hunter", "Growth Scout"
  description: string;            // User's thesis description
  criteria: PersonaCriteria;
  bulkActionSettings: {
    autoSourceLimit: number;      // Max signals per run (e.g., 20)
    confidenceThreshold: number;  // 0-1, minimum score to include
    defaultAction: 'like' | 'stage_only';
    createListsAutomatically: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

// Default persona templates
export const DEFAULT_PERSONAS: Omit<InvestmentPersona, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Stealth Founder Hunter',
    description: 'Looking for exceptional founders at the earliest stages - stealth mode companies, first-time founders with strong backgrounds, and spinouts from top companies.',
    criteria: {
      preferredStages: ['stealth', 'pre-seed'],
      preferredSignals: ['new_founder', 'spinout', 'repeat_founder'],
      industryFocus: [],
      seniorityPreference: ['C-Level', 'VP', 'Founder'],
      regionFocus: [],
      customCriteria: 'Prioritize founders from FAANG, unicorns, or top-tier startups. Look for technical backgrounds and domain expertise.',
    },
    bulkActionSettings: {
      autoSourceLimit: 20,
      confidenceThreshold: 0.6,
      defaultAction: 'stage_only',
      createListsAutomatically: true,
    },
  },
  {
    name: 'Early Stage Scout',
    description: 'Seed and pre-seed investments with proven early traction. Looking for founders who have shipped products and are gaining initial customers.',
    criteria: {
      preferredStages: ['pre-seed', 'seed'],
      preferredSignals: ['new_founder', 'repeat_founder', 'yc_alum'],
      industryFocus: [],
      seniorityPreference: ['C-Level', 'Founder'],
      regionFocus: [],
      customCriteria: 'Focus on product-market fit signals. Prior startup experience is a plus but not required.',
    },
    bulkActionSettings: {
      autoSourceLimit: 30,
      confidenceThreshold: 0.5,
      defaultAction: 'stage_only',
      createListsAutomatically: true,
    },
  },
  {
    name: 'Growth Scout',
    description: 'Series A and beyond. Evaluating proven teams with traction, revenue, and clear path to scale.',
    criteria: {
      preferredStages: ['series_a', 'series_b', 'growth'],
      preferredSignals: [],
      industryFocus: [],
      seniorityPreference: [],
      regionFocus: [],
      customCriteria: 'Focus on metrics: ARR, growth rate, unit economics. Team expansion signals are positive.',
    },
    bulkActionSettings: {
      autoSourceLimit: 15,
      confidenceThreshold: 0.7,
      defaultAction: 'stage_only',
      createListsAutomatically: true,
    },
  },
];

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  toolName?: string;
  toolResult?: any;
}

export interface UserPreference {
  category: string;
  value: string;
  confidence: number; // 0-1, increases with likes
  negativeConfidence: number; // 0-1, increases with dislikes
  examples: string[];
  negativeExamples: string[]; // Examples from dislikes
  lastUpdated: string;
}

export interface AgentMemoryState {
  // Current entity being viewed (shared across personas)
  currentEntityId?: string;
  toolCallsThisSession: number;
  
  // Investment Personas (shared)
  personas: InvestmentPersona[];
  activePersonaId: string | null;
  
  // Per-persona isolated memory states
  // Key is persona ID, value is that persona's isolated memory
  personaMemory: Record<string, PersonaMemoryState>;
  
  // Global memory for "no persona" mode (fallback)
  globalMemory: PersonaMemoryState;
  
  // Global last active timestamp
  lastActiveAt: string;
}

// ============================================
// PER-PERSONA ISOLATED STATE
// ============================================

/**
 * Each persona has its own isolated memory state.
 * This allows different investment theses to have independent:
 * - Likes/Dislikes
 * - Learned preferences
 * - Reward history
 * - Conversation history
 */
export interface PersonaMemoryState {
  personaId: string;
  conversationHistory: ConversationTurn[];
  sessionInteractions: MemoryEntry[];
  learnedPreferences: UserPreference[];
  likedEntities: { id: string; name: string; type: 'person' | 'company' | 'signal'; reason?: string; timestamp: string; features?: EntityFeatures }[];
  dislikedEntities: { id: string; name: string; type: 'person' | 'company' | 'signal'; reason?: string; timestamp: string; features?: EntityFeatures }[];
  savedEntities: { id: string; name: string; type: 'person' | 'company' | 'signal'; reason?: string; timestamp: string; features?: EntityFeatures }[];
  entityNotes: Record<string, EntityNote[]>; // Keyed by entityId
  frequentSearches: { query: string; count: number }[];
  rewardHistory: RewardEvent[];
  totalReward: number;
  totalInteractions: number;
  totalConversations: number;
  lastActiveAt: string;
}

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEY = '@specter_agent_memory_v4'; // Bumped to v4 for persona-isolated storage
const LEGACY_STORAGE_KEY = '@specter_agent_memory_v3';
const MAX_CONVERSATION_HISTORY = 20;
const MAX_SESSION_INTERACTIONS = 50;
const MAX_LIKED_ENTITIES = 100;
const MAX_SAVED_ENTITIES = 50;
const MAX_FREQUENT_SEARCHES = 20;
const MAX_REWARD_HISTORY = 500;

// ============================================
// AGENT MEMORY CLASS
// ============================================

class AgentMemory {
  private state: AgentMemoryState;
  private isLoaded = false;
  private saveDebounceTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.state = this.getDefaultState();
  }

  private getDefaultPersonaMemoryState(personaId: string = 'global'): PersonaMemoryState {
    return {
      personaId,
      conversationHistory: [],
      sessionInteractions: [],
      learnedPreferences: [],
      likedEntities: [],
      dislikedEntities: [],
      savedEntities: [],
      entityNotes: {},
      frequentSearches: [],
      rewardHistory: [],
      totalReward: 0,
      totalInteractions: 0,
      totalConversations: 0,
      lastActiveAt: new Date().toISOString(),
    };
  }

  private getDefaultState(): AgentMemoryState {
    return {
      toolCallsThisSession: 0,
      personas: [],
      activePersonaId: null,
      personaMemory: {},
      globalMemory: this.getDefaultPersonaMemoryState('global'),
      lastActiveAt: new Date().toISOString(),
    };
  }

  /**
   * Get the currently active persona's memory state.
   * If no persona is active, returns the global memory.
   * If persona is active but has no memory yet, creates one.
   */
  private getActiveState(): PersonaMemoryState {
    if (!this.state.activePersonaId) {
      return this.state.globalMemory;
    }

    // Ensure persona memory exists
    if (!this.state.personaMemory[this.state.activePersonaId]) {
      this.state.personaMemory[this.state.activePersonaId] = 
        this.getDefaultPersonaMemoryState(this.state.activePersonaId);
    }

    return this.state.personaMemory[this.state.activePersonaId];
  }

  /**
   * Get memory state for a specific persona by ID.
   * Creates new state if it doesn't exist.
   */
  getPersonaState(personaId: string): PersonaMemoryState {
    if (personaId === 'global' || !personaId) {
      return this.state.globalMemory;
    }

    if (!this.state.personaMemory[personaId]) {
      this.state.personaMemory[personaId] = this.getDefaultPersonaMemoryState(personaId);
    }

    return this.state.personaMemory[personaId];
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  async load(): Promise<void> {
    if (this.isLoaded) return;

    try {
      // Try loading v4 format first
      let stored = await AsyncStorage.getItem(STORAGE_KEY);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        this.state = { ...this.getDefaultState(), ...parsed };
        
        // Ensure globalMemory exists (defensive)
        if (!this.state.globalMemory) {
          this.state.globalMemory = this.getDefaultPersonaMemoryState('global');
        }
        if (!this.state.personaMemory) {
          this.state.personaMemory = {};
        }
        
        // Backfill missing fields for global memory
        if (!this.state.globalMemory.entityNotes) {
          this.state.globalMemory.entityNotes = {};
        }

        // Ensure each persona has its own isolated memory state and backfill fields
        for (const persona of this.state.personas) {
          if (!this.state.personaMemory[persona.id]) {
            this.state.personaMemory[persona.id] = this.getDefaultPersonaMemoryState(persona.id);
            logger.info('AgentMemory', 'Initialized missing memory for persona', { 
              personaId: persona.id, 
              name: persona.name 
            });
          } else if (!this.state.personaMemory[persona.id].entityNotes) {
            // Backfill entityNotes if missing
            this.state.personaMemory[persona.id].entityNotes = {};
          }
        }
        
        const activeState = this.getActiveState();
        logger.info('AgentMemory', 'Loaded v4 memory', {
          personas: this.state.personas.length,
          personaMemoryKeys: Object.keys(this.state.personaMemory).length,
          activePersona: this.state.activePersonaId,
          preferences: activeState.learnedPreferences.length,
          liked: activeState.likedEntities.length,
          interactions: activeState.totalInteractions,
        });
      } else {
        // Try migrating from v3 format
        const legacyStored = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyStored) {
          await this.migrateFromV3(legacyStored);
        }
      }
      
      this.isLoaded = true;
    } catch (error) {
      logger.error('AgentMemory', 'Failed to load memory', error);
      this.state = this.getDefaultState();
      this.isLoaded = true;
    }
  }

  /**
   * Migrate from v3 (flat) to v4 (per-persona) storage format.
   * Moves all existing data to the global memory state.
   */
  private async migrateFromV3(legacyData: string): Promise<void> {
    try {
      const v3 = JSON.parse(legacyData);
      logger.info('AgentMemory', 'Migrating from v3 to v4 format');

      // Create new v4 state
      this.state = this.getDefaultState();

      // Move v3 data to global memory
      this.state.globalMemory = {
        personaId: 'global',
        conversationHistory: v3.conversationHistory || [],
        sessionInteractions: v3.sessionInteractions || [],
        learnedPreferences: v3.learnedPreferences || [],
        likedEntities: v3.likedEntities || [],
        dislikedEntities: v3.dislikedEntities || [],
        savedEntities: v3.savedEntities || [],
        entityNotes: {},
        frequentSearches: v3.frequentSearches || [],
        rewardHistory: v3.rewardHistory || [],
        totalReward: v3.totalReward || 0,
        totalInteractions: v3.totalInteractions || 0,
        totalConversations: v3.totalConversations || 0,
        lastActiveAt: v3.lastActiveAt || new Date().toISOString(),
      };

      // Preserve personas if they existed
      this.state.personas = v3.personas || [];
      this.state.activePersonaId = v3.activePersonaId || null;
      this.state.toolCallsThisSession = v3.toolCallsThisSession || 0;

      // Initialize personaMemory for each existing persona
      this.state.personaMemory = v3.personaMemory || {};
      for (const persona of this.state.personas) {
        if (!this.state.personaMemory[persona.id]) {
          this.state.personaMemory[persona.id] = this.getDefaultPersonaMemoryState(persona.id);
          logger.info('AgentMemory', 'Initialized memory for persona during migration', { 
            personaId: persona.id, 
            name: persona.name 
          });
        }
      }

      // Save in new format
      await this.save();

      // Optionally delete legacy key after successful migration
      // await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);

      logger.info('AgentMemory', 'Migration complete', {
        liked: this.state.globalMemory.likedEntities.length,
        preferences: this.state.globalMemory.learnedPreferences.length,
        personas: this.state.personas.length,
        personaMemoryKeys: Object.keys(this.state.personaMemory).length,
      });
    } catch (error) {
      logger.error('AgentMemory', 'Migration failed, starting fresh', error);
      this.state = this.getDefaultState();
    }
  }

  private async save(): Promise<void> {
    // Debounce saves
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    
    this.saveDebounceTimer = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (error) {
        logger.error('AgentMemory', 'Failed to save memory', error);
      }
    }, 1000);
  }

  // ============================================
  // CONVERSATION MANAGEMENT
  // ============================================

  addConversationTurn(turn: Omit<ConversationTurn, 'timestamp'>): void {
    const activeState = this.getActiveState();
    const fullTurn: ConversationTurn = {
      ...turn,
      timestamp: new Date().toISOString(),
    };

    activeState.conversationHistory.push(fullTurn);
    
    // Trim if too long
    if (activeState.conversationHistory.length > MAX_CONVERSATION_HISTORY) {
      activeState.conversationHistory = activeState.conversationHistory.slice(-MAX_CONVERSATION_HISTORY);
    }

    activeState.totalConversations++;
    activeState.lastActiveAt = new Date().toISOString();
    this.state.lastActiveAt = new Date().toISOString();
    this.save();
  }

  getConversationHistory(): ConversationTurn[] {
    return this.getActiveState().conversationHistory;
  }

  getRecentConversationForContext(maxTurns = 10): string {
    const activeState = this.getActiveState();
    const recent = activeState.conversationHistory.slice(-maxTurns);
    if (recent.length === 0) return '';

    return recent.map(turn => {
      if (turn.role === 'tool') {
        return `[Tool: ${turn.toolName}] ${turn.content.slice(0, 200)}...`;
      }
      return `${turn.role.toUpperCase()}: ${turn.content}`;
    }).join('\n');
  }

  clearConversation(): void {
    const activeState = this.getActiveState();
    activeState.conversationHistory = [];
    this.state.currentEntityId = undefined;
    this.save();
  }

  setCurrentEntity(entityId: string): void {
    this.state.currentEntityId = entityId;
  }

  // ============================================
  // INTERACTION TRACKING
  // ============================================

  recordInteraction(
    type: MemoryEntry['type'],
    content: string,
    metadata: Partial<MemoryEntry['metadata']> = {}
  ): void {
    const activeState = this.getActiveState();
    const entry: MemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      content,
      metadata: {
        timestamp: new Date().toISOString(),
        importance: 0.5,
        ...metadata,
      },
    };

    activeState.sessionInteractions.push(entry);
    
    // Trim if too long
    if (activeState.sessionInteractions.length > MAX_SESSION_INTERACTIONS) {
      // Keep high-importance entries
      activeState.sessionInteractions.sort((a, b) => 
        b.metadata.importance - a.metadata.importance
      );
      activeState.sessionInteractions = activeState.sessionInteractions.slice(0, MAX_SESSION_INTERACTIONS);
    }

    activeState.totalInteractions++;
    this.save();
  }

  recordToolCall(toolName: string, result: any): void {
    this.state.toolCallsThisSession++;
    this.addConversationTurn({
      role: 'tool',
      content: typeof result === 'string' ? result : JSON.stringify(result).slice(0, 500),
      toolName,
      toolResult: result,
    });
  }

  // ============================================
  // PREFERENCE LEARNING
  // ============================================

  recordLike(entity: { id: string; name: string; type?: 'person' | 'company' | 'signal'; features?: EntityFeatures }, reason?: string): void {
    const activeState = this.getActiveState();
    const entityType = entity.type || 'person';
    const features = entity.features || {};
    const reward = REWARD_SIGNALS.LIKE;
    
    // Remove from dislikes if present
    activeState.dislikedEntities = activeState.dislikedEntities.filter(e => e.id !== entity.id);
    
    // Add to likes
    const existing = activeState.likedEntities.find(e => e.id === entity.id);
    if (!existing) {
      activeState.likedEntities.unshift({ 
        id: entity.id, 
        name: entity.name, 
        type: entityType,
        reason, 
        timestamp: new Date().toISOString(),
        features,
      });
      
      // Trim if too long
      if (activeState.likedEntities.length > MAX_LIKED_ENTITIES) {
        activeState.likedEntities = activeState.likedEntities.slice(0, MAX_LIKED_ENTITIES);
      }
    }

    // Record reward event
    this.recordRewardEvent({
      entityId: entity.id,
      entityType,
      action: 'LIKE',
      reward,
      features,
      context: reason,
    });

    // Learn from features (positive)
    this.learnFromFeatures(features, true);

    this.recordInteraction('preference', `Liked ${entity.name}`, {
      entityId: entity.id,
      action: 'like',
      importance: 0.8,
      reward,
    });

    this.save();
  }

  recordDislike(entity: { id: string; name: string; type?: 'person' | 'company' | 'signal'; features?: EntityFeatures }, reason?: string): void {
    const activeState = this.getActiveState();
    const entityType = entity.type || 'person';
    const features = entity.features || {};
    const reward = REWARD_SIGNALS.DISLIKE;
    
    // Remove from likes if present
    activeState.likedEntities = activeState.likedEntities.filter(e => e.id !== entity.id);
    
    // Add to dislikes
    const existing = activeState.dislikedEntities.find(e => e.id === entity.id);
    if (!existing) {
      activeState.dislikedEntities.unshift({ 
        id: entity.id, 
        name: entity.name, 
        type: entityType,
        reason, 
        timestamp: new Date().toISOString(),
        features,
      });
      
      // Trim
      if (activeState.dislikedEntities.length > MAX_LIKED_ENTITIES) {
        activeState.dislikedEntities = activeState.dislikedEntities.slice(0, MAX_LIKED_ENTITIES);
      }
    }

    // Record reward event
    this.recordRewardEvent({
      entityId: entity.id,
      entityType,
      action: 'DISLIKE',
      reward,
      features,
      context: reason,
    });

    // Learn from features (negative)
    this.learnFromFeatures(features, false);

    this.recordInteraction('preference', `Disliked ${entity.name}`, {
      entityId: entity.id,
      action: 'dislike',
      importance: 0.7,
      reward,
    });

    this.save();
  }

  recordSave(entity: { id: string; name: string; type?: 'person' | 'company' | 'signal'; features?: EntityFeatures }, reason?: string): void {
    const activeState = this.getActiveState();
    const entityType = entity.type || 'person';
    const features = entity.features || {};
    const reward = REWARD_SIGNALS.SAVE;
    
    // Add to saved entities
    const existing = activeState.savedEntities.find(e => e.id === entity.id);
    if (!existing) {
      activeState.savedEntities.unshift({
        id: entity.id,
        name: entity.name,
        type: entityType,
        reason,
        timestamp: new Date().toISOString(),
        features,
      });
      
      // Trim
      if (activeState.savedEntities.length > MAX_SAVED_ENTITIES) {
        activeState.savedEntities = activeState.savedEntities.slice(0, MAX_SAVED_ENTITIES);
      }
    }

    // Record reward event (high intent)
    this.recordRewardEvent({
      entityId: entity.id,
      entityType,
      action: 'SAVE',
      reward,
      features,
      context: reason,
    });

    // Learn from features (strong positive)
    this.learnFromFeatures(features, true, 2.0); // Double weight for saves
    
    this.recordInteraction('preference', `Saved ${entity.name} to list`, {
      entityId: entity.id,
      action: 'save',
      importance: 1.0,
      reward,
    });

    this.save();
  }

  // Record a reward event for RL training
  private recordRewardEvent(event: Omit<RewardEvent, 'timestamp'>): void {
    const activeState = this.getActiveState();
    const fullEvent: RewardEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    activeState.rewardHistory.unshift(fullEvent);
    activeState.totalReward += event.reward;

    // Trim if too long
    if (activeState.rewardHistory.length > MAX_REWARD_HISTORY) {
      activeState.rewardHistory = activeState.rewardHistory.slice(0, MAX_REWARD_HISTORY);
    }

    logger.info('AgentMemory', `Reward recorded: ${event.action} = ${event.reward}`, {
      entityId: event.entityId,
      persona: this.state.activePersonaId || 'global',
      totalReward: activeState.totalReward,
    });
  }

  // Learn preferences from entity features
  private learnFromFeatures(features: EntityFeatures, isPositive: boolean, weight: number = 1.0): void {
    if (features.industry) {
      this.learnPreference('industry', features.industry, `${isPositive ? 'Liked' : 'Disliked'} in ${features.industry}`, isPositive, weight);
    }
    if (features.seniority) {
      this.learnPreference('seniority', features.seniority, `${isPositive ? 'Liked' : 'Disliked'} ${features.seniority}`, isPositive, weight);
    }
    if (features.region) {
      this.learnPreference('region', features.region, `${isPositive ? 'Liked' : 'Disliked'} in ${features.region}`, isPositive, weight);
    }
    if (features.signalType) {
      this.learnPreference('signal_type', features.signalType, `${isPositive ? 'Liked' : 'Disliked'} ${features.signalType}`, isPositive, weight);
    }
    if (features.fundingStage) {
      this.learnPreference('funding_stage', features.fundingStage, `${isPositive ? 'Liked' : 'Disliked'} ${features.fundingStage}`, isPositive, weight);
    }
    if (features.highlights?.length) {
      features.highlights.slice(0, 3).forEach(h => {
        this.learnPreference('highlight', h, `${isPositive ? 'Liked' : 'Disliked'} with ${h}`, isPositive, weight);
      });
    }
    if (features.companies?.length) {
      features.companies.slice(0, 3).forEach(c => {
        this.learnPreference('experience', c, `${isPositive ? 'Liked' : 'Disliked'} experience at ${c}`, isPositive, weight);
      });
    }
    if (features.education?.length) {
      features.education.slice(0, 2).forEach(e => {
        this.learnPreference('education', e, `${isPositive ? 'Liked' : 'Disliked'} education at ${e}`, isPositive, weight);
      });
    }
  }

  // Legacy methods for backwards compatibility
  learnFromLike(entity: { industry?: string; seniority?: string; region?: string; highlights?: string[] }): void {
    this.learnFromFeatures(entity, true);
  }

  learnFromDislike(entity: { industry?: string; seniority?: string; region?: string; highlights?: string[] }): void {
    this.learnFromFeatures(entity, false);
  }

  recordSearch(query: string): void {
    const activeState = this.getActiveState();
    const existing = activeState.frequentSearches.find(
      s => s.query.toLowerCase() === query.toLowerCase()
    );
    
    if (existing) {
      existing.count++;
    } else {
      activeState.frequentSearches.unshift({ query, count: 1 });
    }

    // Sort by frequency and trim
    activeState.frequentSearches.sort((a, b) => b.count - a.count);
    activeState.frequentSearches = activeState.frequentSearches.slice(0, MAX_FREQUENT_SEARCHES);

    this.recordInteraction('interaction', `Searched: ${query}`, {
      action: 'search',
      importance: 0.6,
    });

    this.save();
  }

  learnPreference(category: string, value: string, example: string, isPositive: boolean = true, weight: number = 1.0): void {
    const activeState = this.getActiveState();
    const existing = activeState.learnedPreferences.find(
      p => p.category === category && p.value === value
    );

    const increment = 0.1 * weight;

    if (existing) {
      if (isPositive) {
        existing.confidence = Math.min(1, existing.confidence + increment);
        if (!existing.examples.includes(example)) {
          existing.examples.push(example);
          if (existing.examples.length > 5) {
            existing.examples = existing.examples.slice(-5);
          }
        }
      } else {
        existing.negativeConfidence = Math.min(1, existing.negativeConfidence + increment);
        if (!existing.negativeExamples.includes(example)) {
          existing.negativeExamples.push(example);
          if (existing.negativeExamples.length > 5) {
            existing.negativeExamples = existing.negativeExamples.slice(-5);
          }
        }
      }
      existing.lastUpdated = new Date().toISOString();
    } else {
      activeState.learnedPreferences.push({
        category,
        value,
        confidence: isPositive ? 0.5 : 0,
        negativeConfidence: isPositive ? 0 : 0.5,
        examples: isPositive ? [example] : [],
        negativeExamples: isPositive ? [] : [example],
        lastUpdated: new Date().toISOString(),
      });
    }

    this.save();
  }

  // ============================================
  // ENTITY SCORING & RANKING
  // ============================================

  /**
   * Calculate a match score for an entity based on learned preferences
   * Returns a score between 0-100 and a list of matching reasons
   */
  calculateMatchScore(features: EntityFeatures): { score: number; reasons: string[]; warnings: string[] } {
    const activeState = this.getActiveState();
    const reasons: string[] = [];
    const warnings: string[] = [];
    let totalScore = 50; // Start at neutral
    let matchCount = 0;
    let mismatchCount = 0;

    // Check each feature against learned preferences
    const checkFeature = (category: string, value: string | undefined, label: string) => {
      if (!value) return;
      
      const pref = activeState.learnedPreferences.find(
        p => p.category === category && p.value.toLowerCase() === value.toLowerCase()
      );
      
      if (pref) {
        const netScore = pref.confidence - pref.negativeConfidence;
        if (netScore > 0.2) {
          totalScore += netScore * 15;
          reasons.push(`✓ ${label}: ${value} (${Math.round(pref.confidence * 100)}% match)`);
          matchCount++;
        } else if (netScore < -0.2) {
          totalScore -= Math.abs(netScore) * 15;
          warnings.push(`⚠ ${label}: ${value} (${Math.round(pref.negativeConfidence * 100)}% avoid)`);
          mismatchCount++;
        }
      }
    };

    // Check all feature categories
    checkFeature('industry', features.industry, 'Industry');
    checkFeature('seniority', features.seniority, 'Seniority');
    checkFeature('region', features.region, 'Region');
    checkFeature('signal_type', features.signalType, 'Signal');
    checkFeature('funding_stage', features.fundingStage, 'Stage');

    // Check highlights
    if (features.highlights?.length) {
      for (const highlight of features.highlights) {
        checkFeature('highlight', highlight, 'Highlight');
      }
    }

    // Check experience (companies)
    if (features.companies?.length) {
      for (const company of features.companies) {
        checkFeature('experience', company, 'Experience');
      }
    }

    // Check education
    if (features.education?.length) {
      for (const school of features.education) {
        checkFeature('education', school, 'Education');
      }
    }

    // Check patterns (combos)
    const patterns = activeState.learnedPreferences.filter(p => p.category === 'pattern');
    for (const pattern of patterns) {
      const targets = pattern.value.split(' + ');
      const allFound = targets.every(t => {
        const tLower = t.toLowerCase();
        return (
          features.industry?.toLowerCase().includes(tLower) ||
          features.seniority?.toLowerCase().includes(tLower) ||
          features.region?.toLowerCase().includes(tLower) ||
          features.companies?.some(c => c.toLowerCase().includes(tLower)) ||
          features.education?.some(e => e.toLowerCase().includes(tLower)) ||
          features.highlights?.some(h => h.toLowerCase().includes(tLower))
        );
      });

      if (allFound) {
        const netScore = pattern.confidence - pattern.negativeConfidence;
        if (netScore > 0.2) {
          totalScore += netScore * 25; // Very high score for pattern match
          reasons.push(`🔥 Matches combo: ${pattern.value} (${Math.round(pattern.confidence * 100)}%)`);
          matchCount += 2;
        }
      }
    }

    // Bonus for multiple matches
    if (matchCount >= 3) {
      totalScore += 10;
      reasons.push(`🔥 Strong match (${matchCount} preferences)`);
    }

    // Penalty for multiple mismatches
    if (mismatchCount >= 2) {
      totalScore -= 10;
      warnings.push(`⚠ Multiple mismatches (${mismatchCount} concerns)`);
    }

    // Check against active persona criteria
    const persona = this.getActivePersona();
    if (persona) {
      const criteria = persona.criteria;
      
      // Check preferred stages
      if (criteria.preferredStages.length > 0 && features.fundingStage) {
        if (criteria.preferredStages.includes(features.fundingStage.toLowerCase())) {
          totalScore += 10;
          reasons.push(`✓ Persona stage match: ${features.fundingStage}`);
        } else {
          totalScore -= 5;
          warnings.push(`⚠ Stage mismatch for ${persona.name}`);
        }
      }

      // Check industry focus
      if (criteria.industryFocus.length > 0 && features.industry) {
        const industryMatch = criteria.industryFocus.some(
          i => features.industry?.toLowerCase().includes(i.toLowerCase())
        );
        if (industryMatch) {
          totalScore += 10;
          reasons.push(`✓ Persona industry match: ${features.industry}`);
        }
      }

      // Check seniority preference
      if (criteria.seniorityPreference.length > 0 && features.seniority) {
        if (criteria.seniorityPreference.some(s => features.seniority?.toLowerCase().includes(s.toLowerCase()))) {
          totalScore += 5;
          reasons.push(`✓ Persona seniority match: ${features.seniority}`);
        }
      }
    }

    // Clamp score between 0-100
    const finalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

    // Don't add fallback message - return empty reasons array instead

    if (__DEV__) {
      logger.debug('AgentMemory', 'Calculated Match Score', {
        features: {
          industry: features.industry,
          funding: features.fundingStage,
          signal: features.signalType,
        },
        score: finalScore,
        matches: matchCount,
        mismatches: mismatchCount,
        reasons,
        warnings,
        persona: persona?.name
      });
    }

    return {
      score: finalScore,
      reasons: reasons.slice(0, 5), // Top 5 reasons
      warnings: warnings.slice(0, 3), // Top 3 warnings
    };
  }

  /**
   * Rank a list of entities by predicted preference score
   * Returns sorted list with scores and explanations
   */
  rankEntities<T extends { id: string; features?: EntityFeatures }>(
    entities: T[]
  ): Array<T & { matchScore: number; matchReasons: string[]; matchWarnings: string[] }> {
    return entities
      .map(entity => {
        const { score, reasons, warnings } = this.calculateMatchScore(entity.features || {});
        return {
          ...entity,
          matchScore: score,
          matchReasons: reasons,
          matchWarnings: warnings,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Get a "Why you might like this" explanation for an entity
   */
  getWhyYouMightLike(features: EntityFeatures): string {
    const { score, reasons, warnings } = this.calculateMatchScore(features);
    
    if (reasons.length === 0 && warnings.length === 0) {
      return "We're still learning your preferences. Like or pass on more profiles to get personalized recommendations.";
    }

    const parts: string[] = [];
    
    if (score >= 70) {
      parts.push("🎯 **Strong Match**");
    } else if (score >= 50) {
      parts.push("👍 **Potential Match**");
    } else {
      parts.push("🤔 **Mixed Signals**");
    }

    if (reasons.length > 0) {
      parts.push("\n**Why this might be a fit:**");
      parts.push(reasons.join('\n'));
    }

    if (warnings.length > 0 && score < 70) {
      parts.push("\n**Things to consider:**");
      parts.push(warnings.join('\n'));
    }

    return parts.join('\n');
  }

  // ============================================
  // ENTITY NOTES
  // ============================================

  recordEntityNote(
    entityId: string,
    entityName: string,
    targets: ContextTarget[],
    note: string,
    sentiment: 'positive' | 'negative' | 'neutral'
  ): void {
    const activeState = this.getActiveState();
    
    const entityNote: EntityNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      targets,
      note,
      sentiment,
      timestamp: new Date().toISOString(),
    };

    if (!activeState.entityNotes[entityId]) {
      activeState.entityNotes[entityId] = [];
    }
    activeState.entityNotes[entityId].push(entityNote);

    // Learn from each target
    targets.forEach(target => {
      const category = target.field;
      const value = target.value;
      const weight = 1.5; // High confidence for explicit notes
      
      if (sentiment === 'positive') {
        this.learnPreference(category, value, `Note on ${entityName}: ${note}`, true, weight);
      } else if (sentiment === 'negative') {
        this.learnPreference(category, value, `Note on ${entityName}: ${note}`, false, weight);
      }
    });

    // If multiple targets, learn the pattern (combo)
    if (targets.length > 1 && sentiment === 'positive') {
      const comboKey = targets.map(t => t.value).sort().join(' + ');
      this.learnPreference('pattern', comboKey, `Combo in ${entityName}: ${note}`, true, 2.0);
    }

    // Record interaction
    this.recordInteraction('interaction', `Added note to ${entityName}: ${note}`, {
      entityId,
      action: 'add_note',
      importance: 0.9,
    });

    this.save();
  }

  // ============================================
  // CONTEXT BUILDING
  // ============================================

  /**
   * Build a comprehensive context string for the AI
   * This is the MAIN method for injecting memory into prompts
   * Uses the ACTIVE PERSONA's isolated memory state
   */
  buildFullContext(): string {
    const activeState = this.getActiveState();
    const parts: string[] = [];

    // Active persona context (FIRST - most important for evaluation)
    const personaContext = this.buildPersonaContext();
    if (personaContext && this.getActivePersona()) {
      parts.push(personaContext);
    }

    // Notes on current entity (if any)
    if (this.state.currentEntityId && activeState.entityNotes[this.state.currentEntityId]) {
      const notes = activeState.entityNotes[this.state.currentEntityId];
      if (notes.length > 0) {
        const noteLines = notes.map(n => {
          const targets = n.targets.map(t => t.value).join(', ');
          return `- [${targets}]: ${n.note} (${n.sentiment})`;
        });
        parts.push(`USER NOTES ON THIS PROFILE:\n${noteLines.join('\n')}`);
      }
    }

    // User preferences summary (includes both positive and negative)
    const prefSummary = this.buildPreferenceSummary();
    if (prefSummary) {
      parts.push(`USER PREFERENCES (${this.state.activePersonaId ? 'for ' + this.getActivePersona()?.name : 'global'}):\n${prefSummary}`);
    }

    // Recent likes for comparison context (with features)
    if (activeState.likedEntities.length > 0) {
      const recentLikes = activeState.likedEntities.slice(0, 5);
      const likeLines = recentLikes.map(e => {
        const features = [];
        if (e.features?.industry) features.push(e.features.industry);
        if (e.features?.seniority) features.push(e.features.seniority);
        if (e.features?.region) features.push(e.features.region);
        const featureStr = features.length > 0 ? ` (${features.join(', ')})` : '';
        return `- ${e.name}${featureStr}${e.reason ? `: ${e.reason}` : ''}`;
      });
      parts.push(`RECENTLY LIKED (${activeState.likedEntities.length} total):\n${likeLines.join('\n')}`);
    }

    // Recent dislikes (important for knowing what to avoid)
    if (activeState.dislikedEntities.length > 0) {
      const recentDislikes = activeState.dislikedEntities.slice(0, 3);
      const dislikeLines = recentDislikes.map(e => {
        const features = [];
        if (e.features?.industry) features.push(e.features.industry);
        if (e.features?.seniority) features.push(e.features.seniority);
        return `- ${e.name}${features.length > 0 ? ` (${features.join(', ')})` : ''}`;
      });
      parts.push(`RECENTLY DISLIKED (avoid similar):\n${dislikeLines.join('\n')}`);
    }

    // Saved entities (high intent)
    if (activeState.savedEntities && activeState.savedEntities.length > 0) {
      const recentSaved = activeState.savedEntities.slice(0, 3);
      parts.push(`SAVED (high intent):\n${recentSaved.map(e => `- ${e.name}`).join('\n')}`);
    }

    // Frequent searches show intent
    if (activeState.frequentSearches.length > 0) {
      const topSearches = activeState.frequentSearches.slice(0, 3);
      parts.push(`FREQUENT SEARCHES:\n${topSearches.map(s => `- "${s.query}" (${s.count}x)`).join('\n')}`);
    }

    // Recent conversation for continuity
    const recentConvo = this.getRecentConversationForContext(5);
    if (recentConvo) {
      parts.push(`RECENT CONVERSATION:\n${recentConvo}`);
    }

    // Reward summary
    const stats = this.getStats();
    parts.push(`TRAINING STATS: ${stats.likedCount} likes, ${stats.dislikedCount} dislikes, ${stats.savedCount} saved, Total reward: ${stats.totalReward.toFixed(1)}`);

    return parts.join('\n\n');
  }

  /**
   * Build a system prompt that incorporates all learned preferences
   * Use this for AI completions
   */
  buildSystemPrompt(): string {
    const activeState = this.getActiveState();
    const parts: string[] = [
      'You are a deal-sourcing AI agent for a venture capital investor.',
      'Be concise, direct, and highlight the most important information.',
      'Personalize your responses based on the user\'s demonstrated preferences.',
    ];

    // Add active persona context
    const persona = this.getActivePersona();
    if (persona) {
      parts.push(`\nActive investment persona: "${persona.name}" - ${persona.description}`);
    }

    // Add preference context
    const prefSummary = this.buildPreferenceSummary();
    if (prefSummary) {
      parts.push(`\nUser preferences learned from ${activeState.likedEntities.length + activeState.dislikedEntities.length} interactions:\n${prefSummary}`);
    }

    // Add context about what to emphasize
    const positivePrefs = activeState.learnedPreferences
      .filter(p => p.confidence - p.negativeConfidence > 0.3)
      .slice(0, 5);
    
    if (positivePrefs.length > 0) {
      const emphasisPoints = positivePrefs.map(p => `${p.category}: ${p.value}`).join(', ');
      parts.push(`\nEmphasize matches with: ${emphasisPoints}`);
    }

    // Add context about what to de-emphasize
    const negativePrefs = activeState.learnedPreferences
      .filter(p => p.negativeConfidence - p.confidence > 0.3)
      .slice(0, 3);
    
    if (negativePrefs.length > 0) {
      const avoidPoints = negativePrefs.map(p => `${p.category}: ${p.value}`).join(', ');
      parts.push(`\nBe cautious about: ${avoidPoints}`);
    }

    return parts.join(' ');
  }

  buildPreferenceSummary(): string {
    const activeState = this.getActiveState();
    if (activeState.learnedPreferences.length === 0) {
      return '';
    }

    // Group by category, separating positive and negative
    const positiveByCategory: Record<string, string[]> = {};
    const negativeByCategory: Record<string, string[]> = {};
    
    for (const pref of activeState.learnedPreferences) {
      // Net preference score (positive - negative)
      const netScore = pref.confidence - pref.negativeConfidence;
      
      if (netScore >= 0.3) {
        // Strong positive preference
        if (!positiveByCategory[pref.category]) {
          positiveByCategory[pref.category] = [];
        }
        positiveByCategory[pref.category].push(pref.value);
      } else if (netScore <= -0.3) {
        // Strong negative preference
        if (!negativeByCategory[pref.category]) {
          negativeByCategory[pref.category] = [];
        }
        negativeByCategory[pref.category].push(pref.value);
      }
    }

    const lines: string[] = [];
    
    // Positive preferences
    for (const [category, values] of Object.entries(positiveByCategory)) {
      lines.push(`- Prefers ${category}: ${values.join(', ')}`);
    }
    
    // Negative preferences
    for (const [category, values] of Object.entries(negativeByCategory)) {
      lines.push(`- Avoids ${category}: ${values.join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Get liked entity IDs for API comparison calls
   */
  getLikedEntityIds(): string[] {
    return this.getActiveState().likedEntities.map(e => e.id);
  }

  /**
   * Check if an entity was liked (in current persona)
   */
  isLiked(entityId: string): boolean {
    return this.getActiveState().likedEntities.some(e => e.id === entityId);
  }

  /**
   * Check if an entity was disliked (in current persona)
   */
  isDisliked(entityId: string): boolean {
    return this.getActiveState().dislikedEntities.some(e => e.id === entityId);
  }

  // ============================================
  // STATS & DEBUGGING
  // ============================================

  getStats(): {
    totalInteractions: number;
    totalConversations: number;
    likedCount: number;
    dislikedCount: number;
    savedCount: number;
    preferencesLearned: number;
    toolCallsThisSession: number;
    totalReward: number;
    rewardEventCount: number;
    activePersonaId: string | null;
    personaCount: number;
  } {
    const activeState = this.getActiveState();
    return {
      totalInteractions: activeState.totalInteractions,
      totalConversations: activeState.totalConversations,
      likedCount: activeState.likedEntities.length,
      dislikedCount: activeState.dislikedEntities.length,
      savedCount: activeState.savedEntities?.length || 0,
      preferencesLearned: activeState.learnedPreferences.length,
      toolCallsThisSession: this.state.toolCallsThisSession,
      totalReward: activeState.totalReward || 0,
      rewardEventCount: activeState.rewardHistory?.length || 0,
      activePersonaId: this.state.activePersonaId,
      personaCount: this.state.personas.length,
    };
  }

  /**
   * Get stats for a specific persona
   */
  getPersonaStats(personaId: string): {
    totalInteractions: number;
    likedCount: number;
    dislikedCount: number;
    savedCount: number;
    preferencesLearned: number;
    totalReward: number;
  } {
    const state = this.getPersonaState(personaId);
    return {
      totalInteractions: state.totalInteractions,
      likedCount: state.likedEntities.length,
      dislikedCount: state.dislikedEntities.length,
      savedCount: state.savedEntities?.length || 0,
      preferencesLearned: state.learnedPreferences.length,
      totalReward: state.totalReward || 0,
    };
  }

  // Get reward history for RL training export
  getRewardHistory(): RewardEvent[] {
    return [...this.getActiveState().rewardHistory];
  }

  // Get liked entities (from current persona)
  getLikedEntities(): PersonaMemoryState['likedEntities'] {
    return [...this.getActiveState().likedEntities];
  }

  // Get disliked entities (from current persona)
  getDislikedEntities(): PersonaMemoryState['dislikedEntities'] {
    return [...this.getActiveState().dislikedEntities];
  }

  // Get saved entities (from current persona)
  getSavedEntities(): PersonaMemoryState['savedEntities'] {
    return [...(this.getActiveState().savedEntities || [])];
  }

  // Get learned preferences (from current persona)
  getLearnedPreferences(): UserPreference[] {
    return [...this.getActiveState().learnedPreferences];
  }

  // Get notes for a specific entity (from current persona)
  getEntityNotes(entityId: string): EntityNote[] {
    const activeState = this.getActiveState();
    return activeState.entityNotes[entityId] || [];
  }

  /**
   * Clear all memory (global and all personas)
   */
  async clearAll(): Promise<void> {
    this.state = this.getDefaultState();
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    logger.info('AgentMemory', 'All memory cleared');
  }

  /**
   * Clear only the active persona's memory
   */
  async clearActivePersonaMemory(): Promise<void> {
    if (this.state.activePersonaId) {
      this.state.personaMemory[this.state.activePersonaId] = 
        this.getDefaultPersonaMemoryState(this.state.activePersonaId);
    } else {
      this.state.globalMemory = this.getDefaultPersonaMemoryState('global');
    }
    await this.save();
    logger.info('AgentMemory', 'Active persona memory cleared', {
      persona: this.state.activePersonaId || 'global'
    });
  }

  // ============================================
  // PERSONA MANAGEMENT
  // ============================================

  /**
   * Create a new investment persona
   */
  createPersona(
    name: string,
    description: string,
    criteria: Partial<PersonaCriteria> = {},
    bulkSettings?: Partial<InvestmentPersona['bulkActionSettings']>
  ): InvestmentPersona {
    const now = new Date().toISOString();
    const persona: InvestmentPersona = {
      id: `persona_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      description,
      criteria: {
        preferredStages: criteria.preferredStages || [],
        preferredSignals: criteria.preferredSignals || [],
        industryFocus: criteria.industryFocus || [],
        seniorityPreference: criteria.seniorityPreference || [],
        regionFocus: criteria.regionFocus || [],
        customCriteria: criteria.customCriteria || '',
      },
      bulkActionSettings: {
        autoSourceLimit: bulkSettings?.autoSourceLimit ?? 20,
        confidenceThreshold: bulkSettings?.confidenceThreshold ?? 0.5,
        defaultAction: bulkSettings?.defaultAction ?? 'stage_only',
        createListsAutomatically: bulkSettings?.createListsAutomatically ?? true,
      },
      createdAt: now,
      updatedAt: now,
    };

    this.state.personas.push(persona);
    
    // Initialize isolated memory for this persona
    this.state.personaMemory[persona.id] = this.getDefaultPersonaMemoryState(persona.id);
    
    // If this is the first persona, make it active
    if (this.state.personas.length === 1) {
      this.state.activePersonaId = persona.id;
    }

    this.save();
    logger.info('AgentMemory', 'Created persona with isolated memory', { id: persona.id, name: persona.name });
    return persona;
  }

  /**
   * Update an existing persona
   */
  updatePersona(
    id: string,
    updates: Partial<Omit<InvestmentPersona, 'id' | 'createdAt'>>
  ): InvestmentPersona | null {
    const persona = this.state.personas.find(p => p.id === id);
    if (!persona) {
      logger.warn('AgentMemory', 'Persona not found for update', { id });
      return null;
    }

    if (updates.name !== undefined) persona.name = updates.name;
    if (updates.description !== undefined) persona.description = updates.description;
    if (updates.criteria) {
      persona.criteria = { ...persona.criteria, ...updates.criteria };
    }
    if (updates.bulkActionSettings) {
      persona.bulkActionSettings = { ...persona.bulkActionSettings, ...updates.bulkActionSettings };
    }
    persona.updatedAt = new Date().toISOString();

    this.save();
    logger.info('AgentMemory', 'Updated persona', { id, name: persona.name });
    return persona;
  }

  /**
   * Delete a persona and its isolated memory
   */
  deletePersona(id: string): boolean {
    const index = this.state.personas.findIndex(p => p.id === id);
    if (index === -1) {
      logger.warn('AgentMemory', 'Persona not found for deletion', { id });
      return false;
    }

    this.state.personas.splice(index, 1);
    
    // Delete the persona's isolated memory
    delete this.state.personaMemory[id];
    
    // If deleted persona was active, clear or set to first available
    if (this.state.activePersonaId === id) {
      this.state.activePersonaId = this.state.personas.length > 0 
        ? this.state.personas[0].id 
        : null;
    }

    this.save();
    logger.info('AgentMemory', 'Deleted persona and its memory', { id });
    return true;
  }

  /**
   * Set the active persona
   */
  setActivePersona(id: string | null): boolean {
    if (id === null) {
      this.state.activePersonaId = null;
      this.save();
      logger.info('AgentMemory', 'Cleared active persona');
      return true;
    }

    const persona = this.state.personas.find(p => p.id === id);
    if (!persona) {
      logger.warn('AgentMemory', 'Persona not found', { id });
      return false;
    }

    this.state.activePersonaId = id;
    this.save();
    logger.info('AgentMemory', 'Set active persona', { id, name: persona.name });
    return true;
  }

  /**
   * Get the currently active persona
   */
  getActivePersona(): InvestmentPersona | null {
    if (!this.state.activePersonaId) return null;
    return this.state.personas.find(p => p.id === this.state.activePersonaId) || null;
  }

  /**
   * Get all personas
   */
  getPersonas(): InvestmentPersona[] {
    return [...this.state.personas];
  }

  /**
   * Initialize default personas if none exist
   */
  initializeDefaultPersonas(): void {
    if (this.state.personas.length > 0) return;

    for (const template of DEFAULT_PERSONAS) {
      this.createPersona(
        template.name,
        template.description,
        template.criteria,
        template.bulkActionSettings
      );
    }
    logger.info('AgentMemory', 'Initialized default personas', { count: DEFAULT_PERSONAS.length });
  }

  /**
   * Build persona-specific context for AI prompts
   */
  buildPersonaContext(): string {
    const persona = this.getActivePersona();
    if (!persona) {
      return 'No investment persona active. Provide general recommendations.';
    }

    const parts: string[] = [
      `ACTIVE INVESTMENT PERSONA: "${persona.name}"`,
      `THESIS: ${persona.description}`,
      '',
      'EVALUATION CRITERIA:',
    ];

    if (persona.criteria.preferredStages.length > 0) {
      parts.push(`- Target Stages: ${persona.criteria.preferredStages.join(', ')}`);
    }
    if (persona.criteria.preferredSignals.length > 0) {
      parts.push(`- Signal Types: ${persona.criteria.preferredSignals.join(', ')}`);
    }
    if (persona.criteria.industryFocus.length > 0) {
      parts.push(`- Industries: ${persona.criteria.industryFocus.join(', ')}`);
    }
    if (persona.criteria.seniorityPreference.length > 0) {
      parts.push(`- Seniority: ${persona.criteria.seniorityPreference.join(', ')}`);
    }
    if (persona.criteria.regionFocus.length > 0) {
      parts.push(`- Regions: ${persona.criteria.regionFocus.join(', ')}`);
    }
    if (persona.criteria.customCriteria) {
      parts.push(`- Custom: ${persona.criteria.customCriteria}`);
    }

    parts.push('');
    parts.push('When evaluating signals, prioritize matches to this persona\'s criteria.');
    parts.push('Explain recommendations in terms of how they fit this specific thesis.');

    return parts.join('\n');
  }

  /**
   * Score an entity against the active persona's criteria
   * Returns 0-1 score indicating match quality
   */
  scoreEntityForPersona(features: EntityFeatures): { score: number; reasons: string[] } {
    const persona = this.getActivePersona();
    if (!persona) {
      return { score: 0.5, reasons: ['No persona active'] };
    }

    let score = 0;
    let maxScore = 0;
    const reasons: string[] = [];

    // Check funding stage match
    if (persona.criteria.preferredStages.length > 0) {
      maxScore += 1;
      if (features.fundingStage && persona.criteria.preferredStages.includes(features.fundingStage.toLowerCase())) {
        score += 1;
        reasons.push(`✓ Stage match: ${features.fundingStage}`);
      }
    }

    // Check signal type match
    if (persona.criteria.preferredSignals.length > 0) {
      maxScore += 1;
      if (features.signalType && persona.criteria.preferredSignals.includes(features.signalType.toLowerCase())) {
        score += 1;
        reasons.push(`✓ Signal match: ${features.signalType}`);
      }
    }

    // Check industry match
    if (persona.criteria.industryFocus.length > 0) {
      maxScore += 1;
      if (features.industry && persona.criteria.industryFocus.some(i => 
        features.industry!.toLowerCase().includes(i.toLowerCase())
      )) {
        score += 1;
        reasons.push(`✓ Industry match: ${features.industry}`);
      }
    }

    // Check seniority match
    if (persona.criteria.seniorityPreference.length > 0) {
      maxScore += 1;
      if (features.seniority && persona.criteria.seniorityPreference.some(s => 
        features.seniority!.toLowerCase().includes(s.toLowerCase())
      )) {
        score += 1;
        reasons.push(`✓ Seniority match: ${features.seniority}`);
      }
    }

    // Check region match
    if (persona.criteria.regionFocus.length > 0) {
      maxScore += 1;
      if (features.region && persona.criteria.regionFocus.some(r => 
        features.region!.toLowerCase().includes(r.toLowerCase())
      )) {
        score += 1;
        reasons.push(`✓ Region match: ${features.region}`);
      }
    }

    // Calculate final score
    const finalScore = maxScore > 0 ? score / maxScore : 0.5;
    
    // Don't add fallback message - return empty reasons array instead

    return { score: finalScore, reasons };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const agentMemory = new AgentMemory();

export function getAgentMemory(): AgentMemory {
  return agentMemory;
}

