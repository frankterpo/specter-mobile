// Agent Orchestrator - Central dispatch for all AI agent triggers
// Routes triggers to appropriate handlers, manages agent state, queues requests

import { PERSONA_RECIPES, scorePersonAgainstRecipe, PersonaRecipe } from './recipes';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type TriggerType = 
  | 'SCORE_PERSON'           // UC-1: Score this person
  | 'SUGGEST_DATAPOINTS'     // UC-2: AI-suggested datapoints
  | 'DEEP_DIVE'              // UC-3: Deep dive analysis
  | 'BULK_LIKE'              // UC-4: Bulk like command
  | 'BULK_DISLIKE'           // UC-4b: Bulk dislike command
  | 'CREATE_SHORTLIST'       // UC-5: Create shortlist
  | 'AUTO_SCORE'             // UC-6: Auto-score on card view
  | 'SORT_FEED'              // UC-7: Smart feed sorting
  | 'CHECK_ALERTS'           // UC-8: Proactive alerts
  | 'SESSION_SUMMARY'        // UC-9: End of session summary
  | 'NATURAL_SEARCH'         // UC-11: Natural language search
  | 'AUTO_PROCESS'           // UC-12: Auto-process feed
  | 'LEARN_CORRECTION';      // UC-13: Learn from corrections

export interface AgentRequest {
  id: string;
  trigger: TriggerType;
  payload: any;
  personaId: string;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
}

export interface AgentResponse {
  requestId: string;
  success: boolean;
  data: any;
  toolsCalled: ToolCall[];
  reasoning: string;
  duration: number;
  error?: string;
}

export interface ToolCall {
  tool: string;
  args: Record<string, any>;
  result: any;
  duration: number;
}

export interface PersonHighlights {
  id: string;
  name: string;
  title?: string;
  company?: string;
  highlights: string[];
  companyId?: string;
}

export interface ScoreResult {
  score: number;
  recommendation: string;
  matchedPositive: string[];
  matchedNegative: string[];
  matchedRedFlags: string[];
  reasoning: string;
  confidence: number;
}

export interface BulkActionResult {
  processed: number;
  succeeded: number;
  failed: number;
  details: { entityId: string; success: boolean; error?: string }[];
}

export interface DeepDiveResult {
  person: any;
  company: any | null;
  funding: any[] | null;
  analysis: string;
  score: ScoreResult;
  toolTrace: ToolCall[];
}

// ═══════════════════════════════════════════════════════════════════
// AGENT STATE
// ═══════════════════════════════════════════════════════════════════

type AgentStatus = 'idle' | 'busy' | 'error';

let agentStatus: AgentStatus = 'idle';
let requestQueue: AgentRequest[] = [];
let currentRequest: AgentRequest | null = null;
let learnedWeightsCache: Record<string, Record<string, number>> = {};

// ═══════════════════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════════════════

const LOG_PREFIX = {
  TRIGGER: '🎯',
  TOOL: '🔧',
  SCORE: '📊',
  SUCCESS: '✅',
  ERROR: '❌',
  QUEUE: '📋',
  LEARN: '🧠',
  BULK: '📦',
  DEEP: '🔍',
};

function log(prefix: keyof typeof LOG_PREFIX, message: string, data?: any) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] ${LOG_PREFIX[prefix]} ${message}`);
  if (data) {
    console.log(`   └─ ${JSON.stringify(data, null, 2).split('\n').join('\n   ')}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CORE ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════

