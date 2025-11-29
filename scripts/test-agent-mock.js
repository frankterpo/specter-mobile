#!/usr/bin/env node
/**
 * Mock Agent Test - Works without API
 * Run with: node scripts/test-agent-mock.js
 * 
 * Tests the agent logic with mock data.
 * Use this to iterate on agent capabilities without needing API access.
 */

// ============================================
// MOCK DATA
// ============================================

const MOCK_SAVED_SEARCHES = [
  { id: 1, name: 'Stealth Founders', product_type: 'people', full_count: 150, new_count: 12 },
  { id: 2, name: 'AI Talent Moves', product_type: 'talent', full_count: 89, new_count: 7 },
  { id: 3, name: 'Series A Companies', product_type: 'company', full_count: 234, new_count: 23 },
  { id: 4, name: 'Investor Interest - Fintech', product_type: 'stratintel', full_count: 45, new_count: 5 },
];

const MOCK_PEOPLE = [
  {
    id: 'per_001',
    first_name: 'Sarah',
    last_name: 'Chen',
    full_name: 'Sarah Chen',
    seniority: 'C-Level',
    region: 'North America',
    people_highlights: ['ex_stripe', 'serial_founder', 'yc_alum'],
    experience: [
      { company_name: 'Stealth AI', title: 'Founder & CEO', is_current: true, industry: 'AI/ML' },
      { company_name: 'Stripe', title: 'Staff Engineer', is_current: false },
    ],
  },
  {
    id: 'per_002',
    first_name: 'Marcus',
    last_name: 'Johnson',
    full_name: 'Marcus Johnson',
    seniority: 'VP',
    region: 'North America',
    people_highlights: ['unicorn_experience', 'repeat_founder'],
    experience: [
      { company_name: 'Fintech Co', title: 'VP Engineering', is_current: true, industry: 'Fintech' },
      { company_name: 'Plaid', title: 'Senior Engineer', is_current: false },
    ],
  },
  {
    id: 'per_003',
    first_name: 'Emily',
    last_name: 'Wang',
    full_name: 'Emily Wang',
    seniority: 'Director',
    region: 'Europe',
    people_highlights: ['fortune_500'],
    experience: [
      { company_name: 'BigCorp', title: 'Director Product', is_current: true, industry: 'Enterprise' },
    ],
  },
  {
    id: 'per_004',
    first_name: 'Alex',
    last_name: 'Rivera',
    full_name: 'Alex Rivera',
    seniority: 'Founder',
    region: 'North America',
    people_highlights: ['ex_google', 'new_founder'],
    experience: [
      { company_name: 'Stealth Health', title: 'Founder', is_current: true, industry: 'Healthcare' },
      { company_name: 'Google', title: 'Tech Lead', is_current: false },
    ],
  },
  {
    id: 'per_005',
    first_name: 'Jordan',
    last_name: 'Kim',
    full_name: 'Jordan Kim',
    seniority: 'Manager',
    region: 'Asia',
    people_highlights: [],
    experience: [
      { company_name: 'Startup XYZ', title: 'Engineering Manager', is_current: true, industry: 'SaaS' },
    ],
  },
];

const MOCK_TALENT_SIGNALS = [
  {
    person_id: 'per_006',
    full_name: 'Lisa Park',
    signal_type: 'New Company',
    signal_score: 92,
    level_of_seniority: 'Founder',
    region: 'North America',
    highlights: ['ex_meta', 'repeat_founder'],
    new_position_company_name: 'Stealth Startup',
    new_position_title: 'CEO & Founder',
  },
  {
    person_id: 'per_007',
    full_name: 'David Chen',
    signal_type: 'Spinout',
    signal_score: 88,
    level_of_seniority: 'C-Level',
    region: 'North America',
    highlights: ['unicorn_experience'],
    new_position_company_name: 'AI Labs',
    new_position_title: 'CTO',
    past_position_company_name: 'OpenAI',
  },
  {
    person_id: 'per_008',
    full_name: 'Maria Garcia',
    signal_type: 'Promotion',
    signal_score: 65,
    level_of_seniority: 'VP',
    region: 'Europe',
    highlights: [],
    new_position_company_name: 'Enterprise Corp',
    new_position_title: 'VP Sales',
  },
];

