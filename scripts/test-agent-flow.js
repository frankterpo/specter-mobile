#!/usr/bin/env node
/**
 * Test Agent Flow - Terminal-based agentic AI test
 * 
 * This script tests the full agent flow:
 * 1. Load real person data from Postgres
 * 2. Feed it to the agent
 * 3. Watch the agent use tools to verify data
 * 4. See the final analysis
 * 
 * Usage: node scripts/test-agent-flow.js
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://specter_admin:XHhgjwY7kUwBNJo5dHLGJk9L@product-db-staging.cefiadjkb8ut.eu-west-2.rds.amazonaws.com:5432/postgres';

// Simulated agent memory
const agentMemory = {
  likedIds: new Set(),
  dislikedIds: new Set(),
  preferences: {},
  
  recordLike(id, features) {
    this.likedIds.add(id);
    // Learn from features
    if (features.highlights) {
      features.highlights.forEach(h => {
        this.preferences[h] = (this.preferences[h] || 0) + 1;
      });
    }
    if (features.seniority) {
      this.preferences[`seniority:${features.seniority}`] = 
        (this.preferences[`seniority:${features.seniority}`] || 0) + 1;
    }
  },
  
  recordDislike(id, features) {
    this.dislikedIds.add(id);
    // Learn negative preferences
    if (features.seniority) {
      this.preferences[`avoid:${features.seniority}`] = 
        (this.preferences[`avoid:${features.seniority}`] || 0) + 1;
    }
  },
  
  calculateScore(features) {
    let score = 50; // Base score
    const reasons = [];
    const warnings = [];
    
    // Check positive preferences
    if (features.highlights) {
      features.highlights.forEach(h => {
        if (this.preferences[h] > 0) {
          score += 10 * this.preferences[h];
          reasons.push(`Matches preference: ${h}`);
        }
      });
    }
    
    if (features.seniority) {
      const seniorityKey = `seniority:${features.seniority}`;
      if (this.preferences[seniorityKey] > 0) {
        score += 15;
        reasons.push(`Preferred seniority: ${features.seniority}`);
      }
      
      const avoidKey = `avoid:${features.seniority}`;
      if (this.preferences[avoidKey] > 0) {
        score -= 20;
        warnings.push(`Previously passed on ${features.seniority} level`);
      }
    }
    
    return { score: Math.min(100, Math.max(0, score)), reasons, warnings };
  },
  
  getStats() {
    return {
      likedCount: this.likedIds.size,
      dislikedCount: this.dislikedIds.size,
      preferencesLearned: Object.keys(this.preferences).length,
    };
  }
};

// Simulated tool execution (would use real Cactus SDK in app)
async function executeToolCall(client, toolName, args) {
  console.log(`  🔧 Executing tool: ${toolName}`);
  console.log(`     Args: ${JSON.stringify(args)}`);
  
  switch (toolName) {
    case 'lookup_company_funding': {
      const result = await client.query(`
        SELECT 
          c.name,
          c.domain,
          fr.investment_type,
          fr.raised_amount_usd,
          fr.investor_count,
          fr.announced_on
        FROM public.companies c
        LEFT JOIN public.funding_round fr ON c.organization_id = fr.organization_id
        WHERE c.organization_id::text = $1 OR c.mongo_id = $1 OR c.domain ILIKE $1
        ORDER BY fr.announced_on DESC
        LIMIT 1
      `, [args.company_id]);
      
      if (result.rows.length === 0) {
        return `Company not found: ${args.company_id}`;
      }
      
      const r = result.rows[0];
      const funding = r.raised_amount_usd 
        ? `$${(r.raised_amount_usd / 1000000).toFixed(1)}M ${r.investment_type}`
        : 'No funding data';
      
      return `[Verified] ${r.name} (${r.domain}): ${funding}, ${r.investor_count || 0} investors`;
    }
    
    case 'lookup_person_details': {
      const result = await client.query(`
        SELECT 
          p.full_name,
          p.headline,
          p.country,
          ph.highlight
        FROM people_db.person p
        LEFT JOIN people_db.person_highlight ph ON p.person_id = ph.person_id
        WHERE p.specter_person_id = $1
        LIMIT 5
      `, [args.person_id]);
      
      if (result.rows.length === 0) {
        return `Person not found: ${args.person_id}`;
      }
      
      const p = result.rows[0];
      const highlights = result.rows.map(r => r.highlight).filter(Boolean);
      
      return `[Verified] ${p.full_name}: ${p.headline}\nHighlights: ${highlights.join(', ') || 'None'}`;
    }
    
    case 'search_entity': {
      const result = await client.query(`
        SELECT organization_id, name, domain
        FROM public.companies
        WHERE name ILIKE $1 OR domain ILIKE $1
        LIMIT 3
      `, [`%${args.query}%`]);
      
      if (result.rows.length === 0) {
        return `No companies found for: ${args.query}`;
      }
      
      return result.rows.map(r => 
        `${r.name} (${r.domain}) - ID: ${r.organization_id}`
      ).join('\n');
    }
    
    default:
      return `Unknown tool: ${toolName}`;
  }
}

// Simulated agent reasoning (would be Cactus SDK in app)
function simulateAgentReasoning(personData, toolResults) {
  const analysis = [];
  
  analysis.push(`## Analysis: ${personData.full_name}`);
  analysis.push('');
  
  // Current role
  const currentJob = personData.jobs?.find(j => j.is_current);
  if (currentJob) {
    analysis.push(`**Current Role:** ${currentJob.title} at ${currentJob.company_name}`);
  }
  
  // Highlights
  if (personData.highlights?.length > 0) {
    analysis.push('');
    analysis.push('**Key Signals:**');
    personData.highlights.forEach(h => {
      const formatted = h.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      analysis.push(`- ✓ ${formatted}`);
    });
  }
  
  // Tool-verified data
  if (toolResults.length > 0) {
    analysis.push('');
    analysis.push('**Verified Data:**');
    toolResults.forEach(tr => {
      analysis.push(`- ${tr.result}`);
    });
  }
  
  // Investment thesis
  analysis.push('');
  analysis.push('**Investment Thesis:**');
  
  const hasStrongSignals = personData.highlights?.some(h => 
    ['serial_founder', 'yc_alum', 'ex_stripe', 'ex_google', 'repeat_founder'].includes(h)
  );
  
  if (hasStrongSignals) {
    analysis.push('Strong founder profile with notable background. Worth a deeper look.');
  } else {
    analysis.push('Standard profile. May need more validation on track record.');
  }
  
  return analysis.join('\n');
}

async function main() {
  console.log('🤖 Agent Flow Test');
  console.log('═'.repeat(60));
  
  const client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to Specter Postgres\n');
    
    // Step 1: Load a real founder from the database
    console.log('📊 Step 1: Loading founder data...');
    console.log('─'.repeat(60));
    
    const founderResult = await client.query(`
      SELECT 
        p.specter_person_id as id,
        p.full_name,
        p.headline,
        p.country,
        p.about
      FROM people_db.person p
      WHERE p.headline ILIKE '%founder%' AND p.headline ILIKE '%ai%'
      LIMIT 1
    `);
    
    if (founderResult.rows.length === 0) {
      console.log('No AI founders found, trying any founder...');
      const anyFounder = await client.query(`
        SELECT 
          p.specter_person_id as id,
          p.full_name,
          p.headline,
          p.country,
          p.about
        FROM people_db.person p
        WHERE p.headline ILIKE '%founder%'
        LIMIT 1
      `);
      founderResult.rows = anyFounder.rows;
    }
    
    const founder = founderResult.rows[0];
    console.log(`Found: ${founder.full_name}`);
    console.log(`Headline: ${founder.headline}`);
    console.log(`ID: ${founder.id}\n`);
    
    // Get jobs and highlights
    const [jobsResult, highlightsResult] = await Promise.all([
      client.query(`
        SELECT pj.company_name, pj.title, pj.is_current, pj.start_date
        FROM people_db.person_job pj
        JOIN people_db.person p ON p.person_id = pj.person_id
        WHERE p.specter_person_id = $1
        ORDER BY pj.is_current DESC, pj.start_date DESC
        LIMIT 5
      `, [founder.id]),
      client.query(`
        SELECT ph.highlight
        FROM people_db.person_highlight ph
        JOIN people_db.person p ON p.person_id = ph.person_id
        WHERE p.specter_person_id = $1
      `, [founder.id]),
    ]);
    
    const personData = {
      ...founder,
      jobs: jobsResult.rows,
      highlights: highlightsResult.rows.map(h => h.highlight),
    };
    
    console.log('Experience:');
    personData.jobs.forEach(j => {
      const current = j.is_current ? ' (Current)' : '';
      console.log(`  • ${j.title} at ${j.company_name}${current}`);
    });
    
    console.log('\nHighlights:', personData.highlights.join(', ') || 'None');
    
    // Step 2: Agent decides to use tools
    console.log('\n📊 Step 2: Agent Tool Execution...');
    console.log('─'.repeat(60));
    
    const toolResults = [];
    
    // If there's a current company, look up its funding
    const currentJob = personData.jobs.find(j => j.is_current);
    if (currentJob) {
      console.log(`\nAgent thinks: "Let me verify ${currentJob.company_name}'s funding status..."`);
      
      const result = await executeToolCall(client, 'lookup_company_funding', {
        company_id: currentJob.company_name.toLowerCase().replace(/\s+/g, '')
      });
      
      console.log(`     Result: ${result}\n`);
      toolResults.push({ tool: 'lookup_company_funding', result });
    }
    
    // Step 3: Agent generates analysis
    console.log('\n📊 Step 3: Agent Analysis...');
    console.log('─'.repeat(60));
    
    const analysis = simulateAgentReasoning(personData, toolResults);
    console.log(analysis);
    
    // Step 4: Score against preferences
    console.log('\n📊 Step 4: Preference Scoring...');
    console.log('─'.repeat(60));
    
    // Simulate some previous likes to build preferences
    agentMemory.recordLike('prev1', { highlights: ['serial_founder', 'yc_alum'], seniority: 'Founder' });
    agentMemory.recordLike('prev2', { highlights: ['ex_stripe'], seniority: 'C-Level' });
    agentMemory.recordDislike('prev3', { seniority: 'Manager' });
    
    console.log('Learned preferences:', agentMemory.preferences);
    
    const features = {
      highlights: personData.highlights,
      seniority: personData.headline?.includes('Founder') ? 'Founder' : 
                 personData.headline?.includes('CEO') ? 'C-Level' : 'Unknown',
    };
    
    const score = agentMemory.calculateScore(features);
    console.log(`\nMatch Score: ${score.score}%`);
    if (score.reasons.length) console.log('Reasons:', score.reasons.join(', '));
    if (score.warnings.length) console.log('Warnings:', score.warnings.join(', '));
    
    // Step 5: Record decision
    console.log('\n📊 Step 5: Record Decision...');
    console.log('─'.repeat(60));
    
    if (score.score >= 70) {
      agentMemory.recordLike(founder.id, features);
      console.log(`⭐ AUTO-LIKED: ${founder.full_name} (Score: ${score.score}%)`);
    } else if (score.score < 40) {
      agentMemory.recordDislike(founder.id, features);
      console.log(`❌ AUTO-PASSED: ${founder.full_name} (Score: ${score.score}%)`);
    } else {
      console.log(`🤔 NEEDS REVIEW: ${founder.full_name} (Score: ${score.score}%)`);
    }
    
    console.log('\nFinal Agent Stats:', agentMemory.getStats());
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ Agent flow test complete!');
    console.log('\nThis demonstrates the full agentic loop:');
    console.log('1. Load real data from Postgres');
    console.log('2. Agent uses tools to verify claims');
    console.log('3. Agent generates analysis');
    console.log('4. Score against learned preferences');
    console.log('5. Auto-action based on confidence');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

main();

