#!/usr/bin/env node
/**
 * Agent CLI - Full backend agent testing
 * 
 * Run: node scripts/agent-cli.js
 * 
 * This is the pure backend agent - no React Native, no UI.
 * All JSON in, JSON out. Fast iteration on agent logic.
 */

// ============================================
// CONFIGURATION
// ============================================

const API_KEY = process.env.EXPO_PUBLIC_SPECTER_API_KEY || null;
const API_BASE = 'https://app.tryspecter.com/api/v1';
const USE_MOCK = !API_KEY || process.argv.includes('--mock');

// ============================================
// MOCK DATA (used when no API key)
// ============================================

const MOCK_DATA = {
  searches: [
    { id: 1, name: 'Stealth Founders', product_type: 'people', full_count: 150 },
    { id: 2, name: 'AI Talent Moves', product_type: 'talent', full_count: 89 },
    { id: 3, name: 'Series A Companies', product_type: 'company', full_count: 234 },
  ],
  people: [
    { id: 'p1', full_name: 'Sarah Chen', seniority: 'Founder', region: 'North America', people_highlights: ['serial_founder', 'yc_alum', 'ex_stripe'], experience: [{ company_name: 'Stealth AI', title: 'CEO', is_current: true, industry: 'AI' }] },
    { id: 'p2', full_name: 'Marcus Johnson', seniority: 'VP', region: 'North America', people_highlights: ['unicorn_experience'], experience: [{ company_name: 'Fintech Co', title: 'VP Eng', is_current: true, industry: 'Fintech' }] },
    { id: 'p3', full_name: 'Lisa Park', seniority: 'Founder', region: 'North America', people_highlights: ['repeat_founder', 'ex_meta'], experience: [{ company_name: 'Health Tech', title: 'Founder', is_current: true, industry: 'Healthcare' }] },
    { id: 'p4', full_name: 'David Chen', seniority: 'C-Level', region: 'North America', people_highlights: ['spinout', 'ex_openai'], experience: [{ company_name: 'AI Labs', title: 'CTO', is_current: true, industry: 'AI' }] },
    { id: 'p5', full_name: 'Emily Wang', seniority: 'Director', region: 'Europe', people_highlights: ['fortune_500'], experience: [{ company_name: 'BigCorp', title: 'Director', is_current: true, industry: 'Enterprise' }] },
    { id: 'p6', full_name: 'Jordan Kim', seniority: 'Manager', region: 'Asia', people_highlights: [], experience: [{ company_name: 'Startup XYZ', title: 'Manager', is_current: true, industry: 'SaaS' }] },
    { id: 'p7', full_name: 'Alex Rivera', seniority: 'Founder', region: 'North America', people_highlights: ['new_founder', 'ex_google'], experience: [{ company_name: 'Stealth Health', title: 'Founder', is_current: true, industry: 'Healthcare' }] },
    { id: 'p8', full_name: 'Nina Patel', seniority: 'VP', region: 'North America', people_highlights: ['yc_alum'], experience: [{ company_name: 'Growth Co', title: 'VP Product', is_current: true, industry: 'B2B SaaS' }] },
  ],
  talent: [
    { person_id: 't1', full_name: 'Mike Zhang', signal_type: 'New Company', signal_score: 95, level_of_seniority: 'Founder', region: 'North America', highlights: ['ex_stripe', 'repeat_founder'] },
    { person_id: 't2', full_name: 'Rachel Kim', signal_type: 'Spinout', signal_score: 88, level_of_seniority: 'C-Level', region: 'North America', highlights: ['unicorn_experience'] },
    { person_id: 't3', full_name: 'Tom Wilson', signal_type: 'Promotion', signal_score: 62, level_of_seniority: 'VP', region: 'Europe', highlights: [] },
  ],
  companies: [
    { id: 'c1', organization_name: 'Stealth AI', industries: ['AI'], growth_stage: 'Seed', funding: { total_funding_usd: 5000000 }, investors: ['Sequoia', 'a16z'] },
    { id: 'c2', organization_name: 'Fintech Co', industries: ['Fintech'], growth_stage: 'Series A', funding: { total_funding_usd: 15000000 }, investors: ['Ribbit'] },
  ],
};

// ============================================
// API LAYER
// ============================================

async function api(endpoint) {
  if (USE_MOCK) {
    // Return mock data
    if (endpoint === '/searches') return MOCK_DATA.searches;
    if (endpoint.includes('/people/') && endpoint.includes('/results')) return MOCK_DATA.people;
    if (endpoint.includes('/talent/') && endpoint.includes('/results')) return MOCK_DATA.talent;
    if (endpoint.includes('/companies/') && endpoint.includes('/results')) return MOCK_DATA.companies;
    return [];
  }
  
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.items || data.results || []);
}