const MOCK_COMPANIES = [
  {
    id: 'com_001',
    organization_name: 'Stealth AI',
    industries: ['Artificial Intelligence', 'Machine Learning'],
    growth_stage: 'Seed',
    hq: { region: 'North America', city: 'San Francisco' },
    funding: { total_funding_usd: 5000000, last_funding_type: 'Seed' },
    investors: ['Sequoia', 'a16z'],
    employee_count: 12,
  },
  {
    id: 'com_002',
    organization_name: 'Fintech Co',
    industries: ['Fintech', 'Payments'],
    growth_stage: 'Series A',
    hq: { region: 'North America', city: 'New York' },
    funding: { total_funding_usd: 15000000, last_funding_type: 'Series A' },
    investors: ['Ribbit Capital', 'Index Ventures'],
    employee_count: 45,
  },
];

// ============================================
// MEMORY SIMULATION
// ============================================

const memory = {
  likes: [],
  dislikes: [],
  preferences: {},
  
  recordLike(entity, reason) {
    this.likes.push({ ...entity, reason, timestamp: new Date().toISOString() });
    this.learnFromEntity(entity, true);
  },
  
  recordDislike(entity, reason) {
    this.dislikes.push({ ...entity, reason, timestamp: new Date().toISOString() });
    this.learnFromEntity(entity, false);
  },
  
  learnFromEntity(entity, isPositive) {
    const weight = isPositive ? 0.1 : -0.1;
    
    if (entity.seniority) {
      this.preferences[`seniority:${entity.seniority}`] = 
        (this.preferences[`seniority:${entity.seniority}`] || 0.5) + weight;
    }
    if (entity.region) {
      this.preferences[`region:${entity.region}`] = 
        (this.preferences[`region:${entity.region}`] || 0.5) + weight;
    }
    const highlights = entity.people_highlights || entity.highlights || [];
    highlights.forEach(h => {
      this.preferences[`highlight:${h}`] = 
        (this.preferences[`highlight:${h}`] || 0.5) + weight;
    });
  },
  
  calculateScore(entity) {
    let score = 50;
    const reasons = [];
    
    // Seniority
    const seniority = entity.seniority || entity.level_of_seniority;
    if (seniority) {
      const pref = this.preferences[`seniority:${seniority}`] || 0.5;
      if (pref > 0.6) {
        score += 15;
        reasons.push(`Preferred seniority: ${seniority}`);
      } else if (pref < 0.4) {
        score -= 10;
      }
      
      // Bonus for founder/C-level
      if (['Founder', 'C-Level'].includes(seniority)) {
        score += 10;
        reasons.push(`High seniority: ${seniority}`);
      }
    }
    
    // Region
    if (entity.region) {
      const pref = this.preferences[`region:${entity.region}`] || 0.5;
      if (pref > 0.6) {
        score += 10;
        reasons.push(`Preferred region: ${entity.region}`);
      }
    }
    
    // Highlights
    const highlights = entity.people_highlights || entity.highlights || [];
    const goodHighlights = ['serial_founder', 'repeat_founder', 'yc_alum', 'unicorn_experience', 'ex_stripe', 'ex_google', 'ex_meta'];
    highlights.forEach(h => {
      if (goodHighlights.some(g => h.includes(g))) {
        score += 8;
        reasons.push(`Strong signal: ${h.replace(/_/g, ' ')}`);
      }
    });
    
    // Signal type bonus
    if (entity.signal_type) {
      if (entity.signal_type === 'New Company' || entity.signal_type === 'Spinout') {
        score += 15;
        reasons.push(`Founder signal: ${entity.signal_type}`);
      }
    }
    
    return { score: Math.min(100, Math.max(0, score)), reasons };
  },
  
  getStats() {
    return {
      likes: this.likes.length,
      dislikes: this.dislikes.length,
      preferences: Object.keys(this.preferences).length,
    };
  },
};

