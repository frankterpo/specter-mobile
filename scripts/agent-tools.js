#!/usr/bin/env node
/**
 * Specter Agent Tools
 * Defines all tools available to the AI agent for deal origination
 * 
 * These tools can be used with Cactus SDK's native function calling
 * 
 * Usage: 
 *   const { AGENT_TOOLS, executeAgentTool } = require('./agent-tools');
 */

require('dotenv').config();

const SPECTER_API_BASE = 'https://app.tryspecter.com/api/v1';
const API_KEY = process.env.EXPO_PUBLIC_SPECTER_API_KEY;

// ============================================
// API HELPER
// ============================================

async function fetchAPI(endpoint, options = {}) {
  const url = `${SPECTER_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error ${response.status}: ${text.slice(0, 200)}`);
  }
  
  return response.json();
}

// ============================================
// TOOL DEFINITIONS (Cactus-compatible format)
// ============================================

const AGENT_TOOLS = [
  // ─────────────────────────────────────────
  // SEARCH TOOLS
  // ─────────────────────────────────────────
  {
    name: 'get_saved_searches',
    description: 'Get all available saved searches. Returns searches organized by type: talent, people, company, stratintel, investors.',
    parameters: {
      type: 'object',
      properties: {
        product_type: {
          type: 'string',
          enum: ['talent', 'people', 'company', 'stratintel', 'investors', 'all'],
          description: 'Filter by product type. Use "all" to get all searches.',
        },
      },
      required: [],
    },
  },
  
  // ─────────────────────────────────────────
  // TALENT SIGNALS
  // ─────────────────────────────────────────
  {
    name: 'search_talent_signals',
    description: 'Search talent signals from a saved search. Returns founders making career moves, starting companies, or leaving stealth. Great for finding early-stage founders.',
    parameters: {
      type: 'object',
      properties: {
        search_id: {
          type: 'number',
          description: 'The saved search ID to query',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default: 10)',
        },
      },
      required: ['search_id'],
    },
  },
  
  // ─────────────────────────────────────────
  // PEOPLE SEARCH
  // ─────────────────────────────────────────
  {
    name: 'search_people',
    description: 'Search people from a saved search. Returns founders, executives, and talent matching the search criteria.',
    parameters: {
      type: 'object',
      properties: {
        search_id: {
          type: 'number',
          description: 'The saved search ID to query',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default: 10)',
        },
      },
      required: ['search_id'],
    },
  },
  
  // ─────────────────────────────────────────
  // COMPANY SEARCH
  // ─────────────────────────────────────────
  {
    name: 'search_companies',
    description: 'Search companies from a saved search. Returns startups matching investment criteria like stage, location, industry.',
    parameters: {
      type: 'object',
      properties: {
        search_id: {
          type: 'number',
          description: 'The saved search ID to query',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default: 10)',
        },
      },
      required: ['search_id'],
    },
  },
  
  // ─────────────────────────────────────────
  // STRATEGIC INTELLIGENCE (Interest Signals)
  // ─────────────────────────────────────────
  {
    name: 'search_investor_interest',
    description: 'Search investor interest signals (stratintel). Shows which companies are getting attention from top VCs. High signal scores indicate strong investor interest.',
    parameters: {
      type: 'object',
      properties: {
        search_id: {
          type: 'number',
          description: 'The saved search ID to query',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default: 10)',
        },
      },
      required: ['search_id'],
    },
  },
  
  // ─────────────────────────────────────────
  // PERSON DETAIL
  // ─────────────────────────────────────────
  {
    name: 'get_person_detail',
    description: 'Get detailed information about a specific person by their ID. Returns full profile including experience, education, highlights, and social links.',
    parameters: {
      type: 'object',
      properties: {
        person_id: {
          type: 'string',
          description: 'The Specter person ID (e.g., per_85a2719f785c8ae0fcbeccc2)',
        },
      },
      required: ['person_id'],
    },
  },
  
  // ─────────────────────────────────────────
  // COMPANY DETAIL (via enrichment)
  // ─────────────────────────────────────────
  {
    name: 'get_company_detail',
    description: 'Get detailed information about a company by domain or ID. Returns funding, investors, employee count, and growth metrics.',
    parameters: {
      type: 'object',
      properties: {
        company_id: {
          type: 'string',
          description: 'The company ID or domain',
        },
      },
      required: ['company_id'],
    },
  },
  
  // ─────────────────────────────────────────
  // ANALYSIS TOOLS
  // ─────────────────────────────────────────
  {
    name: 'score_founder',
    description: 'Score a founder based on investment criteria. Returns a score 0-100 with reasons.',
    parameters: {
      type: 'object',
      properties: {
        person_id: {
          type: 'string',
          description: 'The person ID to score',
        },
        criteria: {
          type: 'object',
          description: 'Investment criteria to score against',
          properties: {
            preferred_stages: { type: 'array', items: { type: 'string' } },
            preferred_industries: { type: 'array', items: { type: 'string' } },
            preferred_highlights: { type: 'array', items: { type: 'string' } },
            min_experience_years: { type: 'number' },
          },
        },
      },
      required: ['person_id'],
    },
  },
  
  // ─────────────────────────────────────────
  // BULK ACTIONS
  // ─────────────────────────────────────────
  {
    name: 'bulk_like',
    description: 'Like multiple people at once. Use after filtering and scoring to save promising founders.',
    parameters: {
      type: 'object',
      properties: {
        person_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of person IDs to like',
        },
        reason: {
          type: 'string',
          description: 'Reason for bulk liking (for audit trail)',
        },
      },
      required: ['person_ids'],
    },
  },
  
  {
    name: 'bulk_dislike',
    description: 'Dislike multiple people at once. Use to filter out non-matching founders.',
    parameters: {
      type: 'object',
      properties: {
        person_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of person IDs to dislike',
        },
        reason: {
          type: 'string',
          description: 'Reason for bulk disliking (for audit trail)',
        },
      },
      required: ['person_ids'],
    },
  },
];

