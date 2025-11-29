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
  };
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
  confidence: number; // 0-1
  examples: string[];
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
  likedEntities: { id: string; name: string; reason?: string }[];
  dislikedEntities: { id: string; name: string; reason?: string }[];
  frequentSearches: { query: string; count: number }[];
  
  // Stats
  totalInteractions: number;
  totalConversations: number;
  lastActiveAt: string;
}

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEY = '@specter_agent_memory_v2';
const MAX_CONVERSATION_HISTORY = 20;
const MAX_SESSION_INTERACTIONS = 50;
const MAX_LIKED_ENTITIES = 100;
const MAX_FREQUENT_SEARCHES = 20;

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
      frequentSearches: [],
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

  recordLike(entity: { id: string; name: string }, reason?: string): void {
    // Remove from dislikes if present
    this.state.dislikedEntities = this.state.dislikedEntities.filter(e => e.id !== entity.id);
    
    // Add to likes
    const existing = this.state.likedEntities.find(e => e.id === entity.id);
    if (!existing) {
      this.state.likedEntities.unshift({ ...entity, reason });
      
      // Trim if too long
      if (this.state.likedEntities.length > MAX_LIKED_ENTITIES) {
        this.state.likedEntities = this.state.likedEntities.slice(0, MAX_LIKED_ENTITIES);
      }
    }

    this.recordInteraction('preference', `Liked ${entity.name}`, {
      entityId: entity.id,
      action: 'like',
      importance: 0.8,
    });

    this.save();
  }

  recordDislike(entity: { id: string; name: string }, reason?: string): void {
    // Remove from likes if present
    this.state.likedEntities = this.state.likedEntities.filter(e => e.id !== entity.id);
    
    // Add to dislikes
    const existing = this.state.dislikedEntities.find(e => e.id === entity.id);
    if (!existing) {
      this.state.dislikedEntities.unshift({ ...entity, reason });
      
      // Trim
      if (this.state.dislikedEntities.length > MAX_LIKED_ENTITIES) {
        this.state.dislikedEntities = this.state.dislikedEntities.slice(0, MAX_LIKED_ENTITIES);
      }
    }

    this.recordInteraction('preference', `Disliked ${entity.name}`, {
      entityId: entity.id,
      action: 'dislike',
      importance: 0.7,
    });

    this.save();
  }

  recordSave(entity: { id: string; name: string; industry?: string; seniority?: string; region?: string; highlights?: string[] }): void {
    // Saving is a high-intent action - record as a strong like
    this.recordLike({ id: entity.id, name: entity.name }, 'Saved to list - high intent');
    
    this.recordInteraction('preference', `Saved ${entity.name} to list`, {
      entityId: entity.id,
      action: 'save',
      importance: 1.0, // Highest importance
    });

    this.save();
  }

  // Learn preferences from a liked entity
  learnFromLike(entity: { industry?: string; seniority?: string; region?: string; highlights?: string[] }): void {
    if (entity.industry) {
      this.learnPreference('industry', entity.industry, `Liked entity in ${entity.industry}`);
    }
    if (entity.seniority) {
      this.learnPreference('seniority', entity.seniority, `Liked ${entity.seniority} level`);
    }
    if (entity.region) {
      this.learnPreference('region', entity.region, `Liked entity in ${entity.region}`);
    }
    if (entity.highlights?.length) {
      entity.highlights.slice(0, 3).forEach(h => {
        this.learnPreference('highlight', h, `Liked entity with ${h}`);
      });
    }
  }

  // Learn from a disliked entity (negative signal)
  learnFromDislike(entity: { industry?: string; seniority?: string; region?: string; highlights?: string[] }): void {
    // For dislikes, we could track negative preferences
    // For now, we just record the interaction - the absence of likes is informative
    this.recordInteraction('preference', `Disliked entity with traits: ${[entity.industry, entity.seniority, entity.region].filter(Boolean).join(', ')}`, {
      action: 'dislike_learn',
      importance: 0.5,
    });
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

  learnPreference(category: string, value: string, example: string): void {
    const existing = this.state.learnedPreferences.find(
      p => p.category === category && p.value === value
    );

    if (existing) {
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      if (!existing.examples.includes(example)) {
        existing.examples.push(example);
        if (existing.examples.length > 5) {
          existing.examples = existing.examples.slice(-5);
        }
      }
      existing.lastUpdated = new Date().toISOString();
    } else {
      this.state.learnedPreferences.push({
        category,
        value,
        confidence: 0.5,
        examples: [example],
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

    // User preferences summary
    const prefSummary = this.buildPreferenceSummary();
    if (prefSummary) {
      parts.push(`USER PREFERENCES:\n${prefSummary}`);
    }

    // Recent likes for comparison context
    if (this.state.likedEntities.length > 0) {
      const recentLikes = this.state.likedEntities.slice(0, 5);
      parts.push(`RECENTLY LIKED (for comparison):\n${recentLikes.map(e => `- ${e.name}${e.reason ? `: ${e.reason}` : ''}`).join('\n')}`);
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

    // Session stats
    parts.push(`SESSION: ${this.state.toolCallsThisSession} tool calls, ${this.state.sessionInteractions.length} interactions`);

    return parts.join('\n\n');
  }

  buildPreferenceSummary(): string {
    if (this.state.learnedPreferences.length === 0) {
      return '';
    }

    // Group by category
    const byCategory: Record<string, UserPreference[]> = {};
    for (const pref of this.state.learnedPreferences) {
      if (pref.confidence >= 0.5) {
        if (!byCategory[pref.category]) {
          byCategory[pref.category] = [];
        }
        byCategory[pref.category].push(pref);
      }
    }

    const lines: string[] = [];
    for (const [category, prefs] of Object.entries(byCategory)) {
      const values = prefs.map(p => p.value).join(', ');
      lines.push(`- ${category}: ${values}`);
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
    preferencesLearned: number;
    toolCallsThisSession: number;
  } {
    return {
      totalInteractions: this.state.totalInteractions,
      totalConversations: this.state.totalConversations,
      likedCount: this.state.likedEntities.length,
      dislikedCount: this.state.dislikedEntities.length,
      preferencesLearned: this.state.learnedPreferences.length,
      toolCallsThisSession: this.state.toolCallsThisSession,
    };
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

