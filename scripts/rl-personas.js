#!/usr/bin/env node
/**
 * RL Personas - Persona-based Reinforcement Learning for Deal Sourcing
 * 
 * Like Granola's Recipes, each persona has:
 * - Isolated memory (likes/dislikes/preferences)
 * - Specific evaluation criteria
 * - Own learned preferences from feedback
 * 
 * Personas:
 * 1. Early Stage Investor - Pre-seed/Seed, first-time founders, stealth
 * 2. Growth Stage Investor - Series A-C, proven traction, scaling
 * 3. Private Equity Investor - Later stage, profitability, buyouts
 * 4. Investment Banker - M&A, IPO candidates, strategic value
 */

require('dotenv').config();
const readline = require('readline');
const fs = require('fs');

const API_KEY = process.env.EXPO_PUBLIC_SPECTER_API_KEY;
const API_BASE = 'https://app.tryspecter.com/api/v1';
const DATA_FILE = './scripts/rl-personas-data.json';

// ============================================
// PERSONA DEFINITIONS
// ============================================

const PERSONAS = {
  early: {
    id: 'early',
    name: '🌱 Early Stage Investor',
    description: 'Pre-seed/Seed, first-time founders, stealth mode, technical backgrounds',
    criteria: {
      stages: ['stealth', 'pre-seed', 'seed'],
      signals: ['new_founder', 'spinout', 'new_company'],
      highlights: ['serial_founder', 'yc_alum', 'technical', 'phd'],
      avoid: ['series_b', 'series_c', 'growth', 'ipo'],
    },
    prompts: {
      evaluate: 'Is this founder building something from scratch? Do they have technical depth? Is this early enough for seed investment?',
      like: 'What makes this founder compelling for early-stage investment?',
      dislike: 'Why is this not a fit for early-stage?',
    },
  },
  growth: {
    id: 'growth',
    name: '📈 Growth Stage Investor',
    description: 'Series A-C, proven traction, scaling teams, market expansion',
    criteria: {
      stages: ['series_a', 'series_b', 'series_c'],
      signals: ['expansion', 'hiring', 'new_market'],
      highlights: ['repeat_founder', 'scaled_before', 'revenue'],
      avoid: ['stealth', 'pre-seed', 'ipo'],
    },
    prompts: {
      evaluate: 'Does this company have product-market fit? Are they scaling? Is the team proven?',
      like: 'What traction or scaling signals make this compelling?',
      dislike: 'Why is this not ready for growth investment?',
    },
  },
  pe: {
    id: 'pe',
    name: '🏦 Private Equity Investor',
    description: 'Later stage, profitability focus, buyouts, operational improvement',
    criteria: {
      stages: ['growth', 'late_stage', 'profitable'],
      signals: ['profitability', 'market_leader', 'acquisition'],
      highlights: ['public_company_exp', 'cfo', 'operations'],
      avoid: ['stealth', 'pre-seed', 'seed', 'burning_cash'],
    },
    prompts: {
      evaluate: 'Is this a mature business? Is there operational upside? Can we improve margins?',
      like: 'What makes this attractive for PE investment?',
      dislike: 'Why is this not a PE fit?',
    },
  },
  ib: {
    id: 'ib',
    name: '🤝 Investment Banker',
    description: 'M&A candidates, IPO potential, strategic acquirers, deal flow',
    criteria: {
      stages: ['series_c', 'growth', 'pre_ipo'],
      signals: ['acquisition_target', 'ipo_ready', 'strategic_value'],
      highlights: ['market_leader', 'synergies', 'recurring_revenue'],
      avoid: ['early_stage', 'unproven'],
    },
    prompts: {
      evaluate: 'Is this an M&A target? IPO candidate? Who would acquire this?',
      like: 'What strategic value or deal potential do you see?',
      dislike: 'Why is this not actionable for IB?',
    },
  },
};

// ============================================
// MEMORY STORE (per-persona isolated)
// ============================================

let store = {
  activePersona: 'early',
  personas: {
    early: { liked: [], disliked: [], prefs: [], totalReward: 0 },
    growth: { liked: [], disliked: [], prefs: [], totalReward: 0 },
    pe: { liked: [], disliked: [], prefs: [], totalReward: 0 },
    ib: { liked: [], disliked: [], prefs: [], totalReward: 0 },
  },
  vocab: {},
  vocabSize: 0,
};

