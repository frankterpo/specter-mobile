/**
 * Agentic Tools for Specter AI
 * 
 * Defines tools that the AI can use to query the Specter API,
 * compare founders, search for people, and take actions.
 * 
 * MEMORY-FIRST: All tools leverage AgentMemory for personalization.
 * Uses native Cactus tool calling for optimal performance.
 */

import {
  fetchPeople,
  fetchPersonDetail,
  likePerson,
  dislikePerson,
  fetchSavedSearches,
  fetchPeopleSavedSearchResults,
  fetchLists,
  type Person,
  type SavedSearch,
  type List,
} from '../api/specter';
import { logger } from '../utils/logger';
import { agentMemory, getAgentMemory } from './agentMemory';
import type { Tool } from 'cactus-react-native';

// ============================================
// NATIVE CACTUS TOOL DEFINITIONS
// These use the native Cactus Tool format for optimal performance
// ============================================

/**
 * Native Cactus tools for Specter API
 * These are passed directly to CactusLM.complete() for native function calling
 */
export const SPECTER_NATIVE_TOOLS: Tool[] = [
  {
    name: 'search_people',
    description: 'Search for people/founders by name or keywords. ALWAYS use this when user wants to find specific people, compare with others, or mentions a name.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query - name, company, or keywords',
        },
        limit: {
          type: 'string',
          description: 'Maximum number of results (default 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_person_details',
    description: 'Get detailed information about a specific person by their ID. Use this to get more context about someone.',
    parameters: {
      type: 'object',
      properties: {
        person_id: {
          type: 'string',
          description: 'The Specter person ID',
        },
      },
      required: ['person_id'],
    },
  },
  {
    name: 'get_memory_liked',
    description: 'Get people the user has liked from memory. ALWAYS use this for comparisons or understanding preferences. This is instant - no API call needed.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'string',
          description: 'Maximum number of results (default 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_memory_context',
    description: 'Get the full user context from memory including preferences, recent searches, and interaction history. Use this to personalize responses.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_saved_searches',
    description: 'Get the user\'s saved searches from Specter. Use this to understand what criteria the user is looking for.',
    parameters: {
      type: 'object',
      properties: {
        product_type: {
          type: 'string',
          description: 'Filter by product type: people, company, talent, or investors',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_saved_search_results',
    description: 'Get results from a specific saved search. Use this to find people matching specific criteria.',
    parameters: {
      type: 'object',
      properties: {
        search_id: {
          type: 'string',
          description: 'The saved search ID',
        },
        limit: {
          type: 'string',
          description: 'Maximum number of results (default 10)',
        },
      },
      required: ['search_id'],
    },
  },
  {
    name: 'like_person',
    description: 'Like/save a person to the user\'s liked list. This updates both Specter API and local memory.',
    parameters: {
      type: 'object',
      properties: {
        person_id: {
          type: 'string',
          description: 'The Specter person ID to like',
        },
        person_name: {
          type: 'string',
          description: 'The person\'s name for memory',
        },
        reason: {
          type: 'string',
          description: 'Why the user likes this person (for learning preferences)',
        },
      },
      required: ['person_id'],
    },
  },
  {
    name: 'dislike_person',
    description: 'Dislike/skip a person. This updates both Specter API and local memory.',
    parameters: {
      type: 'object',
      properties: {
        person_id: {
          type: 'string',
          description: 'The Specter person ID to dislike',
        },
        person_name: {
          type: 'string',
          description: 'The person\'s name for memory',
        },
        reason: {
          type: 'string',
          description: 'Why the user dislikes this person (for learning preferences)',
        },
      },
      required: ['person_id'],
    },
  },
  {
    name: 'compare_with_liked',
    description: 'Compare a person with the user\'s liked people from memory. ALWAYS use this when user asks to compare someone with their preferences.',
    parameters: {
      type: 'object',
      properties: {
        person_id: {
          type: 'string',
          description: 'The person ID to compare',
        },
        person_name: {
          type: 'string',
          description: 'The person\'s name',
        },
      },
      required: ['person_id'],
    },
  },
  {
    name: 'learn_preference',
    description: 'Learn a user preference from their feedback. Use this when user expresses what they like or dislike about founders.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Preference category: industry, stage, location, seniority, company_size, education, or other',
        },
        value: {
          type: 'string',
          description: 'The preference value (e.g., "Fintech", "Series A", "London")',
        },
        example: {
          type: 'string',
          description: 'Example that triggered this preference',
        },
      },
      required: ['category', 'value'],
    },
  },
  // BULK ACTION TOOLS
  {
    name: 'auto_source_saved_search',
    description: 'Automatically source and score signals from a saved search. Returns top matches based on user preferences. Use for bulk pilot sourcing.',
    parameters: {
      type: 'object',
      properties: {
        search_id: {
          type: 'string',
          description: 'The saved search ID to source from',
        },
        limit: {
          type: 'string',
          description: 'Maximum signals to process (default 20)',
        },
        min_score: {
          type: 'string',
          description: 'Minimum match score (0-100) to include (default 60)',
        },
      },
      required: ['search_id'],
    },
  },
  {
    name: 'bulk_like',
    description: 'Like multiple people at once. Use for bulk actions after user reviews a shortlist.',
    parameters: {
      type: 'object',
      properties: {
        person_ids: {
          type: 'string',
          description: 'Comma-separated list of person IDs to like',
        },
        reason: {
          type: 'string',
          description: 'Reason for bulk like (for preference learning)',
        },
      },
      required: ['person_ids'],
    },
  },
  {
    name: 'bulk_dislike',
    description: 'Dislike multiple people at once. Use for bulk pass actions.',
    parameters: {
      type: 'object',
      properties: {
        person_ids: {
          type: 'string',
          description: 'Comma-separated list of person IDs to dislike',
        },
        reason: {
          type: 'string',
          description: 'Reason for bulk dislike (for preference learning)',
        },
      },
      required: ['person_ids'],
    },
  },
  {
    name: 'score_signal_batch',
    description: 'Score a batch of signals against user preferences. Returns scored and ranked list.',
    parameters: {
      type: 'object',
      properties: {
        search_id: {
          type: 'string',
          description: 'The saved search ID to score signals from',
        },
        limit: {
          type: 'string',
          description: 'Maximum signals to score (default 50)',
        },
      },
      required: ['search_id'],
    },
  },
  {
    name: 'generate_sourcing_report',
    description: 'Generate a summary report of sourcing activity including likes, dislikes, and preference patterns.',
    parameters: {
      type: 'object',
      properties: {
        days: {
          type: 'string',
          description: 'Number of days to include in report (default 7)',
        },
      },
      required: [],
    },
  },
];