// ============================================
// AGENT CORE
// ============================================

const agent = {
  async process(input) {
    const startTime = Date.now();
    const content = input.toLowerCase();
    
    // Stats query
    if (content.includes('stats') || content.includes('memory')) {
      const stats = memory.getStats();
      return {
        type: 'response',
        content: `Agent Stats:\n• Likes: ${stats.likes}\n• Dislikes: ${stats.dislikes}\n• Preferences: ${stats.preferences}`,
        data: stats,
        timeMs: Date.now() - startTime,
      };
    }
    
    // Likes query
    if (content.includes('likes') || content.includes('liked')) {
      return {
        type: 'response',
        content: memory.likes.length > 0 
          ? `Liked (${memory.likes.length}):\n${memory.likes.map((l, i) => `${i + 1}. ${l.name}`).join('\n')}`
          : 'No likes yet.',
        data: { likes: memory.likes },
        timeMs: Date.now() - startTime,
      };
    }
    
    // Search query
    if (content.includes('search') || content.includes('find')) {
      return {
        type: 'response',
        content: `Available searches:\n${MOCK_SAVED_SEARCHES.map((s, i) => 
          `${i + 1}. ${s.name} (${s.product_type}) - ${s.full_count} results`
        ).join('\n')}`,
        data: { searches: MOCK_SAVED_SEARCHES },
        timeMs: Date.now() - startTime,
      };
    }
    
    // Source/bulk query
    if (content.includes('source') || content.includes('bulk') || content.includes('score')) {
      // Combine all signals
      const allSignals = [...MOCK_PEOPLE, ...MOCK_TALENT_SIGNALS];
      
      // Score each
      const scored = allSignals.map(s => {
        const { score, reasons } = memory.calculateScore(s);
        return {
          id: s.id || s.person_id,
          name: s.full_name || `${s.first_name} ${s.last_name}`,
          score,
          reasons,
          entity: s,
        };
      }).sort((a, b) => b.score - a.score);
      
      const high = scored.filter(s => s.score >= 70);
      const medium = scored.filter(s => s.score >= 50 && s.score < 70);
      
      return {
        type: 'suggestion',
        content: `Sourcing Report:\n\nTotal: ${scored.length}\n🟢 High (70%+): ${high.length}\n🟡 Medium (50-69%): ${medium.length}\n\nTop 5:\n${scored.slice(0, 5).map((s, i) => 
          `${i + 1}. ${s.name} - ${s.score}%${s.reasons.length ? `\n   ${s.reasons[0]}` : ''}`
        ).join('\n')}`,
        data: { scored, high: high.length, medium: medium.length },
        actions: high.length > 0 ? [{
          type: 'bulk_like',
          entityIds: high.map(s => s.id),
          confidence: 0.85,
          reason: `${high.length} high-confidence matches`,
        }] : [],
        timeMs: Date.now() - startTime,
      };
    }
    
    // Like action
    if (content.startsWith('like ')) {
      const name = content.replace('like ', '').trim();
      const entity = [...MOCK_PEOPLE, ...MOCK_TALENT_SIGNALS].find(p => 
        (p.full_name || `${p.first_name} ${p.last_name}`).toLowerCase().includes(name)
      );
      
      if (entity) {
        memory.recordLike({
          id: entity.id || entity.person_id,
          name: entity.full_name || `${entity.first_name} ${entity.last_name}`,
          ...entity,
        }, 'User liked');
        
        return {
          type: 'action',
          content: `✅ Liked ${entity.full_name || entity.first_name}`,
          timeMs: Date.now() - startTime,
        };
      }
      
      return { type: 'error', content: `Person "${name}" not found` };
    }
    
    // Dislike action
    if (content.startsWith('dislike ') || content.startsWith('pass ')) {
      const name = content.replace(/^(dislike|pass) /, '').trim();
      const entity = [...MOCK_PEOPLE, ...MOCK_TALENT_SIGNALS].find(p => 
        (p.full_name || `${p.first_name} ${p.last_name}`).toLowerCase().includes(name)
      );
      
      if (entity) {
        memory.recordDislike({
          id: entity.id || entity.person_id,
          name: entity.full_name || `${entity.first_name} ${entity.last_name}`,
          ...entity,
        }, 'User passed');
        
        return {
          type: 'action',
          content: `❌ Passed on ${entity.full_name || entity.first_name}`,
          timeMs: Date.now() - startTime,
        };
      }
      
      return { type: 'error', content: `Person "${name}" not found` };
    }
    
    // Analyze query
    if (content.includes('analyze')) {
      const name = content.replace(/analyze\s*/i, '').trim();
      const entity = [...MOCK_PEOPLE, ...MOCK_TALENT_SIGNALS].find(p => 
        (p.full_name || `${p.first_name} ${p.last_name}`).toLowerCase().includes(name)
      );
      
      if (entity) {
        const { score, reasons } = memory.calculateScore(entity);
        const fullName = entity.full_name || `${entity.first_name} ${entity.last_name}`;
        
        return {
          type: 'response',
          content: `Analysis: ${fullName}\n\nMatch Score: ${score}%\n\n${reasons.length ? `Strengths:\n${reasons.map(r => `• ${r}`).join('\n')}` : 'No specific matches yet.'}`,
          data: { entity, score, reasons },
          actions: score >= 60 ? [{
            type: 'like',
            entityIds: [entity.id || entity.person_id],
            confidence: score / 100,
            reason: reasons[0] || 'Good match',
          }] : [],
          timeMs: Date.now() - startTime,
        };
      }
      
      return { type: 'error', content: `Person "${name}" not found` };
    }
    
    // Default help
    return {
      type: 'response',
      content: `Commands:
• stats - Show agent stats
• likes - Show liked entities
• search - Show saved searches
• source / score - Score all signals
• like [name] - Like a person
• pass [name] - Pass on a person
• analyze [name] - Analyze a person`,
      timeMs: Date.now() - startTime,
    };
  },
};