// Load persisted data
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      store = { ...store, ...data };
      console.log(`📂 Loaded data from ${DATA_FILE}`);
    }
  } catch (e) { console.log('Starting fresh (no saved data)'); }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  } catch (e) { console.error('Failed to save:', e.message); }
}

function getPersonaStore() {
  return store.personas[store.activePersona];
}

// ============================================
// EMBEDDING
// ============================================

function embed(text) {
  if (!text) return new Array(50).fill(0);
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);
  const vec = new Array(50).fill(0);
  tokens.forEach(t => {
    if (!store.vocab[t]) store.vocab[t] = store.vocabSize++ % 50;
    vec[store.vocab[t]] += 1;
  });
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / mag);
}

function cosineSim(a, b) { return a.reduce((s, v, i) => s + v * (b[i] || 0), 0); }

// ============================================
// FEATURE EXTRACTION
// ============================================

function extractFeatures(p) {
  const text = `${p.full_name} ${p.signal_type} ${p.new_position_company_name} ${p.past_position_company_name} ${(p.people_highlights || []).join(' ')} ${p.headline} ${p.about}`;
  return {
    id: p.id || p.person_id,
    name: p.full_name,
    signal: p.signal_type,
    company: p.new_position_company_name || p.past_position_company_name,
    highlights: p.people_highlights || [],
    headline: p.headline,
    text,
    raw: p, // Keep full JSON for reference
  };
}

// ============================================
// LEARNING (persona-isolated)
// ============================================

function updatePref(cat, val, positive, reason) {
  if (!val) return;
  const ps = getPersonaStore();
  let p = ps.prefs.find(x => x.cat === cat && x.val.toLowerCase() === val.toLowerCase());
  if (!p) { p = { cat, val, pos: 0, neg: 0, reasons: [] }; ps.prefs.push(p); }
  if (positive) p.pos += 0.2; else p.neg += 0.2;
  if (reason && !p.reasons.includes(reason)) p.reasons.push(reason);
}

function recordLike(person, reason) {
  const ps = getPersonaStore();
  const f = extractFeatures(person);
  f.emb = embed(f.text);
  f.reason = reason;
  f.timestamp = new Date().toISOString();
  f.persona = store.activePersona;
  ps.liked.push(f);
  ps.totalReward += 1.0;
  
  // Learn from features
  if (f.signal) updatePref('signal', f.signal, true, reason);
  f.highlights?.forEach(h => updatePref('highlight', h, true, reason));
  if (f.company) updatePref('company', f.company, true, reason);
  
  saveData();
  return f;
}

function recordDislike(person, reason) {
  const ps = getPersonaStore();
  const f = extractFeatures(person);
  f.emb = embed(f.text);
  f.reason = reason;
  f.timestamp = new Date().toISOString();
  f.persona = store.activePersona;
  ps.disliked.push(f);
  ps.totalReward -= 1.0;
  
  // Learn from features
  if (f.signal) updatePref('signal', f.signal, false, reason);
  f.highlights?.forEach(h => updatePref('highlight', h, false, reason));
  if (f.company) updatePref('company', f.company, false, reason);
  
  saveData();
  return f;
}

// ============================================
// SCORING (persona-aware)
// ============================================

function score(person) {
  const ps = getPersonaStore();
  const persona = PERSONAS[store.activePersona];
  const f = extractFeatures(person);
  let s = 50;
  const matches = [], warnings = [];
  
  // 1. Persona criteria matching
  if (persona.criteria.signals?.some(sig => f.signal?.toLowerCase().includes(sig))) {
    s += 10;
    matches.push(`✓ ${persona.name.split(' ')[0]} signal`);
  }
  if (persona.criteria.highlights?.some(h => f.highlights?.some(fh => fh.toLowerCase().includes(h)))) {
    s += 10;
    matches.push(`✓ ${persona.name.split(' ')[0]} highlight`);
  }
  if (persona.criteria.avoid?.some(a => f.text.toLowerCase().includes(a))) {
    s -= 15;
    warnings.push(`⚠ Not ideal for ${persona.name.split(' ')[0]}`);
  }
  
  // 2. Learned preference matching
  ps.prefs.forEach(p => {
    const net = p.pos - p.neg;
    let match = false;
    if (p.cat === 'signal' && f.signal?.toLowerCase().includes(p.val.toLowerCase())) match = true;
    if (p.cat === 'highlight' && f.highlights?.some(h => h.toLowerCase().includes(p.val.toLowerCase()))) match = true;
    if (p.cat === 'company' && f.company?.toLowerCase().includes(p.val.toLowerCase())) match = true;
    
    if (match) {
      if (net > 0.1) { s += net * 20; matches.push(`✓ ${p.val}`); }
      else if (net < -0.1) { s -= Math.abs(net) * 20; warnings.push(`⚠ ${p.val}`); }
    }
  });
  
  // 3. Embedding similarity to liked
  if (ps.liked.length > 0) {
    const emb = embed(f.text);
    const sims = ps.liked.filter(l => l.emb).map(l => cosineSim(emb, l.emb));
    if (sims.length > 0) {
      const maxSim = Math.max(...sims);
      if (maxSim > 0.3) { s += maxSim * 15; matches.push(`🔗 ${Math.round(maxSim * 100)}%`); }
    }
  }
  
  return { score: Math.max(0, Math.min(100, Math.round(s))), matches, warnings };
}