// ============================================
// MEMORY SYSTEM
// ============================================

const memory = {
  likes: [],
  dislikes: [],
  preferences: new Map(),
  interactions: 0,
  
  like(entity, reason) {
    this.likes.push({ ...entity, reason, ts: Date.now() });
    this.learn(entity, 1);
    this.interactions++;
  },
  
  dislike(entity, reason) {
    this.dislikes.push({ ...entity, reason, ts: Date.now() });
    this.learn(entity, -1);
    this.interactions++;
  },
  
  learn(entity, weight) {
    const update = (key, val) => {
      const current = this.preferences.get(key) || 0.5;
      this.preferences.set(key, Math.max(0, Math.min(1, current + weight * 0.1)));
    };
    
    if (entity.seniority) update(`sen:${entity.seniority}`, entity.seniority);
    if (entity.region) update(`reg:${entity.region}`, entity.region);
    const hl = entity.people_highlights || entity.highlights || [];
    hl.forEach(h => update(`hl:${h}`, h));
    const exp = entity.experience || [];
    exp.forEach(e => e.industry && update(`ind:${e.industry}`, e.industry));
  },
  
  score(entity) {
    let score = 50;
    const reasons = [];
    const warnings = [];
    
    // Seniority
    const sen = entity.seniority || entity.level_of_seniority;
    if (sen) {
      const pref = this.preferences.get(`sen:${sen}`) || 0.5;
      if (pref > 0.6) { score += 15; reasons.push(`✓ Seniority: ${sen}`); }
      else if (pref < 0.4) { score -= 10; warnings.push(`⚠ Seniority: ${sen}`); }
      
      // Bonus for founders/C-level
      if (['Founder', 'C-Level'].includes(sen)) { score += 10; reasons.push(`🔥 High seniority`); }
    }
    
    // Region
    if (entity.region) {
      const pref = this.preferences.get(`reg:${entity.region}`) || 0.5;
      if (pref > 0.6) { score += 10; reasons.push(`✓ Region: ${entity.region}`); }
      else if (pref < 0.4) { score -= 5; warnings.push(`⚠ Region: ${entity.region}`); }
    }
    
    // Highlights
    const hl = entity.people_highlights || entity.highlights || [];
    const strongSignals = ['serial_founder', 'repeat_founder', 'yc_alum', 'ex_stripe', 'ex_google', 'ex_meta', 'ex_openai', 'unicorn', 'spinout', 'new_founder'];
    hl.forEach(h => {
      if (strongSignals.some(s => h.includes(s))) {
        score += 8;
        reasons.push(`✓ ${h.replace(/_/g, ' ')}`);
      }
    });
    
    // Signal type
    if (entity.signal_type) {
      if (['New Company', 'Spinout'].includes(entity.signal_type)) {
        score += 15;
        reasons.push(`🔥 ${entity.signal_type}`);
      }
    }
    
    // Industry preference
    const exp = entity.experience || [];
    exp.forEach(e => {
      if (e.industry) {
        const pref = this.preferences.get(`ind:${e.industry}`) || 0.5;
        if (pref > 0.6) { score += 5; reasons.push(`✓ Industry: ${e.industry}`); }
      }
    });
    
    return { score: Math.min(100, Math.max(0, Math.round(score))), reasons, warnings };
  },
  
  isLiked(id) { return this.likes.some(l => l.id === id || l.person_id === id); },
  isDisliked(id) { return this.dislikes.some(d => d.id === id || d.person_id === id); },
  
  getStats() {
    return {
      likes: this.likes.length,
      dislikes: this.dislikes.length,
      preferences: this.preferences.size,
      interactions: this.interactions,
      topPrefs: [...this.preferences.entries()]
        .filter(([k, v]) => v > 0.6)
        .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
        .slice(0, 5),
    };
  },
};

// ============================================
// AGENT CORE
// ============================================