// Legacy format for backwards compatibility
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

export const SPECTER_TOOLS: ToolDefinition[] = SPECTER_NATIVE_TOOLS as ToolDefinition[];

// ============================================
// TOOL EXECUTION WITH MEMORY
// ============================================

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  memoryUpdated?: boolean;
}

/**
 * Execute a tool call and return the result
 * MEMORY-FIRST: All tools update and leverage AgentMemory
 */
export async function executeToolCall(
  tool: ToolCall,
  token: string,
  context?: { likedPeople?: Person[] }
): Promise<ToolResult> {
  const memory = getAgentMemory();
  await memory.load(); // Ensure memory is loaded
  
  logger.info('AgenticTools', `Executing tool: ${tool.name}`, tool.arguments);

  try {
    switch (tool.name) {
      // ============================================
      // MEMORY-FIRST TOOLS (instant, no API call)
      // ============================================
      
      case 'get_memory_liked': {
        const limit = parseInt(tool.arguments.limit || '10');
        const likedEntities = memory.getLikedEntityIds().slice(0, limit);
        const stats = memory.getStats();
        
        return {
          success: true,
          data: `USER'S LIKED PEOPLE (from memory):
${likedEntities.length > 0 ? likedEntities.map((id, i) => `${i + 1}. ID: ${id}`).join('\n') : 'No liked people yet.'}

Memory Stats: ${stats.likedCount} total likes, ${stats.dislikedCount} dislikes, ${stats.preferencesLearned} preferences learned`,
        };
      }

      case 'get_memory_context': {
        const fullContext = memory.buildFullContext();
        const stats = memory.getStats();
        
        return {
          success: true,
          data: `FULL USER CONTEXT FROM MEMORY:

${fullContext}

Stats: ${stats.totalInteractions} total interactions, ${stats.totalConversations} conversations`,
        };
      }

      case 'learn_preference': {
        const { category, value, example } = tool.arguments;
        memory.learnPreference(category, value, example || 'User feedback');
        
        return {
          success: true,
          data: `Learned preference: ${category} = ${value}`,
          memoryUpdated: true,
        };
      }

      // ============================================
      // HYBRID TOOLS (memory + API)
      // ============================================

      case 'search_people': {
        const { query, limit = '5' } = tool.arguments;
        const limitNum = parseInt(limit);
        
        // Record search in memory
        memory.recordSearch(query);
        
        // Use fetchPeople - note: real search would need a query endpoint
        // For now, we fetch all and filter client-side (not ideal but works)
        const results = await fetchPeople(token, { limit: 50, offset: 0 });
        
        // Filter by query (simple text match)
        const queryLower = query.toLowerCase();
        const filtered = results.items.filter((p: Person) => {
          const name = (p.full_name || `${p.first_name} ${p.last_name}`).toLowerCase();
          const company = p.experience?.find(e => e.is_current)?.company_name?.toLowerCase() || '';
          return name.includes(queryLower) || company.includes(queryLower);
        });
        
        // Annotate results with memory status
        const annotatedResults = filtered.slice(0, limitNum).map((p: Person) => ({
          ...p,
          _memoryStatus: (memory.isLiked(p.id) ? 'LIKED' : memory.isDisliked(p.id) ? 'DISLIKED' : 'NEW') as 'LIKED' | 'DISLIKED' | 'NEW',
        }));
        
        return {
          success: true,
          data: formatPeopleForAIWithMemory(annotatedResults),
        };
      }

      case 'get_person_details': {
        const { person_id } = tool.arguments;
        const person = await fetchPersonDetail(token, person_id);
        
        // Add memory context
        const memoryStatus = memory.isLiked(person_id) ? 'LIKED' : 
                            memory.isDisliked(person_id) ? 'DISLIKED' : 'NEW';
        
        return {
          success: true,
          data: `${formatPersonDetailForAI(person)}\n\nMEMORY STATUS: ${memoryStatus}`,
        };
      }

      case 'get_saved_searches': {
        const { product_type } = tool.arguments;
        const searches = await fetchSavedSearches(token);
        const filtered = product_type 
          ? searches.filter(s => s.product_type === product_type)
          : searches;
        return {
          success: true,
          data: formatSearchesForAI(filtered),
        };
      }

      case 'get_saved_search_results': {
        const { search_id, limit = '10' } = tool.arguments;
        const limitNum = parseInt(limit);
        const results = await fetchPeopleSavedSearchResults(token, parseInt(search_id), { limit: limitNum });
        
        // Annotate with memory
        const annotatedResults = results.items.map((p: Person) => ({
          ...p,
          _memoryStatus: (memory.isLiked(p.id) ? 'LIKED' : memory.isDisliked(p.id) ? 'DISLIKED' : 'NEW') as 'LIKED' | 'DISLIKED' | 'NEW',
        }));
        
        return {
          success: true,
          data: formatPeopleForAIWithMemory(annotatedResults),
        };
      }

      // ============================================
      // ACTION TOOLS (API + memory update)
      // ============================================

      case 'like_person': {
        const { person_id, person_name, reason } = tool.arguments;
        
        // Update API
        await likePerson(token, person_id);
        
        // Update memory
        memory.recordLike({ id: person_id, name: person_name || person_id }, reason);
        
        // Learn preferences from reason
        if (reason) {
          // Extract potential preferences from reason
          const reasonLower = reason.toLowerCase();
          if (reasonLower.includes('fintech') || reasonLower.includes('finance')) {
            memory.learnPreference('industry', 'Fintech', reason);
          }
          if (reasonLower.includes('ai') || reasonLower.includes('machine learning')) {
            memory.learnPreference('industry', 'AI/ML', reason);
          }
          if (reasonLower.includes('series a') || reasonLower.includes('early stage')) {
            memory.learnPreference('stage', 'Early Stage', reason);
          }
        }
        
        return {
          success: true,
          data: `✅ Liked ${person_name || person_id}. Memory updated.`,
          memoryUpdated: true,
        };
      }

      case 'dislike_person': {
        const { person_id, person_name, reason } = tool.arguments;
        
        // Update API
        await dislikePerson(token, person_id);
        
        // Update memory
        memory.recordDislike({ id: person_id, name: person_name || person_id }, reason);
        
        return {
          success: true,
          data: `❌ Passed on ${person_name || person_id}. Memory updated.`,
          memoryUpdated: true,
        };
      }

      case 'compare_with_liked': {
        const { person_id, person_name } = tool.arguments;
        
        // Get liked IDs from memory
        const likedIds = memory.getLikedEntityIds().slice(0, 5);
        
        if (likedIds.length === 0) {
          return {
            success: true,
            data: `No liked people in memory to compare with ${person_name || person_id}. Like some people first!`,
          };
        }
        
        // Fetch current person and liked people
        const [currentPerson, ...likedPeople] = await Promise.all([
          fetchPersonDetail(token, person_id),
          ...likedIds.map(id => fetchPersonDetail(token, id).catch(() => null)),
        ]);
        
        const validLiked = likedPeople.filter(Boolean) as Person[];
        
        if (validLiked.length === 0) {
          return {
            success: true,
            data: formatPersonDetailForAI(currentPerson) + '\n\n(No valid liked people to compare)',
          };
        }
        
        return {
          success: true,
          data: formatComparisonForAI([currentPerson, ...validLiked]),
        };
      }

      // Legacy compare_people
      case 'compare_people': {
        const { person_ids } = tool.arguments;
        const ids = person_ids.split(',').map((id: string) => id.trim());
        const people = await Promise.all(
          ids.map((id: string) => fetchPersonDetail(token, id).catch(() => null))
        );
        const validPeople = people.filter(Boolean) as Person[];
        return {
          success: true,
          data: formatComparisonForAI(validPeople),
        };
      }

      // Legacy get_liked_people (uses API, not memory)
      case 'get_liked_people': {
        const { limit = 10 } = tool.arguments;
        const limitNum = parseInt(limit.toString());
        const response = await fetchPeople(token, { limit: limitNum, offset: 0 });
        // Filter to liked only
        const likedPeople = response.items.filter(p => p.entity_status?.status === 'liked');
        return {
          success: true,
          data: formatPeopleForAI(likedPeople.slice(0, limitNum)),
        };
      }

      // ============================================
      // BULK ACTION TOOLS
      // ============================================

      case 'auto_source_saved_search': {
        const { search_id, limit = '20', min_score = '60' } = tool.arguments;
        const limitNum = parseInt(limit);
        const minScoreNum = parseInt(min_score);
        
        // Fetch results from saved search
        const results = await fetchPeopleSavedSearchResults(token, search_id, { limit: limitNum });
        
        // Score each result against preferences
        const scored = results.items.map(person => {
          const currentJob = person.experience?.find(e => e.is_current);
          const features = {
            industry: currentJob?.industry,
            seniority: person.seniority,
            region: person.region,
            highlights: person.people_highlights,
          };
          const { score, reasons, warnings } = memory.calculateMatchScore(features);
          return {
            person,
            score,
            reasons,
            warnings,
          };
        });
        
        // Filter by min score and sort
        const filtered = scored
          .filter(s => s.score >= minScoreNum)
          .sort((a, b) => b.score - a.score);
        
        // Format results
        const lines = [`Auto-sourced ${filtered.length} signals (min score: ${minScoreNum}%):\n`];
        filtered.forEach((s, i) => {
          const name = s.person.full_name || `${s.person.first_name} ${s.person.last_name}`;
          lines.push(`${i + 1}. ${name} (${s.score}% match)`);
          lines.push(`   ID: ${s.person.id}`);
          if (s.reasons.length) lines.push(`   ✓ ${s.reasons.slice(0, 2).join(', ')}`);
          if (s.warnings.length) lines.push(`   ⚠ ${s.warnings[0]}`);
        });
        
        return {
          success: true,
          data: lines.join('\n'),
        };
      }

      case 'bulk_like': {
        const { person_ids, reason } = tool.arguments;
        const ids = person_ids.split(',').map((id: string) => id.trim());
        
        let liked = 0;
        let skipped = 0;
        
        for (const personId of ids) {
          // Skip if already liked
          if (memory.isLiked(personId)) {
            skipped++;
            continue;
          }
          
          try {
            await likePerson(token, personId);
            memory.recordLike({
              id: personId,
              name: `Person ${personId}`,
              type: 'person',
              context: reason,
            });
            liked++;
          } catch (err) {
            logger.warn('AgenticTools', `Failed to like ${personId}`, err);
          }
        }
        
        return {
          success: true,
          data: `Bulk liked ${liked} people (${skipped} already liked). ${reason ? `Reason: ${reason}` : ''}`,
          memoryUpdated: liked > 0,
        };
      }

      case 'bulk_dislike': {
        const { person_ids, reason } = tool.arguments;
        const ids = person_ids.split(',').map((id: string) => id.trim());
        
        let disliked = 0;
        let skipped = 0;
        
        for (const personId of ids) {
          // Skip if already disliked
          if (memory.isDisliked(personId)) {
            skipped++;
            continue;
          }
          
          try {
            await dislikePerson(token, personId);
            memory.recordDislike({
              id: personId,
              name: `Person ${personId}`,
              type: 'person',
              context: reason,
            });
            disliked++;
          } catch (err) {
            logger.warn('AgenticTools', `Failed to dislike ${personId}`, err);
          }
        }
        
        return {
          success: true,
          data: `Bulk disliked ${disliked} people (${skipped} already disliked). ${reason ? `Reason: ${reason}` : ''}`,
          memoryUpdated: disliked > 0,
        };
      }

      case 'score_signal_batch': {
        const { search_id, limit = '50' } = tool.arguments;
        const limitNum = parseInt(limit);
        
        // Fetch results
        const results = await fetchPeopleSavedSearchResults(token, search_id, { limit: limitNum });
        
        // Score all
        const scored = results.items.map(person => {
          const currentJob = person.experience?.find(e => e.is_current);
          const features = {
            industry: currentJob?.industry,
            seniority: person.seniority,
            region: person.region,
            highlights: person.people_highlights,
          };
          const { score, reasons } = memory.calculateMatchScore(features);
          return {
            id: person.id,
            name: person.full_name || `${person.first_name} ${person.last_name}`,
            score,
            reasons,
          };
        });
        
        // Sort by score
        scored.sort((a, b) => b.score - a.score);
        
        // Summary stats
        const high = scored.filter(s => s.score >= 70).length;
        const medium = scored.filter(s => s.score >= 50 && s.score < 70).length;
        const low = scored.filter(s => s.score < 50).length;
        
        const lines = [
          `Scored ${scored.length} signals:`,
          `  🟢 High match (70%+): ${high}`,
          `  🟡 Medium match (50-69%): ${medium}`,
          `  🔴 Low match (<50%): ${low}`,
          '',
          'Top 10:',
        ];
        
        scored.slice(0, 10).forEach((s, i) => {
          lines.push(`${i + 1}. ${s.name} - ${s.score}% (ID: ${s.id})`);
        });
        
        return {
          success: true,
          data: lines.join('\n'),
        };
      }

      case 'generate_sourcing_report': {
        const { days = '7' } = tool.arguments;
        const daysNum = parseInt(days);
        const stats = memory.getStats();
        const rewardHistory = memory.getRewardHistory();
        
        // Filter to recent
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysNum);
        const recentRewards = rewardHistory.filter(r => new Date(r.timestamp) > cutoff);
        
        // Calculate stats
        const likes = recentRewards.filter(r => r.action === 'LIKE').length;
        const dislikes = recentRewards.filter(r => r.action === 'DISLIKE').length;
        const saves = recentRewards.filter(r => r.action === 'SAVE').length;
        const totalReward = recentRewards.reduce((sum, r) => sum + r.reward, 0);
        
        // Get preference trends
        const prefs = memory.getLearnedPreferences()
          .filter(p => p.confidence > 0.3)
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 5);
        
        const lines = [
          `📊 SOURCING REPORT (Last ${daysNum} days)`,
          '',
          '📈 Activity:',
          `  • ${likes} likes`,
          `  • ${dislikes} passes`,
          `  • ${saves} saves`,
          `  • Total reward: ${totalReward.toFixed(1)}`,
          '',
          '🎯 Top Preferences:',
        ];
        
        prefs.forEach(p => {
          lines.push(`  • ${p.category}: ${p.value} (${Math.round(p.confidence * 100)}%)`);
        });
        
        // Add negative preferences
        const negPrefs = memory.getLearnedPreferences()
          .filter(p => p.negativeConfidence > 0.3)
          .sort((a, b) => b.negativeConfidence - a.negativeConfidence)
          .slice(0, 3);
        
        if (negPrefs.length) {
          lines.push('');
          lines.push('⚠️ Avoiding:');
          negPrefs.forEach(p => {
            lines.push(`  • ${p.category}: ${p.value} (${Math.round(p.negativeConfidence * 100)}%)`);
          });
        }
        
        return {
          success: true,
          data: lines.join('\n'),
        };
      }

      default:
        return {
          success: false,
          error: `Unknown tool: ${tool.name}`,
        };
    }
  } catch (error: any) {
    logger.error('AgenticTools', `Tool execution failed: ${tool.name}`, error);
    
    // Record failure in memory
    memory.recordInteraction('interaction', `Tool ${tool.name} failed: ${error.message}`, {
      action: 'tool_error',
      importance: 0.3,
    });
    
    return {
      success: false,
      error: error.message || 'Tool execution failed',
    };
  }
}

