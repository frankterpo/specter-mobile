#!/usr/bin/env node
/**
 * RL Interactive - Test like/dislike with real Specter data
 * 
 * Usage: node scripts/rl-interactive.js
 * Commands: searches, use <id>, fetch, like <reason>, dislike <reason>, rank, stats, quit
 */

require('dotenv').config();
const readline = require('readline');

const API_KEY = process.env.EXPO_PUBLIC_SPECTER_API_KEY;
const API_BASE = 'https://app.tryspecter.com/api/v1';

// Store
const store = { liked: [], disliked: [], prefs: [], totalReward: 0, vocab: new Map(), vocabSize: 0 };

// Embed
function embed(text) {
  if (!text) return new Array(50).fill(0);
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);
  const vec = new Array(50).fill(0);
  tokens.forEach(t => { if (!store.vocab.has(t)) store.vocab.set(t, store.vocabSize++ % 50); vec[store.vocab.get(t)] += 1; });
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / mag);
}

function cosineSim(a, b) { return a.reduce((s, v, i) => s + v * b[i], 0); }

// Features
function feat(p) {
  return { id: p.id || p.person_id, name: p.full_name, signal: p.signal_type, 
    company: p.new_position_company_name || p.past_position_company_name,
    highlights: p.people_highlights || [],
    text: `${p.full_name} ${p.signal_type} ${p.new_position_company_name} ${p.people_highlights?.join(' ')}` };
}

// Learn
function updatePref(cat, val, pos, reason) {
  if (!val) return;
  let p = store.prefs.find(x => x.cat === cat && x.val.toLowerCase() === val.toLowerCase());
  if (!p) { p = { cat, val, pos: 0, neg: 0, reasons: [] }; store.prefs.push(p); }
  if (pos) p.pos += 0.2; else p.neg += 0.2;
  if (reason && !p.reasons.includes(reason)) p.reasons.push(reason);
}

function recordLike(person, reason) {
  const f = feat(person); f.emb = embed(f.text); f.reason = reason;
  store.liked.push(f); store.totalReward += 1.0;
  if (f.signal) updatePref('signal', f.signal, true, reason);
  f.highlights?.forEach(h => updatePref('highlight', h, true, reason));
  if (f.company) updatePref('company', f.company, true, reason);
}

function recordDislike(person, reason) {
  const f = feat(person); f.emb = embed(f.text); f.reason = reason;
  store.disliked.push(f); store.totalReward -= 1.0;
  if (f.signal) updatePref('signal', f.signal, false, reason);
  f.highlights?.forEach(h => updatePref('highlight', h, false, reason));
  if (f.company) updatePref('company', f.company, false, reason);
}

// Score
function score(person) {
  const f = feat(person); let s = 50; const matches = [], warnings = [];
  store.prefs.forEach(p => {
    const net = p.pos - p.neg; let match = false;
    if (p.cat === 'signal' && f.signal?.toLowerCase().includes(p.val.toLowerCase())) match = true;
    if (p.cat === 'highlight' && f.highlights?.some(h => h.toLowerCase().includes(p.val.toLowerCase()))) match = true;
    if (p.cat === 'company' && f.company?.toLowerCase().includes(p.val.toLowerCase())) match = true;
    if (match) { if (net > 0.1) { s += net * 25; matches.push(`✓ ${p.val}`); } else if (net < -0.1) { s -= Math.abs(net) * 25; warnings.push(`⚠ ${p.val}`); } }
  });
  if (store.liked.length > 0) {
    const emb = embed(f.text); const sims = store.liked.map(l => cosineSim(emb, l.emb));
    const maxSim = Math.max(...sims); if (maxSim > 0.3) { s += maxSim * 20; matches.push(`🔗 ${Math.round(maxSim * 100)}%`); }
  }
  return { score: Math.max(0, Math.min(100, Math.round(s))), matches, warnings };
}

// Display
function showPerson(p, i) {
  const f = feat(p); const { score: s, matches, warnings } = score(p);
  const bar = '█'.repeat(Math.round(s / 10)) + '░'.repeat(10 - Math.round(s / 10));
  console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
  console.log(`│ #${(i + 1).toString().padStart(2)} ${(f.name || 'Unknown').padEnd(54).slice(0, 54)} │`);
  console.log(`├─────────────────────────────────────────────────────────────┤`);
  console.log(`│ Signal:  ${(f.signal || 'N/A').padEnd(49).slice(0, 49)} │`);
  console.log(`│ Company: ${(f.company || 'N/A').padEnd(49).slice(0, 49)} │`);
  if (f.highlights?.length) console.log(`│ Tags:    ${f.highlights.slice(0, 3).join(', ').padEnd(49).slice(0, 49)} │`);
  console.log(`├─────────────────────────────────────────────────────────────┤`);
  console.log(`│ 🎯 SCORE: ${s}/100 [${bar}]`.padEnd(62) + '│');
  if (matches.length) console.log(`│ ${matches.join(' ').slice(0, 59).padEnd(59)} │`);
  if (warnings.length) console.log(`│ ${warnings.join(' ').slice(0, 59).padEnd(59)} │`);
  console.log(`└─────────────────────────────────────────────────────────────┘`);
}

