#!/usr/bin/env node
/**
 * RL Agent - Standalone Terminal-based Reinforcement Learning
 * 
 * Self-contained with direct API calls - no TypeScript dependencies
 */

require('dotenv').config();
const readline = require('readline');

const API_KEY = process.env.EXPO_PUBLIC_SPECTER_API_KEY;
const API_BASE = 'https://app.tryspecter.com/api/v1';

// ============================================
// API FUNCTIONS (inline)
// ============================================

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

async function fetchSavedSearches() {
  const url = `${API_BASE}/searches`;
  const response = await fetchWithTimeout(url, {
    headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

async function fetchTalentSignals(searchId, { limit = 10, offset = 0 } = {}) {
  const url = `${API_BASE}/searches/talent/${searchId}/results?limit=${limit}&offset=${offset}`;
  const response = await fetchWithTimeout(url, {
    headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return { items: data.items || data.results || data, total: data.total };
}

async function fetchPeopleResults(searchId, { limit = 10, offset = 0 } = {}) {
  const url = `${API_BASE}/searches/people/${searchId}/results?limit=${limit}&offset=${offset}`;
  const response = await fetchWithTimeout(url, {
    headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return { items: data.items || data.results || data, total: data.total };
}

// ============================================
// REWARD SIGNALS
// ============================================

const REWARD_SIGNALS = {
  LIKE: 1.0,
  DISLIKE: -1.0,
  SAVE: 2.0,
  SKIP: -0.2,
};

// ============================================
// SIMPLE EMBEDDING (TF-IDF style)
// ============================================

const vocabulary = new Map();
let vocabSize = 0;

function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);
}

function embed(text) {
  const tokens = tokenize(text);
  const vector = new Array(100).fill(0);
  tokens.forEach(token => {
    if (!vocabulary.has(token)) vocabulary.set(token, vocabSize++ % 100);
    vector[vocabulary.get(token)] += 1;
  });
  const mag = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;
  return vector.map(v => v / mag);
}

function cosineSim(a, b) {
  if (!a || !b) return 0;
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

// ============================================
// PREFERENCE STORE
// ============================================

const store = {
  liked: [],
  disliked: [],
  prefs: [],
  pairs: [],
  rewards: [],
  totalReward: 0,
  embeddings: new Map(),
};

// ============================================
// FEATURE EXTRACTION
// ============================================

function extractFeatures(p) {
  const job = p.experience?.find(e => e.is_current);
  const text = `${p.full_name} ${p.headline} ${p.about} ${p.people_highlights?.join(' ')} ${p.experience?.map(e => e.company_name).join(' ')}`;
  return {
    id: p.id || p.person_id,
    name: p.full_name,
    role: job?.title || p.headline?.split(' at ')[0],
    company: job?.company_name || p.new_position_company_name,
    industry: inferIndustry(p),
    region: p.city || p.country,
    highlights: p.people_highlights || [],
    companies: p.experience?.map(e => e.company_name).filter(Boolean) || [],
    signal: p.signal_type,
    text,
  };
}

function inferIndustry(p) {
  const t = `${p.headline || ''} ${p.about || ''}`.toLowerCase();
  if (t.includes('ai') || t.includes('machine learning')) return 'AI';
  if (t.includes('fintech') || t.includes('financial')) return 'Fintech';
  if (t.includes('health') || t.includes('medical')) return 'Healthcare';
  if (t.includes('crypto') || t.includes('blockchain')) return 'Crypto';
  return 'Tech';
}

// ============================================
// LEARNING
// ============================================

function recordLike(person, reason) {
  const f = extractFeatures(person);
  store.embeddings.set(f.id, embed(f.text));
  store.liked.push({ ...f, reason, ts: Date.now(), emb: store.embeddings.get(f.id) });
  store.totalReward += REWARD_SIGNALS.LIKE;
  store.rewards.push({ id: f.id, action: 'LIKE', reward: REWARD_SIGNALS.LIKE, reason, ts: Date.now() });
  learnFeatures(f, true, reason);
}

function recordDislike(person, reason) {
  const f = extractFeatures(person);
  store.embeddings.set(f.id, embed(f.text));
  store.disliked.push({ ...f, reason, ts: Date.now(), emb: store.embeddings.get(f.id) });
  store.totalReward += REWARD_SIGNALS.DISLIKE;
  store.rewards.push({ id: f.id, action: 'DISLIKE', reward: REWARD_SIGNALS.DISLIKE, reason, ts: Date.now() });
  learnFeatures(f, false, reason);
}

function recordPair(chosen, rejected, reason) {
  store.pairs.push({
    chosen: extractFeatures(chosen),
    rejected: extractFeatures(rejected),
    reason,
    ts: Date.now(),
  });
}

function learnFeatures(f, positive, reason) {
  const learn = (cat, val) => {
    if (!val) return;
    let p = store.prefs.find(x => x.cat === cat && x.val.toLowerCase() === val.toLowerCase());
    if (!p) { p = { cat, val, pos: 0, neg: 0, posReasons: [], negReasons: [] }; store.prefs.push(p); }
    if (positive) { p.pos += 0.15; if (!p.posReasons.includes(reason)) p.posReasons.push(reason); }
    else { p.neg += 0.15; if (!p.negReasons.includes(reason)) p.negReasons.push(reason); }
  };
  learn('industry', f.industry);
  learn('role', f.role);
  learn('region', f.region);
  learn('company', f.company);
  learn('signal', f.signal);
  f.highlights?.forEach(h => learn('highlight', h));
  f.companies?.slice(0, 3).forEach(c => learn('experience', c));
}

// ============================================
// SCORING
// ============================================

function score(person) {
  const f = extractFeatures(person);
  let s = 50;
  const reasons = [], warnings = [];
  
  for (const p of store.prefs) {
    const net = p.pos - p.neg;
    let match = false;
    if (p.cat === 'industry' && f.industry?.toLowerCase() === p.val.toLowerCase()) match = true;
    if (p.cat === 'role' && f.role?.toLowerCase()?.includes(p.val.toLowerCase())) match = true;
    if (p.cat === 'region' && f.region?.toLowerCase()?.includes(p.val.toLowerCase())) match = true;
    if (p.cat === 'company' && f.company?.toLowerCase()?.includes(p.val.toLowerCase())) match = true;
    if (p.cat === 'signal' && f.signal?.toLowerCase() === p.val.toLowerCase()) match = true;
    if (p.cat === 'highlight' && f.highlights?.some(h => h.toLowerCase().includes(p.val.toLowerCase()))) match = true;
    if (p.cat === 'experience' && f.companies?.some(c => c.toLowerCase().includes(p.val.toLowerCase()))) match = true;
    
    if (match) {
      if (net > 0.1) { s += net * 20; reasons.push(`✓ ${p.cat}: ${p.val}`); }
      else if (net < -0.1) { s -= Math.abs(net) * 20; warnings.push(`⚠ ${p.cat}: ${p.val}`); }
    }
  }
  
  // Embedding similarity
  if (f.text && store.liked.length > 0) {
    const emb = embed(f.text);
    const sims = store.liked.filter(e => e.emb).map(e => cosineSim(emb, e.emb));
    if (sims.length > 0) {
      const maxSim = Math.max(...sims);
      if (maxSim > 0.4) { s += maxSim * 15; reasons.push(`🔗 ${Math.round(maxSim * 100)}% similar to liked`); }
    }
  }
  
  return { score: Math.max(0, Math.min(100, Math.round(s))), reasons, warnings };
}

// ============================================
// DISPLAY
// ============================================

function showPerson(p, idx) {
  const f = extractFeatures(p);
  const { score: s, reasons, warnings } = score(p);
  const bar = '█'.repeat(Math.round(s / 10)) + '░'.repeat(10 - Math.round(s / 10));
  
  console.log(`\n┌──────────────────────────────────────────────────────────────┐`);
  console.log(`│ ${idx !== undefined ? `#${idx + 1} ` : ''}${(f.name || 'Unknown').padEnd(56).slice(0, 56)} │`);
  console.log(`├──────────────────────────────────────────────────────────────┤`);
  console.log(`│ ID:       ${(f.id || 'N/A').slice(0, 48).padEnd(48)} │`);
  console.log(`│ Role:     ${(f.role || 'N/A').slice(0, 48).padEnd(48)} │`);
  console.log(`│ Company:  ${(f.company || 'N/A').slice(0, 48).padEnd(48)} │`);
  console.log(`│ Industry: ${(f.industry || 'N/A').slice(0, 48).padEnd(48)} │`);
  console.log(`│ Region:   ${(f.region || 'N/A').slice(0, 48).padEnd(48)} │`);
  if (f.signal) console.log(`│ Signal:   ${f.signal.slice(0, 48).padEnd(48)} │`);
  if (f.highlights?.length) console.log(`│ Tags:     ${f.highlights.slice(0, 3).join(', ').slice(0, 48).padEnd(48)} │`);
  console.log(`├──────────────────────────────────────────────────────────────┤`);
  console.log(`│ 🎯 SCORE: ${s}/100 [${bar}]`.padEnd(63) + '│');
  if (reasons.length) console.log(`│ ${reasons.slice(0, 2).join(', ').slice(0, 60).padEnd(60)} │`);
  if (warnings.length) console.log(`│ ${warnings.slice(0, 2).join(', ').slice(0, 60).padEnd(60)} │`);
  console.log(`└──────────────────────────────────────────────────────────────┘`);
}

function showStats() {
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`📊 LEARNING STATS`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`   Likes: ${store.liked.length}  |  Dislikes: ${store.disliked.length}  |  Pairs: ${store.pairs.length}`);
  console.log(`   Preferences: ${store.prefs.length}  |  Total Reward: ${store.totalReward.toFixed(1)}`);
  
  const pos = store.prefs.filter(p => p.pos > p.neg).sort((a, b) => (b.pos - b.neg) - (a.pos - a.neg));
  const neg = store.prefs.filter(p => p.neg > p.pos).sort((a, b) => (b.neg - b.pos) - (a.neg - a.pos));
  
  if (pos.length) {
    console.log(`\n   ✅ PREFER:`);
    pos.slice(0, 5).forEach(p => console.log(`      ${p.cat}: ${p.val} (+${(p.pos - p.neg).toFixed(2)})`));
  }
  if (neg.length) {
    console.log(`\n   ❌ AVOID:`);
    neg.slice(0, 5).forEach(p => console.log(`      ${p.cat}: ${p.val} (-${(p.neg - p.pos).toFixed(2)})`));
  }
  console.log(`═══════════════════════════════════════════════════════════════`);
}

function showHelp() {
  console.log(`
═══════════════════════════════════════════════════════════════
📋 COMMANDS
═══════════════════════════════════════════════════════════════
  searches            List saved searches
  use <id> <type>     Set search (type: talent/people)
  fetch [n]           Fetch n results (default: 10)
  
  next / prev         Navigate people
  goto <n>            Jump to person #n
  
  like <reason>       👍 Like with reason (RL training)
  dislike <reason>    👎 Dislike with reason (RL training)
  compare             Compare current vs previous
  prefer_a <reason>   Choose previous over current
  prefer_b <reason>   Choose current over previous
  
  rank                Rank all by learned preferences
  similar             Find similar to current
  stats               Show learning stats
  prefs               Show learned preferences
  export              Export training data
  
  help                Show this help
  quit                Exit
═══════════════════════════════════════════════════════════════`);
}

// ============================================
// REPL
// ============================================

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'RL> ' });

let searchId = null, searchType = null, people = [], idx = 0;

async function cmd(line) {
  const [c, ...args] = line.trim().split(' ');
  const arg = args.join(' ');
  
  try {
    switch (c?.toLowerCase()) {
      case 'help': showHelp(); break;
      
      case 'searches': {
        console.log('\n📋 Fetching searches...');
        const all = await fetchSavedSearches();
        const talent = all.filter(s => s.product_type === 'talent');
        const ppl = all.filter(s => s.product_type === 'people');
        console.log(`\n🎯 TALENT (${talent.length}):`);
        talent.slice(0, 5).forEach(s => console.log(`   [${s.id}] ${s.name} (${s.full_count})`));
        console.log(`\n👥 PEOPLE (${ppl.length}):`);
        ppl.slice(0, 5).forEach(s => console.log(`   [${s.id}] ${s.name} (${s.full_count})`));
        console.log(`\nUse: use <id> <type>`);
        break;
      }
      
      case 'use':
        searchId = parseInt(args[0], 10);
        searchType = args[1] || 'talent';
        console.log(`✅ Active: ${searchId} (${searchType})`);
        break;
      
      case 'fetch': {
        if (!searchId) { console.log('⚠️ Set search first: use <id> <type>'); break; }
        const limit = parseInt(args[0] || '10', 10);
        console.log(`\n📋 Fetching ${limit}...`);
        const res = searchType === 'talent' 
          ? await fetchTalentSignals(searchId, { limit })
          : await fetchPeopleResults(searchId, { limit });
        people = res.items || [];
        idx = 0;
        console.log(`✅ Got ${people.length} people`);
        if (people.length) showPerson(people[0], 0);
        break;
      }
      
      case 'next':
        if (!people.length) { console.log('⚠️ Fetch first'); break; }
        idx = Math.min(idx + 1, people.length - 1);
        showPerson(people[idx], idx);
        break;
      
      case 'prev':
        if (!people.length) { console.log('⚠️ Fetch first'); break; }
        idx = Math.max(idx - 1, 0);
        showPerson(people[idx], idx);
        break;
      
      case 'goto': {
        const n = parseInt(args[0], 10) - 1;
        if (n >= 0 && n < people.length) { idx = n; showPerson(people[idx], idx); }
        else console.log(`Usage: goto <1-${people.length}>`);
        break;
      }
      
      case 'like':
        if (!people.length) { console.log('⚠️ No person'); break; }
        if (!arg) { console.log('⚠️ Provide reason: like <reason>'); break; }
        recordLike(people[idx], arg);
        console.log(`\n👍 LIKED: ${people[idx].full_name}`);
        console.log(`   Reason: ${arg}`);
        console.log(`   Reward: +${REWARD_SIGNALS.LIKE} (Total: ${store.totalReward.toFixed(1)})`);
        if (idx < people.length - 1) { idx++; showPerson(people[idx], idx); }
        break;
      
      case 'dislike':
        if (!people.length) { console.log('⚠️ No person'); break; }
        if (!arg) { console.log('⚠️ Provide reason: dislike <reason>'); break; }
        recordDislike(people[idx], arg);
        console.log(`\n👎 DISLIKED: ${people[idx].full_name}`);
        console.log(`   Reason: ${arg}`);
        console.log(`   Reward: ${REWARD_SIGNALS.DISLIKE} (Total: ${store.totalReward.toFixed(1)})`);
        if (idx < people.length - 1) { idx++; showPerson(people[idx], idx); }
        break;
      
      case 'compare':
        if (idx === 0) { console.log('⚠️ Need prev person'); break; }
        console.log(`\n🔄 A: ${people[idx - 1].full_name}`);
        console.log(`   B: ${people[idx].full_name}`);
        console.log(`\nprefer_a <reason>  or  prefer_b <reason>`);
        break;
      
      case 'prefer_a':
        if (!arg) { console.log('⚠️ Provide reason'); break; }
        recordPair(people[idx - 1], people[idx], arg);
        console.log(`✅ "${people[idx - 1].full_name}" > "${people[idx].full_name}"`);
        break;
      
      case 'prefer_b':
        if (!arg) { console.log('⚠️ Provide reason'); break; }
        recordPair(people[idx], people[idx - 1], arg);
        console.log(`✅ "${people[idx].full_name}" > "${people[idx - 1].full_name}"`);
        break;
      
      case 'rank': {
        if (!people.length) { console.log('⚠️ Fetch first'); break; }
        const ranked = people.map((p, i) => ({ p, i, ...score(p) })).sort((a, b) => b.score - a.score);
        console.log(`\n🏆 RANKED:`);
        ranked.forEach((r, i) => {
          const bar = '█'.repeat(Math.round(r.score / 10)) + '░'.repeat(10 - Math.round(r.score / 10));
          console.log(`${(i + 1).toString().padStart(2)}. ${r.score}/100 [${bar}] ${r.p.full_name}`);
        });
        break;
      }
      
      case 'similar': {
        if (!people.length || !store.liked.length) { console.log('⚠️ Need people and likes'); break; }
        const f = extractFeatures(people[idx]);
        const emb = embed(f.text);
        const sims = store.liked.filter(e => e.emb).map(e => ({ name: e.name, sim: cosineSim(emb, e.emb), reason: e.reason }))
          .sort((a, b) => b.sim - a.sim).slice(0, 5);
        console.log(`\n🔗 SIMILAR TO: ${f.name}`);
        sims.forEach(s => console.log(`   ${Math.round(s.sim * 100)}% - ${s.name} (${s.reason})`));
        break;
      }
      
      case 'stats': showStats(); break;
      
      case 'prefs':
        console.log(`\n📋 LEARNED PREFERENCES:`);
        store.prefs.sort((a, b) => Math.abs(b.pos - b.neg) - Math.abs(a.pos - a.neg)).slice(0, 15).forEach(p => {
          const net = p.pos - p.neg;
          console.log(`${net >= 0 ? '✅' : '❌'} ${p.cat}: ${p.val} (${net >= 0 ? '+' : ''}${net.toFixed(2)})`);
          if (p.posReasons[0]) console.log(`   👍 ${p.posReasons[0]}`);
          if (p.negReasons[0]) console.log(`   👎 ${p.negReasons[0]}`);
        });
        break;
      
      case 'export':
        console.log(JSON.stringify({
          format: 'dpo',
          ts: new Date().toISOString(),
          stats: { likes: store.liked.length, dislikes: store.disliked.length, pairs: store.pairs.length, reward: store.totalReward },
          pairs: store.pairs,
          rewards: store.rewards,
          prefs: store.prefs,
        }, null, 2));
        break;
      
      case 'quit': case 'exit':
        showStats();
        process.exit(0);
      
      default:
        if (c) console.log(`Unknown: ${c}. Type "help"`);
    }
  } catch (e) {
    console.error(`❌ ${e.message}`);
  }
  rl.prompt();
}

// Main
console.log(`═══════════════════════════════════════════════════════════════`);
console.log(`🧠 RL AGENT - Reinforcement Learning for Deal Sourcing`);
console.log(`═══════════════════════════════════════════════════════════════`);
console.log(`API: ${API_KEY ? '✅ ' + API_KEY.slice(0, 10) + '...' : '❌ NOT SET'}`);
console.log(`\nFeatures: Real API • Preference Learning • Embeddings • DPO`);
console.log(`\nType "help" or "searches" to start.`);
console.log(`═══════════════════════════════════════════════════════════════`);

rl.prompt();
rl.on('line', cmd);

