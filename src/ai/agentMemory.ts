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
}

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
  // Short-term: Current conversation
  conversationHistory: ConversationTurn[];
  currentEntityId?: string;
  
  // Medium-term: Session interactions
  sessionInteractions: MemoryEntry[];
  toolCallsThisSession: number;
  
  // Long-term: Persistent preferences
  learnedPreferences: UserPreference[];
  likedEntities: { id: string; name: string; type: 'person' | 'company' | 'signal'; reason?: string; timestamp: string; features?: EntityFeatures }[];
  dislikedEntities: { id: string; name: string; type: 'person' | 'company' | 'signal'; reason?: string; timestamp: string; features?: EntityFeatures }[];
  savedEntities: { id: string; name: string; type: 'person' | 'company' | 'signal'; reason?: string; timestamp: string; features?: EntityFeatures }[];
  frequentSearches: { query: string; count: number }[];
  
  // Reward history for RL training
  rewardHistory: RewardEvent[];
  totalReward: number;
  
  // Stats
  totalInteractions: number;
  totalConversations: number;
  lastActiveAt: string;
}

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEY = '@specter_agent_memory_v3';
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

  private getDefaultState(): AgentMemoryState {
    return {
      conversationHistory: [],
      sessionInteractions: [],
      toolCallsThisSession: 0,
      learnedPreferences: [],
      likedEntities: [],
      dislikedEntities: [],
      savedEntities: [],
      frequentSearches: [],
      rewardHistory: [],
      totalReward: 0,
      totalInteractions: 0,
      totalConversations: 0,
      lastActiveAt: new Date().toISOString(),
    };
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  async load(): Promise<void> {
    if (this.isLoaded) return;

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.state = { ...this.getDefaultState(), ...parsed };
        logger.info('AgentMemory', 'Loaded memory', {
          preferences: this.state.learnedPreferences.length,
          liked: this.state.likedEntities.length,
          interactions: this.state.totalInteractions,
        });
      }
      this.isLoaded = true;
    } catch (error) {
      logger.error('AgentMemory', 'Failed to load memory', error);
      this.state = this.getDefaultState();
      this.isLoaded = true;
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
    const fullTurn: ConversationTurn = {
      ...turn,
      timestamp: new Date().toISOString(),
    };

    this.state.conversationHistory.push(fullTurn);
    
    // Trim if too long
    if (this.state.conversationHistory.length > MAX_CONVERSATION_HISTORY) {
      this.state.conversationHistory = this.state.conversationHistory.slice(-MAX_CONVERSATION_HISTORY);
    }

    this.state.totalConversations++;
    this.state.lastActiveAt = new Date().toISOString();
    this.save();
  }

  getConversationHistory(): ConversationTurn[] {
    return this.state.conversationHistory;
  }

  getRecentConversationForContext(maxTurns = 10): string {
    const recent = this.state.conversationHistory.slice(-maxTurns);
    if (recent.length === 0) return '';

    return recent.map(turn => {
      if (turn.role === 'tool') {
        return `[Tool: ${turn.toolName}] ${turn.content.slice(0, 200)}...`;
      }
      return `${turn.role.toUpperCase()}: ${turn.content}`;
    }).join('\n');
  }

  clearConversation(): void {
    this.state.conversationHistory = [];
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

    this.state.sessionInteractions.push(entry);
    
    // Trim if too long
    if (this.state.sessionInteractions.length > MAX_SESSION_INTERACTIONS) {
      // Keep high-importance entries
      this.state.sessionInteractions.sort((a, b) => 
        b.metadata.importance - a.metadata.importance
      );
      this.state.sessionInteractions = this.state.sessionInteractions.slice(0, MAX_SESSION_INTERACTIONS);
    }

    this.state.totalInteractions++;
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
    const entityType = entity.type || 'person';
    const features = entity.features || {};
    const reward = REWARD_SIGNALS.LIKE;
    
    // Remove from dislikes if present
    this.state.dislikedEntities = this.state.dislikedEntities.filter(e => e.id !== entity.id);
    
    // Add to likes
    const existing = this.state.likedEntities.find(e => e.id === entity.id);
    if (!existing) {
      this.state.likedEntities.unshift({ 
        id: entity.id, 
        name: entity.name, 
        type: entityType,
        reason, 
        timestamp: new Date().toISOString(),
        features,
      });
      
      // Trim if too long
      if (this.state.likedEntities.length > MAX_LIKED_ENTITIES) {
        this.state.likedEntities = this.state.likedEntities.slice(0, MAX_LIKED_ENTITIES);
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
    const entityType = entity.type || 'person';
    const features = entity.features || {};
    const reward = REWARD_SIGNALS.DISLIKE;
    
    // Remove from likes if present
    this.state.likedEntities = this.state.likedEntities.filter(e => e.id !== entity.id);
    
    // Add to dislikes
    const existing = this.state.dislikedEntities.find(e => e.id === entity.id);
    if (!existing) {
      this.state.dislikedEntities.unshift({ 
        id: entity.id, 
        name: entity.name, 
        type: entityType,
        reason, 
        timestamp: new Date().toISOString(),
        features,
      });
      
      // Trim
      if (this.state.dislikedEntities.length > MAX_LIKED_ENTITIES) {
        this.state.dislikedEntities = this.state.dislikedEntities.slice(0, MAX_LIKED_ENTITIES);
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
    const entityType = entity.type || 'person';
    const features = entity.features || {};
    const reward = REWARD_SIGNALS.SAVE;
    
    // Add to saved entities
    const existing = this.state.savedEntities.find(e => e.id === entity.id);
    if (!existing) {
      this.state.savedEntities.unshift({
        id: entity.id,
        name: entity.name,
        type: entityType,
        reason,
        timestamp: new Date().toISOString(),
        features,
      });
      
      // Trim
      if (this.state.savedEntities.length > MAX_SAVED_ENTITIES) {
        this.state.savedEntities = this.state.savedEntities.slice(0, MAX_SAVED_ENTITIES);
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
    const fullEvent: RewardEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    this.state.rewardHistory.unshift(fullEvent);
    this.state.totalReward += event.reward;

    // Trim if too long
    if (this.state.rewardHistory.length > MAX_REWARD_HISTORY) {
      this.state.rewardHistory = this.state.rewardHistory.slice(0, MAX_REWARD_HISTORY);
    }

    logger.info('AgentMemory', `Reward recorded: ${event.action} = ${event.reward}`, {
      entityId: event.entityId,
      totalReward: this.state.totalReward,
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
  }

  // Legacy methods for backwards compatibility
  learnFromLike(entity: { industry?: string; seniority?: string; region?: string; highlights?: string[] }): void {
    this.learnFromFeatures(entity, true);
  }

  learnFromDislike(entity: { industry?: string; seniority?: string; region?: string; highlights?: string[] }): void {
    this.learnFromFeatures(entity, false);
  }

  recordSearch(query: string): void {
    const existing = this.state.frequentSearches.find(
      s => s.query.toLowerCase() === query.toLowerCase()
    );
    
    if (existing) {
      existing.count++;
    } else {
      this.state.frequentSearches.unshift({ query, count: 1 });
    }

    // Sort by frequency and trim
    this.state.frequentSearches.sort((a, b) => b.count - a.count);
    this.state.frequentSearches = this.state.frequentSearches.slice(0, MAX_FREQUENT_SEARCHES);

    this.recordInteraction('interaction', `Searched: ${query}`, {
      action: 'search',
      importance: 0.6,
    });

    this.save();
  }

  learnPreference(category: string, value: string, example: string, isPositive: boolean = true, weight: number = 1.0): void {
    const existing = this.state.learnedPreferences.find(
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
      this.state.learnedPreferences.push({
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
  // CONTEXT BUILDING
  // ============================================

  /**
   * Build a comprehensive context string for the AI
   * This is the MAIN method for injecting memory into prompts
   */
  buildFullContext(): string {
    const parts: string[] = [];

    // User preferences summary (includes both positive and negative)
    const prefSummary = this.buildPreferenceSummary();
    if (prefSummary) {
      parts.push(`USER PREFERENCES:\n${prefSummary}`);
    }

    // Recent likes for comparison context (with features)
    if (this.state.likedEntities.length > 0) {
      const recentLikes = this.state.likedEntities.slice(0, 5);
      const likeLines = recentLikes.map(e => {
        const features = [];
        if (e.features?.industry) features.push(e.features.industry);
        if (e.features?.seniority) features.push(e.features.seniority);
        if (e.features?.region) features.push(e.features.region);
        const featureStr = features.length > 0 ? ` (${features.join(', ')})` : '';
        return `- ${e.name}${featureStr}${e.reason ? `: ${e.reason}` : ''}`;
      });
      parts.push(`RECENTLY LIKED (${this.state.likedEntities.length} total):\n${likeLines.join('\n')}`);
    }

    // Recent dislikes (important for knowing what to avoid)
    if (this.state.dislikedEntities.length > 0) {
      const recentDislikes = this.state.dislikedEntities.slice(0, 3);
      const dislikeLines = recentDislikes.map(e => {
        const features = [];
        if (e.features?.industry) features.push(e.features.industry);
        if (e.features?.seniority) features.push(e.features.seniority);
        return `- ${e.name}${features.length > 0 ? ` (${features.join(', ')})` : ''}`;
      });
      parts.push(`RECENTLY DISLIKED (avoid similar):\n${dislikeLines.join('\n')}`);
    }

    // Saved entities (high intent)
    if (this.state.savedEntities && this.state.savedEntities.length > 0) {
      const recentSaved = this.state.savedEntities.slice(0, 3);
      parts.push(`SAVED (high intent):\n${recentSaved.map(e => `- ${e.name}`).join('\n')}`);
    }

    // Frequent searches show intent
    if (this.state.frequentSearches.length > 0) {
      const topSearches = this.state.frequentSearches.slice(0, 3);
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
    const parts: string[] = [
      'You are a deal-sourcing AI agent for a venture capital investor.',
      'Be concise, direct, and highlight the most important information.',
      'Personalize your responses based on the user\'s demonstrated preferences.',
    ];

    // Add preference context
    const prefSummary = this.buildPreferenceSummary();
    if (prefSummary) {
      parts.push(`\nUser preferences learned from ${this.state.likedEntities.length + this.state.dislikedEntities.length} interactions:\n${prefSummary}`);
    }

    // Add context about what to emphasize
    const positivePrefs = this.state.learnedPreferences
      .filter(p => p.confidence - p.negativeConfidence > 0.3)
      .slice(0, 5);
    
    if (positivePrefs.length > 0) {
      const emphasisPoints = positivePrefs.map(p => `${p.category}: ${p.value}`).join(', ');
      parts.push(`\nEmphasize matches with: ${emphasisPoints}`);
    }

    // Add context about what to de-emphasize
    const negativePrefs = this.state.learnedPreferences
      .filter(p => p.negativeConfidence - p.confidence > 0.3)
      .slice(0, 3);
    
    if (negativePrefs.length > 0) {
      const avoidPoints = negativePrefs.map(p => `${p.category}: ${p.value}`).join(', ');
      parts.push(`\nBe cautious about: ${avoidPoints}`);
    }

    return parts.join(' ');
  }

  buildPreferenceSummary(): string {
    if (this.state.learnedPreferences.length === 0) {
      return '';
    }

    // Group by category, separating positive and negative
    const positiveByCategory: Record<string, string[]> = {};
    const negativeByCategory: Record<string, string[]> = {};
    
    for (const pref of this.state.learnedPreferences) {
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
    return this.state.likedEntities.map(e => e.id);
  }

  /**
   * Check if an entity was liked
   */
  isLiked(entityId: string): boolean {
    return this.state.likedEntities.some(e => e.id === entityId);
  }

  /**
   * Check if an entity was disliked
   */
  isDisliked(entityId: string): boolean {
    return this.state.dislikedEntities.some(e => e.id === entityId);
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
  } {
    return {
      totalInteractions: this.state.totalInteractions,
      totalConversations: this.state.totalConversations,
      likedCount: this.state.likedEntities.length,
      dislikedCount: this.state.dislikedEntities.length,
      savedCount: this.state.savedEntities?.length || 0,
      preferencesLearned: this.state.learnedPreferences.length,
      toolCallsThisSession: this.state.toolCallsThisSession,
      totalReward: this.state.totalReward || 0,
      rewardEventCount: this.state.rewardHistory?.length || 0,
    };
  }

  // Get reward history for RL training export
  getRewardHistory(): RewardEvent[] {
    return [...this.state.rewardHistory];
  }

  // Get liked entity IDs
  getLikedEntities(): typeof this.state.likedEntities {
    return [...this.state.likedEntities];
  }

  // Get disliked entity IDs
  getDislikedEntities(): typeof this.state.dislikedEntities {
    return [...this.state.dislikedEntities];
  }

  // Get saved entity IDs
  getSavedEntities(): typeof this.state.savedEntities {
    return [...(this.state.savedEntities || [])];
  }

  // Get learned preferences
  getLearnedPreferences(): UserPreference[] {
    return [...this.state.learnedPreferences];
  }

  async clearAll(): Promise<void> {
    this.state = this.getDefaultState();
    await AsyncStorage.removeItem(STORAGE_KEY);
    logger.info('AgentMemory', 'Memory cleared');
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const agentMemory = new AgentMemory();

export function getAgentMemory(): AgentMemory {
  return agentMemory;
}