// ============================================
// FORMATTING HELPERS WITH MEMORY
// ============================================

interface PersonWithMemory extends Person {
  _memoryStatus?: 'LIKED' | 'DISLIKED' | 'NEW';
}

function formatPeopleForAI(people: Person[]): string {
  if (!people.length) return 'No people found.';

  return people.map((p, i) => {
    const currentJob = p.experience?.find(e => e.is_current);
    const lines = [
      `${i + 1}. ${p.full_name || `${p.first_name} ${p.last_name}`} (ID: ${p.id})`,
    ];
    
    if (currentJob) {
      lines.push(`   Role: ${currentJob.title} at ${currentJob.company_name}`);
    }
    if (p.location) lines.push(`   Location: ${p.location}`);
    if (p.people_highlights?.length) {
      lines.push(`   Highlights: ${p.people_highlights.join(', ')}`);
    }
    if (p.entity_status?.status) {
      lines.push(`   Status: ${p.entity_status.status}`);
    }
    
    return lines.join('\n');
  }).join('\n\n');
}

function formatPeopleForAIWithMemory(people: PersonWithMemory[]): string {
  if (!people.length) return 'No people found.';

  return people.map((p, i) => {
    const currentJob = p.experience?.find(e => e.is_current);
    const memoryBadge = p._memoryStatus === 'LIKED' ? '⭐ LIKED' : 
                        p._memoryStatus === 'DISLIKED' ? '❌ PASSED' : '🆕 NEW';
    
    const lines = [
      `${i + 1}. [${memoryBadge}] ${p.full_name || `${p.first_name} ${p.last_name}`} (ID: ${p.id})`,
    ];
    
    if (currentJob) {
      lines.push(`   Role: ${currentJob.title} at ${currentJob.company_name}`);
    }
    if (p.location) lines.push(`   Location: ${p.location}`);
    if (p.people_highlights?.length) {
      lines.push(`   Highlights: ${p.people_highlights.join(', ')}`);
    }
    
    return lines.join('\n');
  }).join('\n\n');
}