export async function dispatch(request: AgentRequest): Promise<AgentResponse> {
  const startTime = Date.now();
  log('TRIGGER', `Dispatching: ${request.trigger}`, { id: request.id, persona: request.personaId });
  
  // Queue if busy
  if (agentStatus === 'busy' && currentRequest) {
    log('QUEUE', `Agent busy, queuing request`, { queueSize: requestQueue.length + 1 });
    requestQueue.push(request);
    return {
      requestId: request.id,
      success: false,
      data: null,
      toolsCalled: [],
      reasoning: 'Request queued - agent busy',
      duration: 0,
      error: 'QUEUED'
    };
  }
  
  agentStatus = 'busy';
  currentRequest = request;
  
  try {
    let response: AgentResponse;
    
    switch (request.trigger) {
      case 'SCORE_PERSON':
        response = await handleScorePerson(request);
        break;
      case 'SUGGEST_DATAPOINTS':
        response = await handleSuggestDatapoints(request);
        break;
      case 'DEEP_DIVE':
        response = await handleDeepDive(request);
        break;
      case 'BULK_LIKE':
        response = await handleBulkLike(request);
        break;
      case 'BULK_DISLIKE':
        response = await handleBulkDislike(request);
        break;
      case 'CREATE_SHORTLIST':
        response = await handleCreateShortlist(request);
        break;
      case 'AUTO_SCORE':
        response = await handleAutoScore(request);
        break;
      case 'SORT_FEED':
        response = await handleSortFeed(request);
        break;
      case 'CHECK_ALERTS':
        response = await handleCheckAlerts(request);
        break;
      case 'SESSION_SUMMARY':
        response = await handleSessionSummary(request);
        break;
      case 'NATURAL_SEARCH':
        response = await handleNaturalSearch(request);
        break;
      case 'AUTO_PROCESS':
        response = await handleAutoProcess(request);
        break;
      case 'LEARN_CORRECTION':
        response = await handleLearnCorrection(request);
        break;
      default:
        response = {
          requestId: request.id,
          success: false,
          data: null,
          toolsCalled: [],
          reasoning: `Unknown trigger: ${request.trigger}`,
          duration: Date.now() - startTime,
          error: 'UNKNOWN_TRIGGER'
        };
    }
    
    response.duration = Date.now() - startTime;
    log('SUCCESS', `Completed: ${request.trigger} in ${response.duration}ms`);
    
    return response;
  } catch (error: any) {
    log('ERROR', `Failed: ${request.trigger}`, { error: error.message });
    return {
      requestId: request.id,
      success: false,
      data: null,
      toolsCalled: [],
      reasoning: `Error: ${error.message}`,
      duration: Date.now() - startTime,
      error: error.message
    };
  } finally {
    agentStatus = 'idle';
    currentRequest = null;
    
    // Process queue
    if (requestQueue.length > 0) {
      const next = requestQueue.shift()!;
      log('QUEUE', `Processing next in queue`, { remaining: requestQueue.length });
      dispatch(next);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: UC-1 Score Person
// ═══════════════════════════════════════════════════════════════════

async function handleScorePerson(request: AgentRequest): Promise<AgentResponse> {
  const { person, learnedWeights } = request.payload as { 
    person: PersonHighlights; 
    learnedWeights?: Record<string, number>;
  };
  
  log('SCORE', `Scoring: ${person.name}`, { highlights: person.highlights });
  
  const recipe = PERSONA_RECIPES[request.personaId];
  if (!recipe) {
    return {
      requestId: request.id,
      success: false,
      data: null,
      toolsCalled: [],
      reasoning: `Unknown persona: ${request.personaId}`,
      duration: 0,
      error: 'UNKNOWN_PERSONA'
    };
  }
  
  // Merge learned weights with recipe defaults
  const effectiveWeights = { ...recipe.weights, ...(learnedWeights || {}) };
  
  const result = scorePersonAgainstRecipe(person.highlights, recipe, effectiveWeights);
  
  // Generate reasoning
  const reasoning = generateScoreReasoning(person, result, recipe);
  
  const scoreResult: ScoreResult = {
    ...result,
    reasoning,
    confidence: calculateConfidence(person.highlights, effectiveWeights)
  };
  
  log('SCORE', `Result: ${result.score}/100 → ${result.recommendation}`, {
    positive: result.matchedPositive,
    negative: result.matchedNegative,
    redFlags: result.matchedRedFlags
  });
  
  return {
    requestId: request.id,
    success: true,
    data: scoreResult,
    toolsCalled: [{
      tool: 'score_candidate',
      args: { highlights: person.highlights.join(',') },
      result: scoreResult,
      duration: 0
    }],
    reasoning,
    duration: 0
  };
}

function generateScoreReasoning(person: PersonHighlights, result: any, recipe: PersonaRecipe): string {
  const lines: string[] = [];
  
  if (result.score >= 80) {
    lines.push(`🔥 STRONG candidate for ${recipe.name}`);
  } else if (result.score >= 60) {
    lines.push(`👍 Good candidate for ${recipe.name}`);
  } else if (result.score >= 40) {
    lines.push(`🤔 Borderline candidate - needs deeper review`);
  } else {
    lines.push(`⚠️ Not a strong fit for ${recipe.name}`);
  }
  
  if (result.matchedPositive.length > 0) {
    lines.push(`✅ Strengths: ${result.matchedPositive.slice(0, 3).join(', ')}`);
  }
  
  if (result.matchedNegative.length > 0) {
    lines.push(`⚠️ Concerns: ${result.matchedNegative.join(', ')}`);
  }
  
  if (result.matchedRedFlags.length > 0) {
    lines.push(`🚩 Red flags: ${result.matchedRedFlags.join(', ')}`);
  }
  
  return lines.join('\n');
}

function calculateConfidence(highlights: string[], weights: Record<string, number>): number {
  const knownSignals = highlights.filter(h => weights[h] !== undefined).length;
  return Math.min(100, Math.round((knownSignals / Math.max(highlights.length, 1)) * 100));
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: UC-2 Suggest Datapoints
// ═══════════════════════════════════════════════════════════════════

async function handleSuggestDatapoints(request: AgentRequest): Promise<AgentResponse> {
  const { person, action } = request.payload as { 
    person: PersonHighlights; 
    action: 'like' | 'dislike';
  };
  
  log('TOOL', `Suggesting datapoints for ${action}: ${person.name}`);
  
  const recipe = PERSONA_RECIPES[request.personaId];
  if (!recipe) {
    return {
      requestId: request.id,
      success: false,
      data: null,
      toolsCalled: [],
      reasoning: `Unknown persona: ${request.personaId}`,
      duration: 0,
      error: 'UNKNOWN_PERSONA'
    };
  }
  
  // Find matching datapoints based on action
  const suggested: { datapoint: string; weight: number; reason: string }[] = [];
  
  if (action === 'like') {
    // Suggest positive highlights that match
    for (const highlight of person.highlights) {
      const normalized = highlight.toLowerCase().replace(/\s+/g, '_');
      if (recipe.positiveHighlights.some(p => normalized.includes(p) || p.includes(normalized))) {
        suggested.push({
          datapoint: highlight,
          weight: recipe.weights[normalized] || 0.5,
          reason: 'Matches positive signal for this persona'
        });
      }
    }
  } else {
    // Suggest negative highlights and red flags that match
    for (const highlight of person.highlights) {
      const normalized = highlight.toLowerCase().replace(/\s+/g, '_');
      if (recipe.negativeHighlights.some(n => normalized.includes(n) || n.includes(normalized)) ||
          recipe.redFlags.some(r => normalized.includes(r) || r.includes(normalized))) {
        suggested.push({
          datapoint: highlight,
          weight: recipe.weights[normalized] || -0.5,
          reason: 'Matches concern/red flag for this persona'
        });
      }
    }
  }
  
  // If no matches, suggest top highlights by weight
  if (suggested.length === 0) {
    const sortedHighlights = person.highlights
      .map(h => ({
        datapoint: h,
        weight: recipe.weights[h.toLowerCase().replace(/\s+/g, '_')] || 0,
        reason: 'Top highlight by weight'
      }))
      .sort((a, b) => action === 'like' ? b.weight - a.weight : a.weight - b.weight)
      .slice(0, 3);
    suggested.push(...sortedHighlights);
  }
  
  log('TOOL', `Suggested ${suggested.length} datapoints`, suggested.map(s => s.datapoint));
  
  return {
    requestId: request.id,
    success: true,
    data: {
      suggested,
      action,
      personId: person.id,
      personName: person.name
    },
    toolsCalled: [{
      tool: 'suggest_datapoints',
      args: { personId: person.id, action },
      result: suggested,
      duration: 0
    }],
    reasoning: `Suggested ${suggested.length} datapoints for ${action} based on ${recipe.name} recipe`,
    duration: 0
  };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: UC-3 Deep Dive
// ═══════════════════════════════════════════════════════════════════

async function handleDeepDive(request: AgentRequest): Promise<AgentResponse> {
  const { person, fetchPerson, fetchCompany, fetchFunding } = request.payload as {
    person: PersonHighlights;
    fetchPerson?: (id: string) => Promise<any>;
    fetchCompany?: (id: string) => Promise<any>;
    fetchFunding?: (companyId: string) => Promise<any[]>;
  };
  
  log('DEEP', `Deep diving: ${person.name}`);
  
  const toolsCalled: ToolCall[] = [];
  let personDetail = null;
  let companyDetail = null;
  let fundingHistory: any[] = [];
  
  // Step 1: Get full person details
  if (fetchPerson) {
    const start = Date.now();
    try {
      personDetail = await fetchPerson(person.id);
      toolsCalled.push({
        tool: 'get_person',
        args: { person_id: person.id },
        result: { success: true, hasData: !!personDetail },
        duration: Date.now() - start
      });
      log('TOOL', `get_person: ${personDetail ? 'found' : 'not found'}`);
    } catch (e: any) {
      toolsCalled.push({
        tool: 'get_person',
        args: { person_id: person.id },
        result: { success: false, error: e.message },
        duration: Date.now() - start
      });
    }
  }
  
  // Step 2: Get company details if not stealth
  if (fetchCompany && person.companyId && person.companyId !== 'stealth') {
    const start = Date.now();
    try {
      companyDetail = await fetchCompany(person.companyId);
      toolsCalled.push({
        tool: 'get_company',
        args: { company_id: person.companyId },
        result: { success: true, hasData: !!companyDetail },
        duration: Date.now() - start
      });
      log('TOOL', `get_company: ${companyDetail ? 'found' : 'not found'}`);
    } catch (e: any) {
      toolsCalled.push({
        tool: 'get_company',
        args: { company_id: person.companyId },
        result: { success: false, error: e.message },
        duration: Date.now() - start
      });
    }
  }
  
  // Step 3: Get funding history
  if (fetchFunding && person.companyId && person.companyId !== 'stealth') {
    const start = Date.now();
    try {
      fundingHistory = await fetchFunding(person.companyId);
      toolsCalled.push({
        tool: 'get_funding',
        args: { company_id: person.companyId },
        result: { success: true, rounds: fundingHistory.length },
        duration: Date.now() - start
      });
      log('TOOL', `get_funding: ${fundingHistory.length} rounds`);
    } catch (e: any) {
      toolsCalled.push({
        tool: 'get_funding',
        args: { company_id: person.companyId },
        result: { success: false, error: e.message },
        duration: Date.now() - start
      });
    }
  }
  
  // Step 4: Score with full context
  const enrichedHighlights = [...person.highlights];
  
  // Add company-derived signals
  if (companyDetail) {
    if (companyDetail.employee_count > 100) enrichedHighlights.push('scaled_company');
    if (companyDetail.total_funding > 10000000) enrichedHighlights.push('well_funded');
  }
  
  // Add funding-derived signals
  if (fundingHistory.length > 0) {
    enrichedHighlights.push('raised_funding');
    if (fundingHistory.some((f: any) => f.series === 'Series A' || f.series === 'Series B')) {
      enrichedHighlights.push('growth_stage_company');
    }
  }
  
  const recipe = PERSONA_RECIPES[request.personaId];
  const scoreResult = recipe 
    ? scorePersonAgainstRecipe(enrichedHighlights, recipe)
    : { score: 50, recommendation: 'BORDERLINE', matchedPositive: [], matchedNegative: [], matchedRedFlags: [] };
  
  // Generate comprehensive analysis
  const analysis = generateDeepDiveAnalysis(person, personDetail, companyDetail, fundingHistory, scoreResult);
  
  const result: DeepDiveResult = {
    person: personDetail,
    company: companyDetail,
    funding: fundingHistory,
    analysis,
    score: {
      ...scoreResult,
      reasoning: analysis,
      confidence: calculateConfidence(enrichedHighlights, recipe?.weights || {})
    },
    toolTrace: toolsCalled
  };
  
  log('DEEP', `Analysis complete: ${scoreResult.score}/100`, { toolsCalled: toolsCalled.length });
  
  return {
    requestId: request.id,
    success: true,
    data: result,
    toolsCalled,
    reasoning: analysis,
    duration: 0
  };
}

function generateDeepDiveAnalysis(
  person: PersonHighlights,
  personDetail: any,
  companyDetail: any,
  funding: any[],
  score: any
): string {
  const lines: string[] = [];
  
  lines.push(`═══════════════════════════════════════════════════════════════════`);
  lines.push(`🔍 DEEP DIVE ANALYSIS: ${person.name}`);
  lines.push(`═══════════════════════════════════════════════════════════════════`);
  lines.push(``);
  
  // Score summary
  lines.push(`📊 SCORE: ${score.score}/100 → ${score.recommendation}`);
  lines.push(``);
  
  // Person section
  lines.push(`👤 PERSON PROFILE`);
  lines.push(`─────────────────────────────────────────────────────────────────────`);
  if (personDetail) {
    lines.push(`   Name: ${personDetail.full_name || person.name}`);
    lines.push(`   Title: ${personDetail.tagline || person.title || 'N/A'}`);
    if (personDetail.linkedin_url) lines.push(`   LinkedIn: ${personDetail.linkedin_url}`);
  } else {
    lines.push(`   Name: ${person.name}`);
    lines.push(`   Title: ${person.title || 'N/A'}`);
  }
  lines.push(``);
  
  // Company section
  if (companyDetail) {
    lines.push(`🏢 COMPANY PROFILE`);
    lines.push(`─────────────────────────────────────────────────────────────────────`);
    lines.push(`   Name: ${companyDetail.name || companyDetail.organization_name}`);
    if (companyDetail.description) lines.push(`   Description: ${companyDetail.description.slice(0, 100)}...`);
    if (companyDetail.employee_count) lines.push(`   Employees: ${companyDetail.employee_count}`);
    if (companyDetail.founded_year) lines.push(`   Founded: ${companyDetail.founded_year}`);
    lines.push(``);
  }
  
  // Funding section
  if (funding && funding.length > 0) {
    lines.push(`💰 FUNDING HISTORY`);
    lines.push(`─────────────────────────────────────────────────────────────────────`);
    funding.slice(0, 5).forEach((round: any) => {
      lines.push(`   ${round.series || round.funding_type}: $${(round.amount / 1000000).toFixed(1)}M (${round.date || 'N/A'})`);
    });
    lines.push(``);
  }
  
  // Signals section
  lines.push(`📈 SIGNAL ANALYSIS`);
  lines.push(`─────────────────────────────────────────────────────────────────────`);
  if (score.matchedPositive.length > 0) {
    lines.push(`   ✅ Positive: ${score.matchedPositive.join(', ')}`);
  }
  if (score.matchedNegative.length > 0) {
    lines.push(`   ⚠️ Concerns: ${score.matchedNegative.join(', ')}`);
  }
  if (score.matchedRedFlags.length > 0) {
    lines.push(`   🚩 Red Flags: ${score.matchedRedFlags.join(', ')}`);
  }
  lines.push(``);
  
  // Recommendation
  lines.push(`💡 RECOMMENDATION`);
  lines.push(`─────────────────────────────────────────────────────────────────────`);
  if (score.score >= 80) {
    lines.push(`   Schedule meeting immediately. Strong profile.`);
  } else if (score.score >= 60) {
    lines.push(`   Worth a deeper look. Request intro call.`);
  } else if (score.score >= 40) {
    lines.push(`   Borderline. May need more context before deciding.`);
  } else {
    lines.push(`   Not a strong fit for current investment thesis.`);
  }
  
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: UC-4 Bulk Like
// ═══════════════════════════════════════════════════════════════════

async function handleBulkLike(request: AgentRequest): Promise<AgentResponse> {
  const { entityIds, datapoints, note, saveFeedback } = request.payload as {
    entityIds: string[];
    datapoints: string[];
    note?: string;
    saveFeedback?: (feedback: any) => Promise<void>;
  };
  
  log('BULK', `Bulk liking ${entityIds.length} entities`, { datapoints });
  
  const results: { entityId: string; success: boolean; error?: string }[] = [];
  
  for (const entityId of entityIds) {
    try {
      if (saveFeedback) {
        await saveFeedback({
          persona_id: request.personaId,
          entity_id: entityId,
          entity_type: 'person',
          action: 'like',
          datapoints,
          note,
          ai_score: null,
          user_agreed: true
        });
      }
      results.push({ entityId, success: true });
      log('BULK', `  ✓ Liked: ${entityId}`);
    } catch (e: any) {
      results.push({ entityId, success: false, error: e.message });
      log('ERROR', `  ✗ Failed: ${entityId}`, { error: e.message });
    }
  }
  
  const succeeded = results.filter(r => r.success).length;
  
  const bulkResult: BulkActionResult = {
    processed: entityIds.length,
    succeeded,
    failed: entityIds.length - succeeded,
    details: results
  };
  
  log('BULK', `Completed: ${succeeded}/${entityIds.length} succeeded`);
  
  return {
    requestId: request.id,
    success: succeeded > 0,
    data: bulkResult,
    toolsCalled: [{
      tool: 'bulk_like',
      args: { entity_ids: entityIds.join(','), datapoints: datapoints.join(','), note },
      result: bulkResult,
      duration: 0
    }],
    reasoning: `Liked ${succeeded}/${entityIds.length} entities with datapoints: ${datapoints.join(', ')}`,
    duration: 0
  };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: UC-4b Bulk Dislike
// ═══════════════════════════════════════════════════════════════════

async function handleBulkDislike(request: AgentRequest): Promise<AgentResponse> {
  const { entityIds, datapoints, note, saveFeedback } = request.payload as {
    entityIds: string[];
    datapoints: string[];
    note?: string;
    saveFeedback?: (feedback: any) => Promise<void>;
  };
  
  log('BULK', `Bulk disliking ${entityIds.length} entities`, { datapoints });
  
  const results: { entityId: string; success: boolean; error?: string }[] = [];
  
  for (const entityId of entityIds) {
    try {
      if (saveFeedback) {
        await saveFeedback({
          persona_id: request.personaId,
          entity_id: entityId,
          entity_type: 'person',
          action: 'dislike',
          datapoints,
          note,
          ai_score: null,
          user_agreed: true
        });
      }
      results.push({ entityId, success: true });
      log('BULK', `  ✓ Disliked: ${entityId}`);
    } catch (e: any) {
      results.push({ entityId, success: false, error: e.message });
      log('ERROR', `  ✗ Failed: ${entityId}`, { error: e.message });
    }
  }
  
  const succeeded = results.filter(r => r.success).length;
  
  const bulkResult: BulkActionResult = {
    processed: entityIds.length,
    succeeded,
    failed: entityIds.length - succeeded,
    details: results
  };
  
  log('BULK', `Completed: ${succeeded}/${entityIds.length} succeeded`);
  
  return {
    requestId: request.id,
    success: succeeded > 0,
    data: bulkResult,
    toolsCalled: [{
      tool: 'bulk_dislike',
      args: { entity_ids: entityIds.join(','), datapoints: datapoints.join(','), note },
      result: bulkResult,
      duration: 0
    }],
    reasoning: `Disliked ${succeeded}/${entityIds.length} entities with datapoints: ${datapoints.join(', ')}`,
    duration: 0
  };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: UC-5 Create Shortlist
// ═══════════════════════════════════════════════════════════════════

async function handleCreateShortlist(request: AgentRequest): Promise<AgentResponse> {
  const { name, entityIds, saveShortlist } = request.payload as {
    name: string;
    entityIds: string[];
    saveShortlist?: (shortlist: any) => Promise<number>;
  };
  
  log('TOOL', `Creating shortlist: "${name}" with ${entityIds.length} entities`);
  
  let shortlistId: number | null = null;
  
  if (saveShortlist) {
    shortlistId = await saveShortlist({
      name,
      persona_id: request.personaId,
      entity_ids: entityIds
    });
  }
  
  log('SUCCESS', `Shortlist created: ID ${shortlistId}`);
  
  return {
    requestId: request.id,
    success: true,
    data: {
      shortlistId,
      name,
      entityCount: entityIds.length,
      entityIds
    },
    toolsCalled: [{
      tool: 'create_shortlist',
      args: { name, entity_ids: entityIds.join(',') },
      result: { shortlistId, entityCount: entityIds.length },
      duration: 0
    }],
    reasoning: `Created shortlist "${name}" with ${entityIds.length} entities`,
    duration: 0
  };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: UC-6 Auto Score
// ═══════════════════════════════════════════════════════════════════

async function handleAutoScore(request: AgentRequest): Promise<AgentResponse> {
  const { persons, learnedWeights } = request.payload as {
    persons: PersonHighlights[];
    learnedWeights?: Record<string, number>;
  };
  
  log('SCORE', `Auto-scoring ${persons.length} candidates`);
  
  const recipe = PERSONA_RECIPES[request.personaId];
  if (!recipe) {
    return {
      requestId: request.id,
      success: false,
      data: null,
      toolsCalled: [],
      reasoning: `Unknown persona: ${request.personaId}`,
      duration: 0,
      error: 'UNKNOWN_PERSONA'
    };
  }
  
  const effectiveWeights = { ...recipe.weights, ...(learnedWeights || {}) };
  
  const scores: { personId: string; name: string; score: number; recommendation: string }[] = [];
  
  for (const person of persons) {
    const result = scorePersonAgainstRecipe(person.highlights, recipe, effectiveWeights);
    scores.push({
      personId: person.id,
      name: person.name,
      score: result.score,
      recommendation: result.recommendation
    });
    log('SCORE', `  ${result.score}/100 ${result.recommendation}: ${person.name}`);
  }
  
  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);
  
  const summary = {
    total: scores.length,
    strongPass: scores.filter(s => s.score >= 80).length,
    softPass: scores.filter(s => s.score >= 60 && s.score < 80).length,
    borderline: scores.filter(s => s.score >= 40 && s.score < 60).length,
    pass: scores.filter(s => s.score < 40).length
  };
  
  log('SCORE', `Summary: ${summary.strongPass} strong, ${summary.softPass} soft, ${summary.borderline} borderline, ${summary.pass} pass`);
  
  return {
    requestId: request.id,
    success: true,
    data: { scores, summary },
    toolsCalled: [{
      tool: 'auto_score',
      args: { count: persons.length },
      result: summary,
      duration: 0
    }],
    reasoning: `Scored ${persons.length} candidates: ${summary.strongPass} strong passes, ${summary.softPass} soft passes`,
    duration: 0
  };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: UC-7 Sort Feed
// ═══════════════════════════════════════════════════════════════════

async function handleSortFeed(request: AgentRequest): Promise<AgentResponse> {
  const { persons, learnedWeights } = request.payload as {
    persons: PersonHighlights[];
    learnedWeights?: Record<string, number>;
  };
  
  log('TOOL', `Sorting feed of ${persons.length} candidates by score`);
  
  // First auto-score all
  const scoreResponse = await handleAutoScore({
    ...request,
    payload: { persons, learnedWeights }
  });
  
  if (!scoreResponse.success) {
    return scoreResponse;
  }
  
  const { scores } = scoreResponse.data;
  
  // Create sorted order
  const sortedIds = scores.map((s: any) => s.personId);
  
  log('TOOL', `Feed sorted. Top 3: ${scores.slice(0, 3).map((s: any) => `${s.name} (${s.score})`).join(', ')}`);
  
  return {
    requestId: request.id,
    success: true,
    data: {
      sortedIds,
      scores,
      summary: scoreResponse.data.summary
    },
    toolsCalled: [...scoreResponse.toolsCalled, {
      tool: 'sort_feed',
      args: { count: persons.length },
      result: { sortedCount: sortedIds.length },
      duration: 0
    }],
    reasoning: `Sorted ${persons.length} candidates by fit score. Best match: ${scores[0]?.name} (${scores[0]?.score}/100)`,
    duration: 0
  };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: UC-8 Check Alerts
// ═══════════════════════════════════════════════════════════════════

async function handleCheckAlerts(request: AgentRequest): Promise<AgentResponse> {
  const { persons, threshold = 90, learnedWeights } = request.payload as {
    persons: PersonHighlights[];
    threshold?: number;
    learnedWeights?: Record<string, number>;
  };
  
  log('TOOL', `Checking for high-score alerts (threshold: ${threshold})`);
  
  const recipe = PERSONA_RECIPES[request.personaId];
  if (!recipe) {
    return {
      requestId: request.id,
      success: false,
      data: null,
      toolsCalled: [],
      reasoning: `Unknown persona: ${request.personaId}`,
      duration: 0,
      error: 'UNKNOWN_PERSONA'
    };
  }
  
  const effectiveWeights = { ...recipe.weights, ...(learnedWeights || {}) };
  
  const alerts: { person: PersonHighlights; score: number; recommendation: string }[] = [];
  
  for (const person of persons) {
    const result = scorePersonAgainstRecipe(person.highlights, recipe, effectiveWeights);
    if (result.score >= threshold) {
      alerts.push({
        person,
        score: result.score,
        recommendation: result.recommendation
      });
      log('TOOL', `  🔥 ALERT: ${person.name} scores ${result.score}/100!`);
    }
  }
  
  log('TOOL', `Found ${alerts.length} high-score candidates`);
  
  return {
    requestId: request.id,
    success: true,
    data: {
      alerts,
      count: alerts.length,
      threshold
    },
    toolsCalled: [{
      tool: 'check_alerts',
      args: { count: persons.length, threshold },
      result: { alertCount: alerts.length },
      duration: 0
    }],
    reasoning: alerts.length > 0 
      ? `🔥 Found ${alerts.length} hot leads scoring ${threshold}+!`
      : `No candidates above ${threshold} threshold`,
    duration: 0
  };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: UC-9 Session Summary
// ═══════════════════════════════════════════════════════════════════

async function handleSessionSummary(request: AgentRequest): Promise<AgentResponse> {
  const { sessionData, getFeedback, getWeights } = request.payload as {
    sessionData: {
      viewed: number;
      liked: string[];
      disliked: string[];
      skipped: number;
      startTime: number;
    };
    getFeedback?: () => Promise<any[]>;
    getWeights?: () => Promise<any[]>;
  };
  
  log('TOOL', `Generating session summary`);
  
  const duration = Date.now() - sessionData.startTime;
  const durationMin = Math.round(duration / 60000);
  
  // Get recent feedback for pattern analysis
  let recentFeedback: any[] = [];
  if (getFeedback) {
    recentFeedback = await getFeedback();
  }
  
  // Analyze patterns
  const patterns: string[] = [];
  const datapointCounts: Record<string, { likes: number; dislikes: number }> = {};
  
  recentFeedback.forEach(f => {
    const dps = typeof f.datapoints === 'string' ? JSON.parse(f.datapoints) : f.datapoints;
    dps?.forEach((dp: string) => {
      if (!datapointCounts[dp]) datapointCounts[dp] = { likes: 0, dislikes: 0 };
      if (f.action === 'like') datapointCounts[dp].likes++;
      else datapointCounts[dp].dislikes++;
    });
  });
  
  // Find patterns
  Object.entries(datapointCounts).forEach(([dp, counts]) => {
    const total = counts.likes + counts.dislikes;
    if (total >= 3) {
      const likeRate = counts.likes / total;
      if (likeRate >= 0.8) {
        patterns.push(`You liked ${Math.round(likeRate * 100)}% of candidates with "${dp}"`);
      } else if (likeRate <= 0.2) {
        patterns.push(`You disliked ${Math.round((1 - likeRate) * 100)}% of candidates with "${dp}"`);
      }
    }
  });
  
  const summary = {
    duration: durationMin,
    stats: {
      viewed: sessionData.viewed,
      liked: sessionData.liked.length,
      disliked: sessionData.disliked.length,
      skipped: sessionData.skipped,
      likeRate: sessionData.viewed > 0 
        ? Math.round((sessionData.liked.length / sessionData.viewed) * 100) 
        : 0
    },
    patterns,
    datapointAnalysis: datapointCounts
  };
  
  const lines: string[] = [];
  lines.push(`═══════════════════════════════════════════════════════════════════`);
  lines.push(`📊 SESSION SUMMARY (${durationMin} minutes)`);
  lines.push(`═══════════════════════════════════════════════════════════════════`);
  lines.push(``);
  lines.push(`📈 ACTIVITY`);
  lines.push(`   Viewed: ${summary.stats.viewed}`);
  lines.push(`   Liked: ${summary.stats.liked} (${summary.stats.likeRate}%)`);
  lines.push(`   Disliked: ${summary.stats.disliked}`);
  lines.push(`   Skipped: ${summary.stats.skipped}`);
  lines.push(``);
  
  if (patterns.length > 0) {
    lines.push(`🧠 PATTERNS DETECTED`);
    patterns.forEach(p => lines.push(`   • ${p}`));
    lines.push(``);
  }
  
  log('TOOL', `Session summary generated`, summary.stats);
  
  return {
    requestId: request.id,
    success: true,
    data: summary,
    toolsCalled: [{
      tool: 'session_summary',
      args: { viewed: sessionData.viewed },
      result: summary.stats,
      duration: 0
    }],
    reasoning: lines.join('\n'),
    duration: 0
  };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: UC-11 Natural Search
// ═══════════════════════════════════════════════════════════════════

async function handleNaturalSearch(request: AgentRequest): Promise<AgentResponse> {
  const { query, searchFn } = request.payload as {
    query: string;
    searchFn?: (filters: any) => Promise<any[]>;
  };
  
  log('TOOL', `Natural language search: "${query}"`);
  
  // Parse natural language into filters
  const filters = parseNaturalQuery(query);
  log('TOOL', `Parsed filters:`, filters);
  
  let results: any[] = [];
  if (searchFn) {
    results = await searchFn(filters);
  }
  
  // Score results
  const recipe = PERSONA_RECIPES[request.personaId];
  const scoredResults = results.map(r => {
    const highlights = r.highlights || [];
    const score = recipe 
      ? scorePersonAgainstRecipe(highlights, recipe)
      : { score: 50, recommendation: 'BORDERLINE' };
    return { ...r, aiScore: score.score, aiRecommendation: score.recommendation };
  });
  
  // Sort by score
  scoredResults.sort((a, b) => b.aiScore - a.aiScore);
  
  log('TOOL', `Found ${scoredResults.length} results`);
  
  return {
    requestId: request.id,
    success: true,
    data: {
      query,
      filters,
      results: scoredResults,
      count: scoredResults.length
    },
    toolsCalled: [{
      tool: 'natural_search',
      args: { query },
      result: { count: scoredResults.length, filters },
      duration: 0
    }],
    reasoning: `Found ${scoredResults.length} candidates matching "${query}"`,
    duration: 0
  };
}

function parseNaturalQuery(query: string): Record<string, any> {
  const filters: Record<string, any> = {};
  const q = query.toLowerCase();
  
  // Parse numbers
  const numMatch = q.match(/(\d+)\s*(founders?|people|candidates?)/);
  if (numMatch) filters.limit = parseInt(numMatch[1]);
  
  // Parse experience keywords
  if (q.includes('serial founder')) filters.highlights = ['serial_founder'];
  if (q.includes('yc') || q.includes('y combinator')) {
    filters.highlights = [...(filters.highlights || []), 'yc_alumni'];
  }
  if (q.includes('techstars')) {
    filters.highlights = [...(filters.highlights || []), 'techstars_alumni'];
  }
  if (q.includes('prior exit') || q.includes('exited')) {
    filters.highlights = [...(filters.highlights || []), 'prior_exit'];
  }
  
  // Parse industries
  const industries = ['ai', 'fintech', 'healthtech', 'saas', 'crypto', 'web3', 'biotech'];
  industries.forEach(ind => {
    if (q.includes(ind)) filters.industry = ind;
  });
  
  // Parse stages
  if (q.includes('seed') || q.includes('early')) filters.stage = 'seed';
  if (q.includes('series a') || q.includes('growth')) filters.stage = 'series_a';
  
  return filters;
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: UC-12 Auto Process
// ═══════════════════════════════════════════════════════════════════

async function handleAutoProcess(request: AgentRequest): Promise<AgentResponse> {
  const { persons, likeThreshold = 85, dislikeThreshold = 20, learnedWeights, saveFeedback } = request.payload as {
    persons: PersonHighlights[];
    likeThreshold?: number;
    dislikeThreshold?: number;
    learnedWeights?: Record<string, number>;
    saveFeedback?: (feedback: any) => Promise<void>;
  };
  
  log('TOOL', `Auto-processing ${persons.length} candidates (like >= ${likeThreshold}, dislike <= ${dislikeThreshold})`);
  
  const recipe = PERSONA_RECIPES[request.personaId];
  if (!recipe) {
    return {
      requestId: request.id,
      success: false,
      data: null,
      toolsCalled: [],
      reasoning: `Unknown persona: ${request.personaId}`,
      duration: 0,
      error: 'UNKNOWN_PERSONA'
    };
  }
  
  const effectiveWeights = { ...recipe.weights, ...(learnedWeights || {}) };
  
  const autoLiked: string[] = [];
  const autoDisliked: string[] = [];
  const needsReview: { person: PersonHighlights; score: number }[] = [];
  
  for (const person of persons) {
    const result = scorePersonAgainstRecipe(person.highlights, recipe, effectiveWeights);
    
    if (result.score >= likeThreshold) {
      autoLiked.push(person.id);
      if (saveFeedback) {
        await saveFeedback({
          persona_id: request.personaId,
          entity_id: person.id,
          entity_type: 'person',
          action: 'like',
          datapoints: result.matchedPositive,
          note: `Auto-liked (score: ${result.score})`,
          ai_score: result.score,
          user_agreed: true
        });
      }
      log('TOOL', `  ✓ Auto-liked: ${person.name} (${result.score})`);
    } else if (result.score <= dislikeThreshold) {
      autoDisliked.push(person.id);
      if (saveFeedback) {
        await saveFeedback({
          persona_id: request.personaId,
          entity_id: person.id,
          entity_type: 'person',
          action: 'dislike',
          datapoints: [...result.matchedNegative, ...result.matchedRedFlags],
          note: `Auto-disliked (score: ${result.score})`,
          ai_score: result.score,
          user_agreed: true
        });
      }
      log('TOOL', `  ✗ Auto-disliked: ${person.name} (${result.score})`);
    } else {
      needsReview.push({ person, score: result.score });
      log('TOOL', `  ? Needs review: ${person.name} (${result.score})`);
    }
  }
  
  const summary = {
    total: persons.length,
    autoLiked: autoLiked.length,
    autoDisliked: autoDisliked.length,
    needsReview: needsReview.length,
    autoLikedIds: autoLiked,
    autoDislikedIds: autoDisliked,
    reviewQueue: needsReview
  };
  
  log('TOOL', `Auto-process complete: ${autoLiked.length} liked, ${autoDisliked.length} disliked, ${needsReview.length} need review`);
  
  return {
    requestId: request.id,
    success: true,
    data: summary,
    toolsCalled: [{
      tool: 'auto_process',
      args: { count: persons.length, likeThreshold, dislikeThreshold },
      result: { autoLiked: autoLiked.length, autoDisliked: autoDisliked.length, needsReview: needsReview.length },
      duration: 0
    }],
    reasoning: `Auto-processed ${persons.length}: ${autoLiked.length} liked, ${autoDisliked.length} disliked, ${needsReview.length} need manual review`,
    duration: 0
  };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: UC-13 Learn Correction
// ═══════════════════════════════════════════════════════════════════

async function handleLearnCorrection(request: AgentRequest): Promise<AgentResponse> {
  const { person, aiRecommendation, userAction, datapoints, updateWeight } = request.payload as {
    person: PersonHighlights;
    aiRecommendation: 'STRONG_PASS' | 'SOFT_PASS' | 'BORDERLINE' | 'PASS';
    userAction: 'like' | 'dislike';
    datapoints: string[];
    updateWeight?: (personaId: string, datapoint: string, isLike: boolean) => Promise<void>;
  };
  
  // Determine if user disagreed with AI
  const aiSuggestedLike = aiRecommendation === 'STRONG_PASS' || aiRecommendation === 'SOFT_PASS';
  const userAgreed = (aiSuggestedLike && userAction === 'like') || (!aiSuggestedLike && userAction === 'dislike');
  
  log('LEARN', `Learning from ${userAgreed ? 'agreement' : 'CORRECTION'}: ${person.name}`);
  log('LEARN', `  AI said: ${aiRecommendation}, User did: ${userAction}`);
  
  // Update weights for selected datapoints
  if (updateWeight) {
    for (const dp of datapoints) {
      await updateWeight(request.personaId, dp, userAction === 'like');
      log('LEARN', `  Updated weight for "${dp}" (${userAction === 'like' ? '+' : '-'})`);
    }
  }
  
  // Generate learning summary
  const learningInsight = userAgreed
    ? `Reinforced: ${datapoints.join(', ')} are ${userAction === 'like' ? 'positive' : 'negative'} signals`
    : `Learned: User ${userAction}d despite AI suggesting ${aiRecommendation}. Adjusting weights for: ${datapoints.join(', ')}`;
  
  log('LEARN', `Insight: ${learningInsight}`);
  
  return {
    requestId: request.id,
    success: true,
    data: {
      personId: person.id,
      personName: person.name,
      aiRecommendation,
      userAction,
      userAgreed,
      datapoints,
      learningInsight
    },
    toolsCalled: [{
      tool: 'learn_correction',
      args: { personId: person.id, aiRecommendation, userAction, datapoints },
      result: { userAgreed, datapointsUpdated: datapoints.length },
      duration: 0
    }],
    reasoning: learningInsight,
    duration: 0
  };
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

export function getAgentStatus(): AgentStatus {
  return agentStatus;
}

export function getQueueLength(): number {
  return requestQueue.length;
}

export function clearQueue(): void {
  requestQueue = [];
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Cache learned weights for faster scoring
export function cacheLearnedWeights(personaId: string, weights: Record<string, number>): void {
  learnedWeightsCache[personaId] = weights;
}

export function getCachedWeights(personaId: string): Record<string, number> | undefined {
  return learnedWeightsCache[personaId];
}