// ============================================
// DISPLAY
// ============================================

function showPersona() {
  const p = PERSONAS[store.activePersona];
  const ps = getPersonaStore();
  console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
  console.log(`║ ${p.name.padEnd(61)} ║`);
  console.log(`╠═══════════════════════════════════════════════════════════════╣`);
  console.log(`║ ${p.description.slice(0, 61).padEnd(61)} ║`);
  console.log(`║ Likes: ${ps.liked.length.toString().padEnd(5)} Dislikes: ${ps.disliked.length.toString().padEnd(5)} Reward: ${ps.totalReward.toFixed(1).padEnd(6)} Prefs: ${ps.prefs.length.toString().padEnd(4)} ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════╝`);
}

function showPerson(p, i) {
  const f = extractFeatures(p);
  const { score: s, matches, warnings } = score(p);
  const bar = '█'.repeat(Math.round(s / 10)) + '░'.repeat(10 - Math.round(s / 10));
  
  console.log(`\n┌─────────────────────────────────────────────────────────────────┐`);
  console.log(`│ #${(i + 1).toString().padStart(2)} ${(f.name || 'Unknown').padEnd(58).slice(0, 58)} │`);
  console.log(`├─────────────────────────────────────────────────────────────────┤`);
  console.log(`│ ID:        ${(f.id || 'N/A').slice(0, 51).padEnd(51)} │`);
  console.log(`│ Signal:    ${(f.signal || 'N/A').slice(0, 51).padEnd(51)} │`);
  console.log(`│ Company:   ${(f.company || 'N/A').slice(0, 51).padEnd(51)} │`);
  if (f.highlights?.length) console.log(`│ Highlights: ${f.highlights.slice(0, 3).join(', ').slice(0, 50).padEnd(50)} │`);
  if (f.headline) console.log(`│ Headline:  ${f.headline.slice(0, 51).padEnd(51)} │`);
  console.log(`├─────────────────────────────────────────────────────────────────┤`);
  console.log(`│ 🎯 SCORE: ${s}/100 [${bar}]`.padEnd(66) + '│');
  if (matches.length) console.log(`│ ${matches.slice(0, 3).join(' ').slice(0, 63).padEnd(63)} │`);
  if (warnings.length) console.log(`│ ${warnings.slice(0, 2).join(' ').slice(0, 63).padEnd(63)} │`);
  console.log(`└─────────────────────────────────────────────────────────────────┘`);
}

function showJSON(p) {
  const f = extractFeatures(p);
  console.log(`\n📋 FULL JSON for ${f.name}:`);
  console.log('─'.repeat(65));
  console.log(JSON.stringify(f.raw, null, 2));
  console.log('─'.repeat(65));
  console.log('Use this JSON to reference specific fields in your like/dislike reason.');
}

function showHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║ 📋 COMMANDS                                                   ║
╠═══════════════════════════════════════════════════════════════╣
║ PERSONAS:                                                     ║
║   persona              Show current persona                   ║
║   early                Switch to Early Stage Investor         ║
║   growth               Switch to Growth Stage Investor        ║
║   pe                   Switch to Private Equity Investor      ║
║   ib                   Switch to Investment Banker            ║
║                                                               ║
║ DATA:                                                         ║
║   searches             List saved searches                    ║
║   use <id>             Set active search                      ║
║   fetch [n]            Fetch n results                        ║
║   next / prev          Navigate                               ║
║   json                 Show full JSON of current person       ║
║                                                               ║
║ FEEDBACK (RL):                                                ║
║   like <reason>        👍 Like with reason                    ║
║   dislike <reason>     👎 Dislike with reason                 ║
║                                                               ║
║ ANALYSIS:                                                     ║
║   rank                 Rank by persona score                  ║
║   stats                Show persona stats                     ║
║   prefs                Show learned preferences               ║
║   export               Export training data                   ║
║                                                               ║
║   help                 Show this help                         ║
║   quit                 Exit                                   ║
╚═══════════════════════════════════════════════════════════════╝`);
}

// ============================================
// REPL
// ============================================

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '' });

let searchId = null, people = [], idx = 0;

function updatePrompt() {
  const p = PERSONAS[store.activePersona];
  rl.setPrompt(`${p.name.split(' ')[0]}> `);
}

async function cmd(line) {
  const [c, ...args] = line.trim().split(' ');
  const arg = args.join(' ');
  
  try {
    switch (c?.toLowerCase()) {
      case 'help': showHelp(); break;
      
      case 'persona': showPersona(); break;
      
      case 'early': case 'growth': case 'pe': case 'ib':
        store.activePersona = c.toLowerCase();
        saveData();
        showPersona();
        console.log(`\n💡 Tip: ${PERSONAS[c].prompts.evaluate}`);
        break;
      
      case 'searches': {
        console.log('\n📋 Fetching searches...');
        const res = await fetch(`${API_BASE}/searches`, { headers: { 'X-API-KEY': API_KEY } });
        const all = await res.json();
        const talent = all.filter(s => s.product_type === 'talent');
        console.log(`\n🎯 TALENT SEARCHES:`);
        talent.slice(0, 8).forEach(s => console.log(`   [${s.id}] ${s.name} (${s.full_count})`));
        console.log(`\nUse: use <id>`);
        break;
      }
      
      case 'use':
        searchId = parseInt(args[0], 10);
        console.log(`✅ Search: ${searchId}`);
        break;
      
      case 'fetch': {
        if (!searchId) { console.log('⚠️ Set search first: use <id>'); break; }
        const limit = parseInt(args[0] || '10', 10);
        console.log(`\n📋 Fetching ${limit}...`);
        const res = await fetch(`${API_BASE}/searches/talent/${searchId}/results?limit=${limit}`, { headers: { 'X-API-KEY': API_KEY } });
        const data = await res.json();
        people = data.items || data.results || data;
        idx = 0;
        console.log(`✅ Got ${people.length} people`);
        if (people.length) { showPersona(); showPerson(people[0], 0); }
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
      
      case 'json':
        if (!people.length) { console.log('⚠️ Fetch first'); break; }
        showJSON(people[idx]);
        break;
      
      case 'like': {
        if (!people.length) { console.log('⚠️ No person'); break; }
        if (!arg) { console.log(`⚠️ Provide reason. Hint: ${PERSONAS[store.activePersona].prompts.like}`); break; }
        const f = recordLike(people[idx], arg);
        console.log(`\n👍 LIKED (${PERSONAS[store.activePersona].name}):`);
        console.log(`   ${f.name}`);
        console.log(`   Reason: "${arg}"`);
        console.log(`   Reward: +1.0 (Total: ${getPersonaStore().totalReward.toFixed(1)})`);
        if (idx < people.length - 1) { idx++; console.log('\n📍 Next:'); showPerson(people[idx], idx); }
        break;
      }
      
      case 'dislike': {
        if (!people.length) { console.log('⚠️ No person'); break; }
        if (!arg) { console.log(`⚠️ Provide reason. Hint: ${PERSONAS[store.activePersona].prompts.dislike}`); break; }
        const f = recordDislike(people[idx], arg);
        console.log(`\n👎 DISLIKED (${PERSONAS[store.activePersona].name}):`);
        console.log(`   ${f.name}`);
        console.log(`   Reason: "${arg}"`);
        console.log(`   Reward: -1.0 (Total: ${getPersonaStore().totalReward.toFixed(1)})`);
        if (idx < people.length - 1) { idx++; console.log('\n📍 Next:'); showPerson(people[idx], idx); }
        break;
      }
      
      case 'rank': {
        if (!people.length) { console.log('⚠️ Fetch first'); break; }
        const ps = getPersonaStore();
        const ranked = people.map(p => ({ p, ...score(p) })).sort((a, b) => b.score - a.score);
        console.log(`\n🏆 RANKED for ${PERSONAS[store.activePersona].name}:`);
        ranked.forEach((r, i) => {
          const bar = '█'.repeat(Math.round(r.score / 10)) + '░'.repeat(10 - Math.round(r.score / 10));
          const status = ps.liked.find(l => l.id === (r.p.id || r.p.person_id)) ? '👍' :
                         ps.disliked.find(d => d.id === (r.p.id || r.p.person_id)) ? '👎' : '  ';
          console.log(`${status} ${(i + 1).toString().padStart(2)}. ${r.score}/100 [${bar}] ${r.p.full_name}`);
        });
        break;
      }
      
      case 'stats': {
        console.log(`\n📊 ALL PERSONAS STATS:`);
        console.log('─'.repeat(65));
        Object.entries(PERSONAS).forEach(([id, p]) => {
          const ps = store.personas[id];
          const active = id === store.activePersona ? '→' : ' ';
          console.log(`${active} ${p.name.padEnd(30)} Likes: ${ps.liked.length.toString().padEnd(3)} Dislikes: ${ps.disliked.length.toString().padEnd(3)} Reward: ${ps.totalReward.toFixed(1)}`);
        });
        break;
      }
      
      case 'prefs': {
        const ps = getPersonaStore();
        console.log(`\n📋 LEARNED PREFERENCES for ${PERSONAS[store.activePersona].name}:`);
        console.log('─'.repeat(65));
        if (ps.prefs.length === 0) {
          console.log('No preferences learned yet. Like/dislike some people!');
        } else {
          ps.prefs.sort((a, b) => Math.abs(b.pos - b.neg) - Math.abs(a.pos - a.neg)).slice(0, 12).forEach(p => {
            const net = p.pos - p.neg;
            console.log(`${net >= 0 ? '✅' : '❌'} ${p.cat}: ${p.val} (${net >= 0 ? '+' : ''}${net.toFixed(2)})`);
            if (p.reasons[0]) console.log(`   "${p.reasons[0]}"`);
          });
        }
        break;
      }
      
      case 'export': {
        const data = {
          format: 'dpo_persona_training',
          exportedAt: new Date().toISOString(),
          personas: Object.entries(store.personas).map(([id, ps]) => ({
            persona: id,
            name: PERSONAS[id].name,
            likes: ps.liked.length,
            dislikes: ps.disliked.length,
            totalReward: ps.totalReward,
            prefs: ps.prefs,
            trainingPairs: ps.liked.map(l => ({
              chosen: { id: l.id, name: l.name, reason: l.reason },
              rejected: ps.disliked.length > 0 ? { id: ps.disliked[0].id, name: ps.disliked[0].name } : null,
            })),
          })),
        };
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'quit': case 'exit':
        console.log(`\n📊 Final Stats:`);
        Object.entries(PERSONAS).forEach(([id, p]) => {
          const ps = store.personas[id];
          console.log(`   ${p.name}: ${ps.liked.length} likes, ${ps.disliked.length} dislikes`);
        });
        saveData();
        process.exit(0);
      
      default:
        if (c) console.log(`Unknown: ${c}. Type "help"`);
    }
  } catch (e) {
    console.error(`❌ ${e.message}`);
  }
  
  updatePrompt();
  rl.prompt();
}

// Main
loadData();
console.log(`╔═══════════════════════════════════════════════════════════════╗`);
console.log(`║ 🧠 RL PERSONAS - Persona-based Reinforcement Learning        ║`);
console.log(`╠═══════════════════════════════════════════════════════════════╣`);
console.log(`║ Like Granola's Recipes, each persona has isolated memory.    ║`);
console.log(`║ Your likes/dislikes train ONLY the active persona.           ║`);
console.log(`╠═══════════════════════════════════════════════════════════════╣`);
console.log(`║ Personas: early, growth, pe, ib                              ║`);
console.log(`║ Commands: help, searches, fetch, like, dislike, rank         ║`);
console.log(`╚═══════════════════════════════════════════════════════════════╝`);
console.log(`API: ${API_KEY ? '✅ ' + API_KEY.slice(0, 10) + '...' : '❌ NOT SET'}`);

showPersona();
updatePrompt();
rl.prompt();
rl.on('line', cmd);