function formatPersonDetailForAI(person: Person): string {
  const lines: string[] = [
    `Name: ${person.full_name || `${person.first_name} ${person.last_name}`}`,
    `ID: ${person.id}`,
  ];

  if (person.tagline) lines.push(`Tagline: ${person.tagline}`);
  if (person.location) lines.push(`Location: ${person.location}`);
  if (person.region) lines.push(`Region: ${person.region}`);
  if (person.seniority) lines.push(`Seniority: ${person.seniority}`);
  if (person.years_of_experience) lines.push(`Experience: ${person.years_of_experience} years`);

  // Current position
  const currentJob = person.experience?.find(e => e.is_current);
  if (currentJob) {
    lines.push(`\nCurrent Role:`);
    lines.push(`  ${currentJob.title} at ${currentJob.company_name}`);
    if (currentJob.industry) {
      lines.push(`  Industry: ${currentJob.industry}`);
    }
    if (currentJob.company_size) {
      lines.push(`  Company Size: ${currentJob.company_size}`);
    }
  }

  // Highlights
  if (person.people_highlights?.length) {
    lines.push(`\nHighlights: ${person.people_highlights.join(', ')}`);
  }

  return lines.join('\n');
}

function formatSearchesForAI(searches: SavedSearch[]): string {
  if (!searches.length) return 'No saved searches found.';

  return searches.map((s, i) => {
    return `${i + 1}. "${s.name}" (ID: ${s.id})
   Type: ${s.product_type}
   Results: ${s.full_count.toLocaleString()}
   New: ${s.new_count || 0}`;
  }).join('\n\n');
}