const agent = {
  async process(input) {
    const start = Date.now();
    const cmd = input.toLowerCase().trim();
    
    // ---- STATS ----
    if (cmd === 'stats' || cmd === 'memory') {
      const stats = memory.getStats();
      return {
        type: 'stats',
        content: `📊 Agent Stats
━━━━━━━━━━━━━━━━━━━━━━━━━━
Likes: ${stats.likes}
Dislikes: ${stats.dislikes}
Preferences: ${stats.preferences}
Interactions: ${stats.interactions}
${stats.topPrefs.length ? `\nTop preferences:\n${stats.topPrefs.map(p => `  • ${p}`).join('\n')}` : ''}`,
        data: stats,
        ms: Date.now() - start,
      };
    }
    
    // ---- LIKES ----
    if (cmd === 'likes' || cmd === 'liked') {
      return {
        type: 'list',
        content: memory.likes.length 
          ? `👍 Liked (${memory.likes.length}):\n${memory.likes.map((l, i) => `${i + 1}. ${l.full_name || l.name}`).join('\n')}`
          : 'No likes yet. Use "like [name]" to like someone.',
        data: memory.likes,
        ms: Date.now() - start,
      };
    }
    
    // ---- DISLIKES ----
    if (cmd === 'dislikes' || cmd === 'passed') {
      return {
        type: 'list',
        content: memory.dislikes.length 
          ? `👎 Passed (${memory.dislikes.length}):\n${memory.dislikes.map((d, i) => `${i + 1}. ${d.full_name || d.name}`).join('\n')}`
          : 'No passes yet.',
        data: memory.dislikes,
        ms: Date.now() - start,
      };
    }
    
    // ---- SEARCHES ----
    if (cmd === 'searches' || cmd === 'search') {
      const searches = await api('/searches');
      return {
        type: 'list',
        content: `🔍 Saved Searches:\n${searches.map((s, i) => 
          `${i + 1}. ${s.name} (${s.product_type}) - ${s.full_count} results`
        ).join('\n')}`,
        data: searches,
        ms: Date.now() - start,
      };
    }
    
    // ---- SOURCE / SCORE ----
    if (cmd === 'source' || cmd === 'score') {
      // Get all signals
      const people = await api('/searches/people/1/results');
      const talent = await api('/searches/talent/2/results');
      const all = [...people, ...talent];
      
      // Score each
      const scored = all.map(e => {
        const id = e.id || e.person_id;
        const name = e.full_name || `${e.first_name} ${e.last_name}`;
        const { score, reasons, warnings } = memory.score(e);
        const status = memory.isLiked(id) ? '⭐' : memory.isDisliked(id) ? '❌' : '🆕';
        return { id, name, score, reasons, warnings, status, entity: e };
      }).sort((a, b) => b.score - a.score);
      
      const high = scored.filter(s => s.score >= 70 && s.status === '🆕');
      const medium = scored.filter(s => s.score >= 50 && s.score < 70 && s.status === '🆕');
      
      return {
        type: 'sourcing',
        content: `📊 Sourcing Report
━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: ${scored.length}
🟢 High (70%+): ${high.length}
🟡 Medium (50-69%): ${medium.length}

Top 10:
${scored.slice(0, 10).map((s, i) => 
  `${i + 1}. ${s.status} ${s.name} - ${s.score}%${s.reasons.length ? `\n   ${s.reasons.slice(0, 2).join(', ')}` : ''}`
).join('\n')}

${high.length > 0 ? `\n💡 Ready to bulk-like ${high.length} high-confidence matches` : ''}`,
        data: { total: scored.length, high: high.length, medium: medium.length, top: scored.slice(0, 20) },
        actions: high.length > 0 ? [{ type: 'bulk_like', ids: high.map(h => h.id), count: high.length }] : [],
        ms: Date.now() - start,
      };
    }
    
    // ---- LIKE ----
    if (cmd.startsWith('like ')) {
      const name = cmd.slice(5).toLowerCase();
      const people = await api('/searches/people/1/results');
      const talent = await api('/searches/talent/2/results');
      const all = [...people, ...talent];
      
      const entity = all.find(e => 
        (e.full_name || `${e.first_name} ${e.last_name}`).toLowerCase().includes(name)
      );
      
      if (entity) {
        const id = entity.id || entity.person_id;
        if (memory.isLiked(id)) {
          return { type: 'info', content: `Already liked ${entity.full_name}`, ms: Date.now() - start };
        }
        memory.like({ id, ...entity }, 'User liked');
        return {
          type: 'action',
          content: `✅ Liked ${entity.full_name}`,
          data: { id, name: entity.full_name },
          ms: Date.now() - start,
        };
      }
      return { type: 'error', content: `Not found: "${name}"`, ms: Date.now() - start };
    }
    
    // ---- DISLIKE / PASS ----
    if (cmd.startsWith('pass ') || cmd.startsWith('dislike ')) {
      const name = cmd.replace(/^(pass|dislike) /, '').toLowerCase();
      const people = await api('/searches/people/1/results');
      const talent = await api('/searches/talent/2/results');
      const all = [...people, ...talent];
      
      const entity = all.find(e => 
        (e.full_name || `${e.first_name} ${e.last_name}`).toLowerCase().includes(name)
      );
      
      if (entity) {
        const id = entity.id || entity.person_id;
        if (memory.isDisliked(id)) {
          return { type: 'info', content: `Already passed on ${entity.full_name}`, ms: Date.now() - start };
        }
        memory.dislike({ id, ...entity }, 'User passed');
        return {
          type: 'action',
          content: `❌ Passed on ${entity.full_name}`,
          data: { id, name: entity.full_name },
          ms: Date.now() - start,
        };
      }
      return { type: 'error', content: `Not found: "${name}"`, ms: Date.now() - start };
    }
    
    // ---- ANALYZE ----
    if (cmd.startsWith('analyze ') || cmd.startsWith('a ')) {
      const name = cmd.replace(/^(analyze|a) /, '').toLowerCase();
      const people = await api('/searches/people/1/results');
      const talent = await api('/searches/talent/2/results');
      const all = [...people, ...talent];
      
      const entity = all.find(e => 
        (e.full_name || `${e.first_name} ${e.last_name}`).toLowerCase().includes(name)
      );
      
      if (entity) {
        const { score, reasons, warnings } = memory.score(entity);
        const fullName = entity.full_name || `${entity.first_name} ${entity.last_name}`;
        const id = entity.id || entity.person_id;
        const status = memory.isLiked(id) ? 'LIKED' : memory.isDisliked(id) ? 'PASSED' : 'NEW';
        
        return {
          type: 'analysis',
          content: `📋 Analysis: ${fullName}
━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: ${status}
Match Score: ${score}%
${entity.seniority ? `Seniority: ${entity.seniority}` : ''}
${entity.region ? `Region: ${entity.region}` : ''}
${entity.signal_type ? `Signal: ${entity.signal_type}` : ''}

${reasons.length ? `Strengths:\n${reasons.map(r => `  ${r}`).join('\n')}` : ''}
${warnings.length ? `\nConcerns:\n${warnings.map(w => `  ${w}`).join('\n')}` : ''}

${score >= 70 ? '💡 Recommendation: LIKE' : score >= 50 ? '💡 Recommendation: REVIEW' : '💡 Recommendation: PASS'}`,
          data: { entity, score, reasons, warnings, status },
          actions: score >= 60 && status === 'NEW' ? [{ type: 'like', id, name: fullName }] : [],
          ms: Date.now() - start,
        };
      }
      return { type: 'error', content: `Not found: "${name}"`, ms: Date.now() - start };
    }
    
    // ---- BULK LIKE ----
    if (cmd === 'bulk' || cmd === 'bulk like' || cmd === 'accept') {
      const people = await api('/searches/people/1/results');
      const talent = await api('/searches/talent/2/results');
      const all = [...people, ...talent];
      
      const tolike = all.filter(e => {
        const id = e.id || e.person_id;
        if (memory.isLiked(id) || memory.isDisliked(id)) return false;
        const { score } = memory.score(e);
        return score >= 70;
      });
      
      if (tolike.length === 0) {
        return {
          type: 'info',
          content: '✅ No new high-confidence matches to like',
          ms: Date.now() - start,
        };
      }
      
      const names = [];
      tolike.forEach(e => {
        const name = e.full_name || `${e.first_name} ${e.last_name}`;
        memory.like({ id: e.id || e.person_id, full_name: name, ...e }, 'Bulk like');
        names.push(name);
      });
      
      return {
        type: 'action',
        content: `✅ Bulk liked ${tolike.length} matches:\n${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}`,
        data: { count: tolike.length, names },
        ms: Date.now() - start,
      };
    }
    
    // ---- HELP ----
    return {
      type: 'help',
      content: `🤖 Agent Commands
━━━━━━━━━━━━━━━━━━━━━━━━━━
stats       - Show agent stats & preferences
likes       - Show liked entities
dislikes    - Show passed entities
searches    - Show saved searches
source      - Score all signals & show report
like [name] - Like a person
pass [name] - Pass on a person
a [name]    - Analyze a person
bulk        - Bulk like all 70%+ matches
quit        - Exit`,
      ms: Date.now() - start,
    };
  },
};

// ============================================
// CLI REPL
// ============================================

async function main() {
  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  console.log(`
🤖 Specter Agent CLI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mode: ${USE_MOCK ? 'MOCK (no API)' : 'LIVE API'}
Type "help" for commands, "quit" to exit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
  
  const prompt = () => {
    rl.question('> ', async (input) => {
      if (!input.trim()) { prompt(); return; }
      if (input === 'quit' || input === 'exit' || input === 'q') {
        console.log('\n📊 Final:', JSON.stringify(memory.getStats()));
        console.log('Goodbye!\n');
        rl.close();
        process.exit(0);
      }
      
      try {
        const result = await agent.process(input);
        console.log(`\n${result.content}`);
        if (result.actions?.length) {
          console.log(`\n💡 Actions: ${result.actions.map(a => `${a.type}${a.count ? ` (${a.count})` : ''}`).join(', ')}`);
        }
        console.log(`[${result.ms}ms]\n`);
      } catch (e) {
        console.log(`\n❌ Error: ${e.message}\n`);
      }
      prompt();
    });
  };
  
  prompt();
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { agent, memory, api };

