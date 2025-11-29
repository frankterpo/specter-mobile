/**
 * AgentCore - Pure backend agent logic
 * No UI dependencies - just JSON in, JSON out
 * 
 * Test via: npx ts-node src/ai/AgentCore.test.ts
 */

import { getAgentMemory, type EntityFeatures, type RewardEvent } from './agentMemory';
import { ANALYSIS_TOOLS, executeAnalysisTool } from './analysisTools';
import { getCactusClient, type Message, type Tool } from './cactusClient';
import { 
  fetchSavedSearches,
  fetchPeopleSavedSearchResults,
  fetchCompanySavedSearchResults,
  fetchTalentSignals,
  fetchInvestorInterestSignals,
  fetchPersonDetail,
  fetchCompanyDetail,
  likePerson,
  dislikePerson,
  type Person,
  type Company,
  type TalentSignal,
  type SavedSearch,
} from '../api/specter';
import { logger } from '../utils/logger';

// ============================================
// TYPES - Pure JSON interfaces
// ============================================

export interface AgentInput {
  type: 'text' | 'voice' | 'action';
  content: string;
  context?: {
    entityId?: string;
    entityType?: 'person' | 'company' | 'signal';
    searchId?: number;
  };
}

export interface AgentOutput {
  type: 'response' | 'action' | 'suggestion' | 'error';
  content: string;
  data?: any;
  actions?: AgentAction[];
  reasoning?: string[];
  toolsUsed?: string[];
  timeMs?: number;
}

export interface AgentAction {
  type: 'like' | 'dislike' | 'save' | 'bulk_like' | 'bulk_dislike' | 'search' | 'navigate';
  entityIds?: string[];
  params?: Record<string, any>;
  confidence: number;
  reason: string;
}

export interface AgentState {
  isReady: boolean;
  modelLoaded: boolean;
  memoryLoaded: boolean;
  activePersonaId: string | null;
  stats: {
    likes: number;
    dislikes: number;
    preferences: number;
    totalReward: number;
  };
}

// ============================================
// CORE AGENT CLASS
// ============================================