function formatComparisonForAI(people: Person[]): string {
  if (!people.length) return 'No people found for comparison.';

  const headers = ['Attribute', ...people.map(p => p.full_name || `${p.first_name} ${p.last_name}`)];
  
  const rows: string[][] = [
    ['ID', ...people.map(p => p.id)],
    ['Current Role', ...people.map(p => {
      const job = p.experience?.find(e => e.is_current);
      return job ? `${job.title} at ${job.company_name}` : 'N/A';
    })],
    ['Location', ...people.map(p => p.location || 'N/A')],
    ['Seniority', ...people.map(p => p.seniority || 'N/A')],
    ['Experience', ...people.map(p => p.years_of_experience ? `${p.years_of_experience} years` : 'N/A')],
    ['Highlights', ...people.map(p => p.people_highlights?.slice(0, 3).join(', ') || 'None')],
    ['Status', ...people.map(p => p.entity_status?.status || 'Not rated')],
  ];

  let result = 'COMPARISON:\n\n';
  result += headers.join(' | ') + '\n';
  result += headers.map(() => '---').join(' | ') + '\n';
  
  for (const row of rows) {
    result += row.join(' | ') + '\n';
  }

  return result;
}

// ============================================
// MEMORY-FIRST SYSTEM PROMPT
// ============================================