// ============================================
// TOOL EXECUTION
// ============================================

async function executeAgentTool(toolName, args) {
  console.log(`🔧 Executing tool: ${toolName}`, args);
  
  switch (toolName) {
    // ─────────────────────────────────────────
    case 'get_saved_searches': {
      const searches = await fetchAPI('/searches');
      if (args.product_type && args.product_type !== 'all') {
        return searches.filter(s => s.product_type === args.product_type);
      }
      return searches;
    }
    
    // ─────────────────────────────────────────
    case 'search_talent_signals': {
      const limit = args.limit || 10;
      const data = await fetchAPI(`/searches/talent/${args.search_id}/results?limit=${limit}`);
      const items = Array.isArray(data) ? data : data.items || [];
      return items.map(item => ({
        person_id: item.person_id,
        full_name: item.full_name,
        signal_type: item.signal_type,
        signal_score: item.signal_score,
        signal_date: item.signal_date,
        new_position: item.new_position_title ? `${item.new_position_title} at ${item.new_position_company_name}` : null,
        past_position: item.past_position_title ? `${item.past_position_title} at ${item.past_position_company_name}` : null,
        linkedin_url: item.linkedin_url,
        highlights: item.highlights,
      }));
    }
    
    // ─────────────────────────────────────────
    case 'search_people': {
      const limit = args.limit || 10;
      const data = await fetchAPI(`/searches/people/${args.search_id}/results?limit=${limit}`);
      const items = Array.isArray(data) ? data : data.items || [];
      return items.map(item => ({
        person_id: item.person_id,
        full_name: item.full_name,
        tagline: item.tagline,
        location: item.location,
        linkedin_url: item.linkedin_url,
        highlights: item.highlights || item.people_highlights,
      }));
    }
    
    // ─────────────────────────────────────────
    case 'search_companies': {
      const limit = args.limit || 10;
      const data = await fetchAPI(`/searches/companies/${args.search_id}/results?limit=${limit}`);
      const items = Array.isArray(data) ? data : data.items || [];
      return items.map(item => ({
        company_id: item.id,
        name: item.organization_name || item.name,
        description: item.description?.slice(0, 200),
        industries: item.industries,
        growth_stage: item.growth_stage,
        funding: item.funding,
        hq: item.hq,
        founded_year: item.founded_year,
      }));
    }
    
    // ─────────────────────────────────────────
    case 'search_investor_interest': {
      const limit = args.limit || 10;
      const data = await fetchAPI(`/searches/investor-interest/${args.search_id}/results?limit=${limit}`);
      const items = Array.isArray(data) ? data : data.items || [];
      return items.map(item => ({
        signal_id: item.signal_id,
        signal_type: item.signal_type,
        signal_score: item.signal_score,
        signal_date: item.signal_date,
        signal_source: item.signal_source,
        entity_id: item.entity_id,
        total_funding: item.signal_total_funding_usd,
        last_funding: item.signal_last_funding_usd,
        investors: item.signal_investors?.map(i => i.name),
      }));
    }
    
    // ─────────────────────────────────────────
    case 'get_person_detail': {
      const person = await fetchAPI(`/people/${args.person_id}`);
      return {
        person_id: person.person_id,
        full_name: person.full_name,
        tagline: person.tagline,
        about: person.about,
        location: person.location,
        region: person.region,
        linkedin_url: person.linkedin_url,
        twitter_url: person.twitter_url,
        highlights: person.people_highlights || person.highlights,
        experience: person.experience?.slice(0, 5),
        education: person.education,
        talent_signal_ids: person.talent_signal_ids,
        investor_signal_ids: person.investor_signal_ids,
      };
    }
    
    // ─────────────────────────────────────────
    case 'get_company_detail': {
      const company = await fetchAPI(`/companies/${args.company_id}`);
      return {
        company_id: company.id || company.company_id,
        name: company.organization_name || company.name,
        description: company.description,
        industries: company.industries,
        growth_stage: company.growth_stage,
        funding: company.funding,
        hq: company.hq,
        founded_year: company.founded_year,
        employee_count: company.employee_count,
        founders: company.founders,
      };
    }
    
    // ─────────────────────────────────────────
    case 'score_founder': {
      // Get person details first
      const person = await fetchAPI(`/people/${args.person_id}`);
      const criteria = args.criteria || {};
      
      let score = 50; // Base score
      const reasons = [];
      
      // Check highlights
      const highlights = person.people_highlights || person.highlights || [];
      if (highlights.includes('serial_founder')) {
        score += 15;
        reasons.push('Serial founder (+15)');
      }
      if (highlights.includes('vc_backed')) {
        score += 10;
        reasons.push('Previously VC-backed (+10)');
      }
      if (highlights.includes('successful_exit')) {
        score += 20;
        reasons.push('Successful exit (+20)');
      }
      if (highlights.includes('yc_alumni')) {
        score += 10;
        reasons.push('YC alumni (+10)');
      }
      
      // Check preferred highlights
      if (criteria.preferred_highlights) {
        const matches = highlights.filter(h => criteria.preferred_highlights.includes(h));
        if (matches.length > 0) {
          score += matches.length * 5;
          reasons.push(`Matches ${matches.length} preferred highlights (+${matches.length * 5})`);
        }
      }
      
      // Cap score at 100
      score = Math.min(100, Math.max(0, score));
      
      return {
        person_id: args.person_id,
        full_name: person.full_name,
        score,
        reasons,
        highlights,
      };
    }
    
    // ─────────────────────────────────────────
    case 'bulk_like':
    case 'bulk_dislike': {
      // Note: These would need Clerk auth token for actual API calls
      // For now, return a mock response
      return {
        action: toolName === 'bulk_like' ? 'liked' : 'disliked',
        count: args.person_ids.length,
        person_ids: args.person_ids,
        reason: args.reason,
        status: 'simulated', // Would be 'success' with real auth
      };
    }
    
    // ─────────────────────────────────────────
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  AGENT_TOOLS,
  executeAgentTool,
  fetchAPI,
};

// ============================================
// CLI TEST
// ============================================

if (require.main === module) {
  async function testTools() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔧 AGENT TOOLS TEST');
    console.log('═══════════════════════════════════════════════════════════════');
    
    console.log(`\n📋 Available tools: ${AGENT_TOOLS.length}`);
    AGENT_TOOLS.forEach(t => console.log(`   - ${t.name}: ${t.description.slice(0, 60)}...`));
    
    // Test a few tools
    console.log('\n─────────────────────────────────────────────────────────────────');
    
    const searches = await executeAgentTool('get_saved_searches', { product_type: 'talent' });
    console.log(`\n✅ get_saved_searches: ${searches.length} talent searches`);
    
    if (searches.length > 0) {
      const talents = await executeAgentTool('search_talent_signals', { 
        search_id: searches[0].id, 
        limit: 3 
      });
      console.log(`\n✅ search_talent_signals: ${talents.length} results`);
      talents.forEach(t => console.log(`   - ${t.full_name}: ${t.signal_type}`));
      
      if (talents.length > 0) {
        const scored = await executeAgentTool('score_founder', { 
          person_id: talents[0].person_id 
        });
        console.log(`\n✅ score_founder: ${scored.full_name} = ${scored.score}/100`);
        scored.reasons.forEach(r => console.log(`   - ${r}`));
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════════════');
  }
  
  testTools().catch(console.error);
}