export class AgentCore {
  private static instance: AgentCore | null = null;
  private token: string | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): AgentCore {
    if (!AgentCore.instance) {
      AgentCore.instance = new AgentCore();
    }
    return AgentCore.instance;
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  async init(token: string): Promise<AgentState> {
    this.token = token;
    
    // Load memory
    const memory = getAgentMemory();
    await memory.load();
    
    // Initialize default personas if needed
    memory.initializeDefaultPersonas();
    
    this.isInitialized = true;
    
    return this.getState();
  }

  async warmUp(): Promise<void> {
    const client = getCactusClient();
    await client.download();
    await client.init();
  }

  getState(): AgentState {
    const memory = getAgentMemory();
    const stats = memory.getStats();
    
    return {
      isReady: this.isInitialized,
      modelLoaded: getCactusClient().getState().isReady,
      memoryLoaded: true,
      activePersonaId: stats.activePersonaId,
      stats: {
        likes: stats.likedCount,
        dislikes: stats.dislikedCount,
        preferences: stats.preferencesLearned,
        totalReward: stats.totalReward,
      },
    };
  }

  // ============================================
  // CORE AGENT LOOP - ReAct Pattern
  // ============================================

  async process(input: AgentInput): Promise<AgentOutput> {
    if (!this.token) {
      return { type: 'error', content: 'Agent not initialized. Call init() first.' };
    }

    const startTime = Date.now();
    const memory = getAgentMemory();
    const reasoning: string[] = [];
    const toolsUsed: string[] = [];

    try {
      // Step 1: Understand intent
      reasoning.push(`Input: "${input.content}" (type: ${input.type})`);
      
      // Step 2: Build context
      const context = this.buildContext(input);
      reasoning.push(`Context built: ${context.length} chars`);

      // Step 3: Determine if we need tools or can answer directly
      const needsTools = this.shouldUseTool(input);
      reasoning.push(`Needs tools: ${needsTools}`);

      if (!needsTools) {
        // Fast path: Memory-only response
        return this.handleMemoryQuery(input, startTime, reasoning);
      }

      // Step 4: Execute with tools (ReAct loop)
      const result = await this.executeWithTools(input, context, reasoning, toolsUsed);
      
      return {
        ...result,
        timeMs: Date.now() - startTime,
        reasoning,
        toolsUsed,
      };

    } catch (error: any) {
      logger.error('AgentCore', 'Process failed', error);
      return {
        type: 'error',
        content: error.message || 'Agent processing failed',
        timeMs: Date.now() - startTime,
        reasoning,
      };
    }
  }

  // ============================================
  // INTENT DETECTION
  // ============================================

  private shouldUseTool(input: AgentInput): boolean {
    const content = input.content.toLowerCase();
    
    // Memory-only queries (fast path)
    const memoryOnlyPatterns = [
      /^(show|list|get) (my )?(likes|dislikes|preferences|stats)/,
      /^what (do i|have i) (like|prefer)/,
      /^(my|show) memory/,
      /^stats/,
    ];
    
    for (const pattern of memoryOnlyPatterns) {
      if (pattern.test(content)) return false;
    }
    
    // Tool-required queries
    const toolPatterns = [
      /search|find|look up|lookup/,
      /who is|tell me about/,
      /compare|versus|vs/,
      /funding|raised|investors/,
      /analyze|analysis/,
      /source|auto-source|bulk/,
    ];
    
    for (const pattern of toolPatterns) {
      if (pattern.test(content)) return true;
    }
    
    // Default: use tools for complex queries
    return input.content.length > 50;
  }

  // ============================================
  // MEMORY-ONLY RESPONSES (FAST PATH)
  // ============================================

  private handleMemoryQuery(input: AgentInput, startTime: number, reasoning: string[]): AgentOutput {
    const memory = getAgentMemory();
    const content = input.content.toLowerCase();
    
    if (content.includes('likes') || content.includes('liked')) {
      const liked = memory.getLikedEntities().slice(0, 10);
      reasoning.push(`Retrieved ${liked.length} liked entities from memory`);
      
      return {
        type: 'response',
        content: `You have ${liked.length} liked entities:\n${liked.map((e, i) => 
          `${i + 1}. ${e.name} (${e.type})`
        ).join('\n')}`,
        data: { liked },
        timeMs: Date.now() - startTime,
        reasoning,
      };
    }
    
    if (content.includes('dislikes') || content.includes('disliked')) {
      const disliked = memory.getDislikedEntities().slice(0, 10);
      reasoning.push(`Retrieved ${disliked.length} disliked entities from memory`);
      
      return {
        type: 'response',
        content: `You have ${disliked.length} disliked entities:\n${disliked.map((e, i) => 
          `${i + 1}. ${e.name} (${e.type})`
        ).join('\n')}`,
        data: { disliked },
        timeMs: Date.now() - startTime,
        reasoning,
      };
    }
    
    if (content.includes('preference') || content.includes('prefer')) {
      const prefs = memory.getLearnedPreferences()
        .filter(p => p.confidence > 0.3)
        .slice(0, 10);
      reasoning.push(`Retrieved ${prefs.length} preferences from memory`);
      
      return {
        type: 'response',
        content: `Your learned preferences:\n${prefs.map(p => 
          `• ${p.category}: ${p.value} (${Math.round(p.confidence * 100)}% confident)`
        ).join('\n')}`,
        data: { preferences: prefs },
        timeMs: Date.now() - startTime,
        reasoning,
      };
    }
    
    if (content.includes('stats') || content.includes('memory')) {
      const stats = memory.getStats();
      reasoning.push('Retrieved stats from memory');
      
      return {
        type: 'response',
        content: `Agent Stats:
• Likes: ${stats.likedCount}
• Dislikes: ${stats.dislikedCount}
• Preferences learned: ${stats.preferencesLearned}
• Total interactions: ${stats.totalInteractions}
• Total reward: ${stats.totalReward.toFixed(1)}
• Active persona: ${stats.activePersonaId || 'Global'}`,
        data: { stats },
        timeMs: Date.now() - startTime,
        reasoning,
      };
    }
    
    return {
      type: 'response',
      content: 'I can help you with your likes, dislikes, preferences, or stats. What would you like to know?',
      timeMs: Date.now() - startTime,
      reasoning,
    };
  }

  // ============================================
  // TOOL EXECUTION (ReAct LOOP)
  // ============================================

  private async executeWithTools(
    input: AgentInput,
    context: string,
    reasoning: string[],
    toolsUsed: string[]
  ): Promise<AgentOutput> {
    const memory = getAgentMemory();
    const content = input.content.toLowerCase();
    
    // Direct action handlers (no LLM needed)
    if (content.includes('search') || content.includes('find')) {
      return this.handleSearch(input, reasoning, toolsUsed);
    }
    
    if (content.includes('analyze') && input.context?.entityId) {
      return this.handleAnalysis(input, reasoning, toolsUsed);
    }
    
    if (content.includes('source') || content.includes('bulk')) {
      return this.handleBulkSource(input, reasoning, toolsUsed);
    }
    
    if (content.includes('score') || content.includes('rank')) {
      return this.handleScoring(input, reasoning, toolsUsed);
    }
    
    // Fall back to LLM for complex queries
    return this.handleLLMQuery(input, context, reasoning, toolsUsed);
  }

  // ============================================
  // DIRECT HANDLERS (No LLM - Fast)
  // ============================================

  private async handleSearch(
    input: AgentInput,
    reasoning: string[],
    toolsUsed: string[]
  ): Promise<AgentOutput> {
    const memory = getAgentMemory();
    toolsUsed.push('search');
    
    // Get saved searches
    const searches = await fetchSavedSearches(this.token!);
    reasoning.push(`Found ${searches.length} saved searches`);
    
    // Find matching search by name
    const query = input.content.toLowerCase();
    const matchingSearch = searches.find(s => 
      query.includes(s.name.toLowerCase()) ||
      query.includes(s.product_type)
    );
    
    if (matchingSearch) {
      reasoning.push(`Matched search: ${matchingSearch.name}`);
      
      // Fetch results based on type
      let results: any[] = [];
      switch (matchingSearch.product_type) {
        case 'people':
          const peopleRes = await fetchPeopleSavedSearchResults(this.token!, matchingSearch.id, { limit: 20 });
          results = peopleRes.items;
          break;
        case 'company':
          const companyRes = await fetchCompanySavedSearchResults(this.token!, matchingSearch.id, { limit: 20 });
          results = companyRes.items;
          break;
        case 'talent':
          const talentRes = await fetchTalentSignals(this.token!, matchingSearch.id, { limit: 20 });
          results = talentRes.items;
          break;
      }
      
      // Score results against preferences
      const scored = results.map(item => {
        const features = this.extractFeatures(item, matchingSearch.product_type);
        const { score, reasons } = memory.calculateMatchScore(features);
        return { item, score, reasons };
      }).sort((a, b) => b.score - a.score);
      
      reasoning.push(`Scored ${scored.length} results`);
      
      return {
        type: 'response',
        content: `Found ${scored.length} results from "${matchingSearch.name}":\n\n${
          scored.slice(0, 10).map((s, i) => 
            `${i + 1}. ${this.getEntityName(s.item)} (${s.score}% match)${s.reasons.length ? `\n   ${s.reasons[0]}` : ''}`
          ).join('\n')
        }`,
        data: { 
          search: matchingSearch,
          results: scored.slice(0, 20),
        },
        reasoning,
        toolsUsed,
      };
    }
    
    // No matching search - return available searches
    return {
      type: 'response',
      content: `Available saved searches:\n${searches.map((s, i) => 
        `${i + 1}. ${s.name} (${s.product_type}) - ${s.full_count} results`
      ).join('\n')}`,
      data: { searches },
      reasoning,
      toolsUsed,
    };
  }

  private async handleAnalysis(
    input: AgentInput,
    reasoning: string[],
    toolsUsed: string[]
  ): Promise<AgentOutput> {
    const entityId = input.context?.entityId;
    const entityType = input.context?.entityType || 'person';
    
    if (!entityId) {
      return { type: 'error', content: 'No entity ID provided for analysis' };
    }
    
    toolsUsed.push('analyze');
    reasoning.push(`Analyzing ${entityType}: ${entityId}`);
    
    // Fetch entity details
    let entity: any;
    if (entityType === 'person') {
      entity = await fetchPersonDetail(this.token!, entityId);
      toolsUsed.push('fetch_person');
    } else if (entityType === 'company') {
      entity = await fetchCompanyDetail(this.token!, entityId);
      toolsUsed.push('fetch_company');
    }
    
    if (!entity) {
      return { type: 'error', content: `${entityType} not found: ${entityId}` };
    }
    
    // Score against preferences
    const memory = getAgentMemory();
    const features = this.extractFeatures(entity, entityType);
    const { score, reasons, warnings } = memory.calculateMatchScore(features);
    
    reasoning.push(`Match score: ${score}%`);
    
    // Build analysis
    const analysis = {
      entity,
      score,
      reasons,
      warnings,
      recommendation: score >= 70 ? 'STRONG_MATCH' : score >= 50 ? 'POTENTIAL' : 'LOW_MATCH',
    };
    
    return {
      type: 'response',
      content: `Analysis of ${this.getEntityName(entity)}:

Match Score: ${score}%
Recommendation: ${analysis.recommendation}

${reasons.length ? `Strengths:\n${reasons.map(r => `• ${r}`).join('\n')}` : ''}

${warnings.length ? `Concerns:\n${warnings.map(w => `• ${w}`).join('\n')}` : ''}`,
      data: analysis,
      actions: score >= 60 ? [{
        type: 'like',
        entityIds: [entityId],
        confidence: score / 100,
        reason: reasons[0] || 'Good match',
      }] : undefined,
      reasoning,
      toolsUsed,
    };
  }

  private async handleBulkSource(
    input: AgentInput,
    reasoning: string[],
    toolsUsed: string[]
  ): Promise<AgentOutput> {
    const searchId = input.context?.searchId;
    
    if (!searchId) {
      // Get first available search
      const searches = await fetchSavedSearches(this.token!);
      const peopleSearch = searches.find(s => s.product_type === 'people' || s.product_type === 'talent');
      
      if (!peopleSearch) {
        return { type: 'error', content: 'No saved searches found for sourcing' };
      }
      
      input.context = { ...input.context, searchId: peopleSearch.id };
      reasoning.push(`Using search: ${peopleSearch.name}`);
    }
    
    toolsUsed.push('bulk_source');
    
    // Fetch signals
    const results = await fetchPeopleSavedSearchResults(this.token!, input.context!.searchId!, { limit: 50 });
    reasoning.push(`Fetched ${results.items.length} signals`);
    
    // Score all
    const memory = getAgentMemory();
    const scored = results.items.map(person => {
      const features = this.extractFeatures(person, 'person');
      const { score, reasons } = memory.calculateMatchScore(features);
      return { person, score, reasons };
    }).sort((a, b) => b.score - a.score);
    
    // Filter by threshold (60%)
    const qualified = scored.filter(s => s.score >= 60);
    const highMatch = scored.filter(s => s.score >= 80);
    
    reasoning.push(`Qualified: ${qualified.length}, High match: ${highMatch.length}`);
    
    // Build suggested actions
    const actions: AgentAction[] = [];
    if (highMatch.length > 0) {
      actions.push({
        type: 'bulk_like',
        entityIds: highMatch.map(s => s.person.id),
        confidence: 0.9,
        reason: `${highMatch.length} high-confidence matches (80%+)`,
      });
    }
    
    return {
      type: 'suggestion',
      content: `Sourcing Report:

Total signals: ${results.items.length}
Qualified (60%+): ${qualified.length}
High match (80%+): ${highMatch.length}

Top 5 matches:
${qualified.slice(0, 5).map((s, i) => 
  `${i + 1}. ${s.person.full_name || s.person.first_name} - ${s.score}%`
).join('\n')}

${highMatch.length > 0 ? `\n⚡ Ready to bulk-like ${highMatch.length} high-confidence matches` : ''}`,
      data: {
        total: results.items.length,
        qualified: qualified.length,
        highMatch: highMatch.length,
        topMatches: qualified.slice(0, 10),
      },
      actions,
      reasoning,
      toolsUsed,
    };
  }

  private async handleScoring(
    input: AgentInput,
    reasoning: string[],
    toolsUsed: string[]
  ): Promise<AgentOutput> {
    const memory = getAgentMemory();
    toolsUsed.push('score');
    
    // Get all saved searches
    const searches = await fetchSavedSearches(this.token!);
    const peopleSearches = searches.filter(s => 
      s.product_type === 'people' || s.product_type === 'talent'
    );
    
    if (peopleSearches.length === 0) {
      return { type: 'error', content: 'No people/talent searches found' };
    }
    
    // Score across all searches
    const allScored: { search: SavedSearch; person: any; score: number }[] = [];
    
    for (const search of peopleSearches.slice(0, 3)) {
      const results = await fetchPeopleSavedSearchResults(this.token!, search.id, { limit: 20 });
      
      for (const person of results.items) {
        const features = this.extractFeatures(person, 'person');
        const { score } = memory.calculateMatchScore(features);
        allScored.push({ search, person, score });
      }
    }
    
    // Sort by score
    allScored.sort((a, b) => b.score - a.score);
    reasoning.push(`Scored ${allScored.length} signals across ${peopleSearches.length} searches`);
    
    // Stats
    const high = allScored.filter(s => s.score >= 80).length;
    const medium = allScored.filter(s => s.score >= 60 && s.score < 80).length;
    const low = allScored.filter(s => s.score < 60).length;
    
    return {
      type: 'response',
      content: `Scoring Report:

Total scored: ${allScored.length}
🟢 High match (80%+): ${high}
🟡 Medium (60-79%): ${medium}
🔴 Low (<60%): ${low}

Top 10 overall:
${allScored.slice(0, 10).map((s, i) => 
  `${i + 1}. ${s.person.full_name || s.person.first_name} - ${s.score}% (${s.search.name})`
).join('\n')}`,
      data: {
        total: allScored.length,
        high,
        medium,
        low,
        topMatches: allScored.slice(0, 20),
      },
      reasoning,
      toolsUsed,
    };
  }

  // ============================================
  // LLM HANDLER (Complex queries)
  // ============================================

  private async handleLLMQuery(
    input: AgentInput,
    context: string,
    reasoning: string[],
    toolsUsed: string[]
  ): Promise<AgentOutput> {
    toolsUsed.push('llm');
    reasoning.push('Using LLM for complex query');
    
    const client = getCactusClient();
    await client.ensureReady();
    
    const messages: Message[] = [
      {
        role: 'system',
        content: `You are a VC deal sourcing AI. Be concise and actionable.

User Context:
${context}

Available actions: search, analyze, like, dislike, source, score
Respond with specific recommendations.`,
      },
      {
        role: 'user',
        content: input.content,
      },
    ];
    
    const result = await client.complete({
      messages,
      options: { maxTokens: 300, temperature: 0.3 },
    });
    
    reasoning.push(`LLM response: ${result.response.length} chars`);
    
    return {
      type: 'response',
      content: result.response,
      reasoning,
      toolsUsed,
    };
  }

  // ============================================
  // ACTIONS - Execute user decisions
  // ============================================

  async executeAction(action: AgentAction): Promise<AgentOutput> {
    if (!this.token) {
      return { type: 'error', content: 'Agent not initialized' };
    }

    const memory = getAgentMemory();
    const startTime = Date.now();
    
    try {
      switch (action.type) {
        case 'like': {
          if (!action.entityIds?.length) {
            return { type: 'error', content: 'No entity IDs provided' };
          }
          
          for (const id of action.entityIds) {
            await likePerson(this.token, id);
            memory.recordLike({ id, name: id, type: 'person' }, action.reason);
          }
          
          return {
            type: 'action',
            content: `Liked ${action.entityIds.length} ${action.entityIds.length === 1 ? 'person' : 'people'}`,
            data: { likedIds: action.entityIds },
            timeMs: Date.now() - startTime,
          };
        }
        
        case 'dislike': {
          if (!action.entityIds?.length) {
            return { type: 'error', content: 'No entity IDs provided' };
          }
          
          for (const id of action.entityIds) {
            await dislikePerson(this.token, id);
            memory.recordDislike({ id, name: id, type: 'person' }, action.reason);
          }
          
          return {
            type: 'action',
            content: `Passed on ${action.entityIds.length} ${action.entityIds.length === 1 ? 'person' : 'people'}`,
            data: { dislikedIds: action.entityIds },
            timeMs: Date.now() - startTime,
          };
        }
        
        case 'bulk_like': {
          if (!action.entityIds?.length) {
            return { type: 'error', content: 'No entity IDs provided' };
          }
          
          let liked = 0;
          for (const id of action.entityIds) {
            try {
              await likePerson(this.token, id);
              memory.recordLike({ id, name: id, type: 'person' }, action.reason);
              liked++;
            } catch (e) {
              logger.warn('AgentCore', `Failed to like ${id}`, e);
            }
          }
          
          return {
            type: 'action',
            content: `Bulk liked ${liked}/${action.entityIds.length} people`,
            data: { liked, total: action.entityIds.length },
            timeMs: Date.now() - startTime,
          };
        }
        
        case 'bulk_dislike': {
          if (!action.entityIds?.length) {
            return { type: 'error', content: 'No entity IDs provided' };
          }
          
          let disliked = 0;
          for (const id of action.entityIds) {
            try {
              await dislikePerson(this.token, id);
              memory.recordDislike({ id, name: id, type: 'person' }, action.reason);
              disliked++;
            } catch (e) {
              logger.warn('AgentCore', `Failed to dislike ${id}`, e);
            }
          }
          
          return {
            type: 'action',
            content: `Bulk passed on ${disliked}/${action.entityIds.length} people`,
            data: { disliked, total: action.entityIds.length },
            timeMs: Date.now() - startTime,
          };
        }
        
        default:
          return { type: 'error', content: `Unknown action type: ${action.type}` };
      }
    } catch (error: any) {
      return {
        type: 'error',
        content: error.message || 'Action failed',
        timeMs: Date.now() - startTime,
      };
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  private buildContext(input: AgentInput): string {
    const memory = getAgentMemory();
    return memory.buildFullContext();
  }

  private extractFeatures(entity: any, type: string): EntityFeatures {
    if (type === 'person' || type === 'talent') {
      const exp = Array.isArray(entity.experience) ? entity.experience : [];
      const currentJob = exp.find((e: any) => e.is_current);
      
      return {
        industry: currentJob?.industry,
        seniority: entity.seniority || entity.level_of_seniority,
        region: entity.region,
        highlights: entity.people_highlights || entity.highlights,
        signalType: entity.signal_type,
        companies: exp.map((e: any) => e.company_name).filter(Boolean),
      };
    }
    
    if (type === 'company') {
      return {
        industry: entity.industries?.[0],
        fundingStage: entity.growth_stage || entity.funding?.last_funding_type,
        region: entity.hq?.region,
      };
    }
    
    return {};
  }

  private getEntityName(entity: any): string {
    return entity.full_name || 
           entity.organization_name || 
           entity.name || 
           `${entity.first_name || ''} ${entity.last_name || ''}`.trim() ||
           'Unknown';
  }
}

// Singleton export
export const getAgentCore = AgentCore.getInstance;