/**
 * Build an aggressive memory-first system prompt
 * This ensures the AI always considers user preferences
 */
export function buildAgenticSystemPrompt(userContext?: string): string {
  const memory = getAgentMemory();
  const memoryContext = memory.buildFullContext();
  const stats = memory.getStats();

  const toolDescriptions = SPECTER_NATIVE_TOOLS.map(t => 
    `- ${t.name}: ${t.description}`
  ).join('\n');

  return `You are an AI assistant for venture capital investors using the Specter platform.

CRITICAL: You have MEMORY. Always use it to personalize responses.
- User has liked ${stats.likedCount} people, disliked ${stats.dislikedCount}
- ${stats.preferencesLearned} preferences learned
- ${stats.toolCallsThisSession} tool calls this session

MEMORY-FIRST TOOLS (instant, no API needed):
- get_memory_liked: Get liked people from memory for comparisons
- get_memory_context: Get full user context including preferences
- learn_preference: Learn a new user preference

API TOOLS:
- search_people: Search Specter database
- get_person_details: Get detailed person info
- get_saved_searches: Get user's saved searches
- get_saved_search_results: Get results from a saved search
- like_person: Like someone (updates API + memory)
- dislike_person: Pass on someone (updates API + memory)
- compare_with_liked: Compare someone with liked people from memory

RULES:
1. ALWAYS use get_memory_context first if unsure about user preferences
2. When comparing, use compare_with_liked or get_memory_liked
3. When user likes/dislikes, call learn_preference to capture why
4. Annotate responses with memory status (LIKED/PASSED/NEW)

${memoryContext ? `\nUSER MEMORY:\n${memoryContext}` : ''}

${userContext ? `\nADDITIONAL CONTEXT:\n${userContext}` : ''}

Be concise, investment-focused, and ALWAYS leverage memory for personalization.`;
}

/**
 * Parse AI response for tool calls (fallback for non-native mode)
 */
export function parseToolCall(response: string): ToolCall | null {
  try {
    // Look for JSON in the response
    const jsonMatch = response.match(/\{[\s\S]*"tool"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.tool && typeof parsed.tool === 'string') {
        return {
          name: parsed.tool,
          arguments: parsed.arguments || {},
        };
      }
    }
  } catch (e) {
    // Not a tool call
  }
  return null;
}

/**
 * Get native Cactus tools for direct function calling
 */
export function getNativeTools(): Tool[] {
  return SPECTER_NATIVE_TOOLS;
}