// ============================================
// INTERACTIVE REPL
// ============================================

async function main() {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  console.log('🤖 Agent Mock Test (No API Required)\n');
  console.log('Type commands to test agent logic. Type "help" for commands.\n');
  
  const prompt = () => {
    rl.question('> ', async (input) => {
      if (!input.trim()) {
        prompt();
        return;
      }
      
      if (input === 'quit' || input === 'exit') {
        console.log('\nFinal stats:', memory.getStats());
        console.log('Goodbye!');
        rl.close();
        process.exit(0);
      }
      
      try {
        const result = await agent.process(input);
        
        console.log(`\n[${result.type}] (${result.timeMs}ms)`);
        console.log(result.content);
        
        if (result.actions?.length) {
          console.log(`\n💡 Suggested: ${result.actions.map(a => `${a.type} (${Math.round(a.confidence * 100)}%)`).join(', ')}`);
        }
        
        console.log('');
      } catch (e) {
        console.log(`\n❌ Error: ${e.message}\n`);
      }
      
      prompt();
    });
  };
  
  // Show initial data
  console.log('📊 Mock Data Loaded:');
  console.log(`  • ${MOCK_SAVED_SEARCHES.length} saved searches`);
  console.log(`  • ${MOCK_PEOPLE.length} people`);
  console.log(`  • ${MOCK_TALENT_SIGNALS.length} talent signals`);
  console.log(`  • ${MOCK_COMPANIES.length} companies\n`);
  
  prompt();
}

main();