// REPL
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'RL> ' });
let searchId = null, people = [], idx = 0;

async function cmd(line) {
  const [c, ...args] = line.trim().split(' '); const arg = args.join(' ');
  try {
    switch (c?.toLowerCase()) {
      case 'help':
        console.log(`\nCommands: searches, use <id>, fetch [n], next, prev, like <reason>, dislike <reason>, rank, stats, prefs, quit\n`);
        break;
      case 'searches': {
        const res = await fetch(`${API_BASE}/searches`, { headers: { 'X-API-KEY': API_KEY } });
        const all = await res.json(); const talent = all.filter(s => s.product_type === 'talent');
        console.log(`\n🎯 TALENT SEARCHES:`); talent.slice(0, 5).forEach(s => console.log(`   [${s.id}] ${s.name}`));
        console.log(`\nUse: use <id>`); break;
      }
      case 'use': searchId = parseInt(args[0], 10); console.log(`✅ Search: ${searchId}`); break;
      case 'fetch': {
        if (!searchId) { console.log('⚠️ Set search first: use <id>'); break; }
        const limit = parseInt(args[0] || '10', 10);
        const res = await fetch(`${API_BASE}/searches/talent/${searchId}/results?limit=${limit}`, { headers: { 'X-API-KEY': API_KEY } });
        const data = await res.json(); people = data.items || data.results || data; idx = 0;
        console.log(`✅ Fetched ${people.length}`); if (people.length) showPerson(people[0], 0); break;
      }
      case 'next': if (!people.length) { console.log('⚠️ Fetch first'); break; } idx = Math.min(idx + 1, people.length - 1); showPerson(people[idx], idx); break;
      case 'prev': if (!people.length) { console.log('⚠️ Fetch first'); break; } idx = Math.max(idx - 1, 0); showPerson(people[idx], idx); break;
      case 'like': {
        if (!people.length) { console.log('⚠️ No person'); break; } if (!arg) { console.log('⚠️ like <reason>'); break; }
        recordLike(people[idx], arg);
        console.log(`\n👍 LIKED: ${people[idx].full_name}\n   "${arg}"\n   Reward: +1.0 (Total: ${store.totalReward.toFixed(1)})`);
        if (idx < people.length - 1) { idx++; showPerson(people[idx], idx); } break;
      }
      case 'dislike': {
        if (!people.length) { console.log('⚠️ No person'); break; } if (!arg) { console.log('⚠️ dislike <reason>'); break; }
        recordDislike(people[idx], arg);
        console.log(`\n👎 DISLIKED: ${people[idx].full_name}\n   "${arg}"\n   Reward: -1.0 (Total: ${store.totalReward.toFixed(1)})`);
        if (idx < people.length - 1) { idx++; showPerson(people[idx], idx); } break;
      }
      case 'rank': {
        if (!people.length) { console.log('⚠️ Fetch first'); break; }
        const ranked = people.map(p => ({ p, ...score(p) })).sort((a, b) => b.score - a.score);
        console.log(`\n🏆 RANKED:`); ranked.forEach((r, i) => {
          const bar = '█'.repeat(Math.round(r.score / 10)) + '░'.repeat(10 - Math.round(r.score / 10));
          const status = store.liked.find(l => l.id === (r.p.id || r.p.person_id)) ? '👍' : store.disliked.find(d => d.id === (r.p.id || r.p.person_id)) ? '👎' : '  ';
          console.log(`${status} ${(i + 1).toString().padStart(2)}. ${r.score}/100 [${bar}] ${r.p.full_name}`);
        }); break;
      }
      case 'stats':
        console.log(`\n📊 Likes: ${store.liked.length} | Dislikes: ${store.disliked.length} | Reward: ${store.totalReward.toFixed(1)} | Prefs: ${store.prefs.length}`);
        break;
      case 'prefs':
        console.log(`\n📋 LEARNED:`);
        store.prefs.sort((a, b) => Math.abs(b.pos - b.neg) - Math.abs(a.pos - a.neg)).slice(0, 10).forEach(p => {
          const net = p.pos - p.neg; console.log(`${net >= 0 ? '✅' : '❌'} ${p.cat}: ${p.val} (${net >= 0 ? '+' : ''}${net.toFixed(2)})`);
          if (p.reasons[0]) console.log(`   "${p.reasons[0]}"`);
        }); break;
      case 'quit': case 'exit': console.log(`\n📊 Final: ${store.liked.length} likes, ${store.disliked.length} dislikes, ${store.totalReward.toFixed(1)} reward`); process.exit(0);
      default: if (c) console.log(`Unknown: ${c}. Type "help"`);
    }
  } catch (e) { console.error(`❌ ${e.message}`); }
  rl.prompt();
}

console.log(`═══════════════════════════════════════════════════════════════`);
console.log(`🧠 RL INTERACTIVE - Test Like/Dislike with Real Data`);
console.log(`═══════════════════════════════════════════════════════════════`);
console.log(`API: ${API_KEY ? '✅ ' + API_KEY.slice(0, 10) + '...' : '❌ NOT SET'}`);
console.log(`\nType "help" for commands or "searches" to start.`);
console.log(`═══════════════════════════════════════════════════════════════`);

rl.prompt(); rl.on('line', cmd);
