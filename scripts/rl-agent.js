#!/usr/bin/env node
/**
 * RL Agent - Terminal-based Reinforcement Learning for Deal Sourcing
 * 
 * Features:
 * 1. Real Specter API data
 * 2. Preference learning with reasons
 * 3. Semantic embeddings for similarity matching
 * 4. DPO-style preference pairs
 * 5. 100% offline scoring capability
 */

require('dotenv').config();
const readline = require('readline');
const crypto = require('crypto');

// API imports
const {
  fetchSavedSearches,
  fetchTalentSignals,
  fetchPeopleSavedSearchResults,
  fetchPersonDetail,
} = require('../src/api/specter');

const API_KEY = process.env.EXPO_PUBLIC_SPECTER_API_KEY;

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
// SIMPLE EMBEDDING (TF-IDF style for terminal)
// ============================================

const vocabulary = new Map();
let vocabSize = 0;

function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function getOrCreateVocabIndex(token) {
  if (!vocabulary.has(token)) {
    vocabulary.set(token, vocabSize++);
  }
  return vocabulary.get(token);
}

function embed(text) {
  const tokens = tokenize(text);
  const vector = new Array(100).fill(0); // Fixed size for simplicity
  
  tokens.forEach(token => {
    const idx = getOrCreateVocabIndex(token) % 100;
    vector[idx] += 1;
  });
  
  // Normalize
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map(v => v / magnitude);
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

// ============================================
// PREFERENCE STORE
// ============================================

const store = {
  likedEntities: [],
  dislikedEntities: [],
  learnedPreferences: [],
  preferencePairs: [],
  rewardHistory: [],
  totalReward: 0,
  embeddings: new Map(), // entityId -> embedding
};

// ============================================
// FEATURE EXTRACTION
// ============================================

function extractFeatures(person) {
  const currentJob = person.experience?.find(e => e.is_current);
  return {
    id: person.id || person.person_id,
    name: person.full_name,
    seniority: currentJob?.title || person.headline?.split(' at ')[0],
    industry: person.industries?.[0] || inferIndustry(person),
    region: person.city || person.country,
    company: currentJob?.company_name,
    highlights: person.people_highlights || [],
    companies: person.experience?.map(e => e.company_name).filter(Boolean) || [],
    signalType: person.signal_type,
    fundingStage: person.funding_stage,
    // For embedding
    textForEmbedding: buildTextForEmbedding(person),
  };
}

function inferIndustry(person) {
  const text = `${person.headline || ''} ${person.about || ''}`.toLowerCase();
  if (text.includes('ai') || text.includes('machine learning') || text.includes('artificial')) return 'AI';
  if (text.includes('fintech') || text.includes('financial') || text.includes('banking')) return 'Fintech';
  if (text.includes('health') || text.includes('medical') || text.includes('bio')) return 'Healthcare';
  if (text.includes('saas') || text.includes('software') || text.includes('enterprise')) return 'SaaS';
  if (text.includes('crypto') || text.includes('blockchain') || text.includes('web3')) return 'Crypto';
  return 'Tech';
}

function buildTextForEmbedding(person) {
  const parts = [
    person.full_name,
    person.headline,
    person.about,
    person.people_highlights?.join(' '),
    person.experience?.map(e => `${e.title} ${e.company_name}`).join(' '),
  ].filter(Boolean);
  return parts.join(' ');
}

// ============================================
// LEARNING FUNCTIONS
// ============================================

function recordLike(entity, reason) {
  const features = typeof entity === 'object' && entity.features ? entity.features : extractFeatures(entity);
  const id = features.id || entity.id;
  
  // Store embedding
  if (features.textForEmbedding) {
    store.embeddings.set(id, embed(features.textForEmbedding));
  }
  
  store.likedEntities.push({
    id,
    name: features.name,
    features,
    reason,
    timestamp: new Date().toISOString(),
    embedding: store.embeddings.get(id),
  });
  
  store.totalReward += REWARD_SIGNALS.LIKE;
  learnFromFeatures(features, true, reason);
  
  store.rewardHistory.push({
    timestamp: new Date().toISOString(),
    entityId: id,
    action: 'LIKE',
    reward: REWARD_SIGNALS.LIKE,
    reason,
  });
  
  return { reward: REWARD_SIGNALS.LIKE, totalReward: store.totalReward };
}

function recordDislike(entity, reason) {
  const features = typeof entity === 'object' && entity.features ? entity.features : extractFeatures(entity);
  const id = features.id || entity.id;
  
  // Store embedding
  if (features.textForEmbedding) {
    store.embeddings.set(id, embed(features.textForEmbedding));
  }
  
  store.dislikedEntities.push({
    id,
    name: features.name,
    features,
    reason,
    timestamp: new Date().toISOString(),
    embedding: store.embeddings.get(id),
  });
  
  store.totalReward += REWARD_SIGNALS.DISLIKE;
  learnFromFeatures(features, false, reason);
  
  store.rewardHistory.push({
    timestamp: new Date().toISOString(),
    entityId: id,
    action: 'DISLIKE',
    reward: REWARD_SIGNALS.DISLIKE,
    reason,
  });
  
  return { reward: REWARD_SIGNALS.DISLIKE, totalReward: store.totalReward };
}

function recordPreferencePair(chosen, rejected, reason) {
  store.preferencePairs.push({
    id: `pair_${Date.now()}`,
    timestamp: new Date().toISOString(),
    chosen: { id: chosen.id, name: chosen.name || chosen.full_name, features: extractFeatures(chosen) },
    rejected: { id: rejected.id, name: rejected.name || rejected.full_name, features: extractFeatures(rejected) },
    reason,
  });
}

function learnFromFeatures(features, isPositive, reason) {
  const categories = [
    ['industry', features.industry],
    ['seniority', features.seniority],
    ['region', features.region],
    ['company', features.company],
    ['signalType', features.signalType],
  ];
  
  categories.forEach(([cat, val]) => {
    if (val) updatePreference(cat, val, isPositive, reason);
  });
  
  features.highlights?.forEach(h => updatePreference('highlight', h, isPositive, reason));
  features.companies?.slice(0, 3).forEach(c => updatePreference('experience', c, isPositive, reason));
}

function updatePreference(category, value, isPositive, reason) {
  if (!value) return;
  
  let pref = store.learnedPreferences.find(
    p => p.category === category && p.value.toLowerCase() === value.toLowerCase()
  );
  
  if (!pref) {
    pref = {
      category,
      value,
      positiveWeight: 0,
      negativeWeight: 0,
      positiveReasons: [],
      negativeReasons: [],
    };
    store.learnedPreferences.push(pref);
  }
  
  if (isPositive) {
    pref.positiveWeight += 0.15;
    if (reason && !pref.positiveReasons.includes(reason)) {
      pref.positiveReasons.push(reason);
    }
  } else {
    pref.negativeWeight += 0.15;
    if (reason && !pref.negativeReasons.includes(reason)) {
      pref.negativeReasons.push(reason);
    }
  }
}

// ============================================
// SCORING WITH EMBEDDINGS
// ============================================

function scoreEntity(entity) {
  const features = typeof entity === 'object' && entity.features ? entity.features : extractFeatures(entity);
  let score = 50;
  const reasons = [];
  const warnings = [];
  
  // 1. Feature-based scoring
  for (const pref of store.learnedPreferences) {
    const netWeight = pref.positiveWeight - pref.negativeWeight;
    let matches = false;
    
    if (pref.category === 'industry' && features.industry?.toLowerCase() === pref.value.toLowerCase()) matches = true;
    if (pref.category === 'seniority' && features.seniority?.toLowerCase()?.includes(pref.value.toLowerCase())) matches = true;
    if (pref.category === 'region' && features.region?.toLowerCase()?.includes(pref.value.toLowerCase())) matches = true;
    if (pref.category === 'company' && features.company?.toLowerCase()?.includes(pref.value.toLowerCase())) matches = true;
    if (pref.category === 'signalType' && features.signalType?.toLowerCase() === pref.value.toLowerCase()) matches = true;
    if (pref.category === 'highlight' && features.highlights?.some(h => h.toLowerCase().includes(pref.value.toLowerCase()))) matches = true;
    if (pref.category === 'experience' && features.companies?.some(c => c.toLowerCase().includes(pref.value.toLowerCase()))) matches = true;
    
    if (matches) {
      if (netWeight > 0.1) {
        score += netWeight * 20;
        reasons.push(`✓ ${pref.category}: ${pref.value}`);
      } else if (netWeight < -0.1) {
        score -= Math.abs(netWeight) * 20;
        warnings.push(`⚠ ${pref.category}: ${pref.value}`);
      }
    }
  }
  
  // 2. Embedding-based similarity scoring
  if (features.textForEmbedding && store.likedEntities.length > 0) {
    const entityEmb = embed(features.textForEmbedding);
    
    // Compare to liked entities
    const likedSimilarities = store.likedEntities
      .filter(e => e.embedding)
      .map(e => cosineSimilarity(entityEmb, e.embedding));
    
    if (likedSimilarities.length > 0) {
      const avgLikedSim = likedSimilarities.reduce((a, b) => a + b, 0) / likedSimilarities.length;
      const maxLikedSim = Math.max(...likedSimilarities);
      
      if (maxLikedSim > 0.5) {
        score += maxLikedSim * 15;
        reasons.push(`🔗 Similar to liked (${Math.round(maxLikedSim * 100)}%)`);
      }
    }
    
    // Compare to disliked entities
    const dislikedSimilarities = store.dislikedEntities
      .filter(e => e.embedding)
      .map(e => cosineSimilarity(entityEmb, e.embedding));
    
    if (dislikedSimilarities.length > 0) {
      const maxDislikedSim = Math.max(...dislikedSimilarities);
      
      if (maxDislikedSim > 0.5) {
        score -= maxDislikedSim * 15;
        warnings.push(`🔗 Similar to disliked (${Math.round(maxDislikedSim * 100)}%)`);
      }
    }
  }
  
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    warnings,
  };
}

// ============================================
// DISPLAY HELPERS
// ============================================

function displayPerson(person, index) {
  const features = extractFeatures(person);
  const { score, reasons, warnings } = scoreEntity(person);
  const scoreBar = '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10));
  
  console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
  console.log(`│ ${index !== undefined ? `#${index + 1} ` : ''}${features.name.padEnd(55).slice(0, 55)} │`);
  console.log(`├─────────────────────────────────────────────────────────────┤`);
  console.log(`│ ID:        ${(features.id || 'N/A').slice(0, 47).padEnd(47)} │`);
  console.log(`│ Role:      ${(features.seniority || 'N/A').slice(0, 47).padEnd(47)} │`);
  console.log(`│ Company:   ${(features.company || 'N/A').slice(0, 47).padEnd(47)} │`);
  console.log(`│ Industry:  ${(features.industry || 'N/A').slice(0, 47).padEnd(47)} │`);
  console.log(`│ Region:    ${(features.region || 'N/A').slice(0, 47).padEnd(47)} │`);
  if (features.signalType) {
    console.log(`│ Signal:    ${features.signalType.slice(0, 47).padEnd(47)} │`);
  }
  if (features.highlights?.length > 0) {
    console.log(`│ Highlights: ${features.highlights.slice(0, 3).join(', ').slice(0, 46).padEnd(46)} │`);
  }
  console.log(`├─────────────────────────────────────────────────────────────┤`);
  console.log(`│ 🎯 SCORE: ${score}/100 [${scoreBar}]`.padEnd(62) + '│');
  if (reasons.length > 0) {
    console.log(`│ Matches: ${reasons.slice(0, 3).join(', ').slice(0, 49).padEnd(49)} │`);
  }
  if (warnings.length > 0) {
    console.log(`│ Concerns: ${warnings.slice(0, 3).join(', ').slice(0, 48).padEnd(48)} │`);
  }
  console.log(`└─────────────────────────────────────────────────────────────┘`);
}

function displayStats() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 LEARNING STATS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Likes:        ${store.likedEntities.length}`);
  console.log(`   Dislikes:     ${store.dislikedEntities.length}`);
  console.log(`   Pairs:        ${store.preferencePairs.length}`);
  console.log(`   Preferences:  ${store.learnedPreferences.length}`);
  console.log(`   Total Reward: ${store.totalReward.toFixed(1)}`);
  
  const positivePrefs = store.learnedPreferences
    .filter(p => p.positiveWeight > p.negativeWeight)
    .sort((a, b) => (b.positiveWeight - b.negativeWeight) - (a.positiveWeight - a.negativeWeight));
  
  const negativePrefs = store.learnedPreferences
    .filter(p => p.negativeWeight > p.positiveWeight)
    .sort((a, b) => (b.negativeWeight - b.positiveWeight) - (a.negativeWeight - a.positiveWeight));
  
  if (positivePrefs.length > 0) {
    console.log('\n   ✅ PREFER:');
    positivePrefs.slice(0, 5).forEach(p => {
      const net = (p.positiveWeight - p.negativeWeight).toFixed(2);
      console.log(`      ${p.category}: ${p.value} (+${net})`);
    });
  }
  
  if (negativePrefs.length > 0) {
    console.log('\n   ❌ AVOID:');
    negativePrefs.slice(0, 5).forEach(p => {
      const net = (p.negativeWeight - p.positiveWeight).toFixed(2);
      console.log(`      ${p.category}: ${p.value} (-${net})`);
    });
  }
  console.log('═══════════════════════════════════════════════════════════════');
}

function displayHelp() {
  console.log(`
═══════════════════════════════════════════════════════════════
📋 COMMANDS
═══════════════════════════════════════════════════════════════

NAVIGATION:
  searches              List all saved searches
  use <id> <type>       Set active search (type: talent/people)
  fetch [limit]         Fetch results from active search
  next                  Show next person
  prev                  Show previous person
  goto <n>              Go to person #n

FEEDBACK (RL Training):
  like <reason>         Like current person with reason
  dislike <reason>      Dislike current person with reason
  compare               Compare current vs previous (creates pair)

ANALYSIS:
  score                 Re-score current person
  rank                  Rank all fetched people by score
  similar               Find similar to current (using embeddings)

MEMORY:
  stats                 Show learning stats
  prefs                 Show learned preferences
  export                Export training data (DPO format)
  clear                 Clear all learned preferences

OTHER:
  help                  Show this help
  quit                  Exit

═══════════════════════════════════════════════════════════════`);
}

// ============================================
// MAIN REPL
// ============================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'RL> ',
});

let activeSearchId = null;
let activeSearchType = null;
let fetchedPeople = [];
let currentIndex = 0;

async function handleCommand(line) {
  const [cmd, ...args] = line.trim().split(' ');
  const argStr = args.join(' ');
  
  try {
    switch (cmd.toLowerCase()) {
      case 'help':
        displayHelp();
        break;
        
      case 'searches': {
        console.log('\n📋 Fetching saved searches...');
        const searches = await fetchSavedSearches(API_KEY);
        const talentSearches = searches.filter(s => s.product_type === 'talent');
        const peopleSearches = searches.filter(s => s.product_type === 'people');
        
        console.log(`\n🎯 TALENT SIGNALS (${talentSearches.length}):`);
        talentSearches.slice(0, 5).forEach(s => {
          console.log(`   [${s.id}] ${s.name} (${s.full_count} results)`);
        });
        
        console.log(`\n👥 PEOPLE SEARCHES (${peopleSearches.length}):`);
        peopleSearches.slice(0, 5).forEach(s => {
          console.log(`   [${s.id}] ${s.name} (${s.full_count} results)`);
        });
        
        console.log('\nUse: use <id> <type>  (e.g., "use 4991 talent")');
        break;
      }
      
      case 'use': {
        activeSearchId = parseInt(args[0], 10);
        activeSearchType = args[1] || 'talent';
        if (isNaN(activeSearchId)) {
          console.log('Usage: use <search_id> <type>');
        } else {
          console.log(`✅ Active search: ${activeSearchId} (${activeSearchType})`);
        }
        break;
      }
      
      case 'fetch': {
        if (!activeSearchId) {
          console.log('⚠️  Set active search first: use <id> <type>');
          break;
        }
        
        const limit = parseInt(args[0] || '10', 10);
        console.log(`\n📋 Fetching ${limit} results...`);
        
        let results;
        if (activeSearchType === 'talent') {
          results = await fetchTalentSignals(API_KEY, activeSearchId, { limit });
        } else {
          results = await fetchPeopleSavedSearchResults(API_KEY, activeSearchId, { limit });
        }
        
        fetchedPeople = results.items || [];
        currentIndex = 0;
        
        console.log(`✅ Fetched ${fetchedPeople.length} people (Total: ${results.total})`);
        
        if (fetchedPeople.length > 0) {
          displayPerson(fetchedPeople[0], 0);
        }
        break;
      }
      
      case 'next': {
        if (fetchedPeople.length === 0) {
          console.log('⚠️  No people fetched. Use "fetch" first.');
          break;
        }
        currentIndex = Math.min(currentIndex + 1, fetchedPeople.length - 1);
        displayPerson(fetchedPeople[currentIndex], currentIndex);
        break;
      }
      
      case 'prev': {
        if (fetchedPeople.length === 0) {
          console.log('⚠️  No people fetched. Use "fetch" first.');
          break;
        }
        currentIndex = Math.max(currentIndex - 1, 0);
        displayPerson(fetchedPeople[currentIndex], currentIndex);
        break;
      }
      
      case 'goto': {
        const idx = parseInt(args[0], 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= fetchedPeople.length) {
          console.log(`Usage: goto <1-${fetchedPeople.length}>`);
          break;
        }
        currentIndex = idx;
        displayPerson(fetchedPeople[currentIndex], currentIndex);
        break;
      }
      
      case 'like': {
        if (fetchedPeople.length === 0) {
          console.log('⚠️  No person selected.');
          break;
        }
        if (!argStr) {
          console.log('⚠️  Please provide a reason: like <reason>');
          break;
        }
        
        const person = fetchedPeople[currentIndex];
        const result = recordLike(person, argStr);
        console.log(`\n👍 LIKED: ${person.full_name}`);
        console.log(`   Reason: ${argStr}`);
        console.log(`   Reward: +${REWARD_SIGNALS.LIKE} (Total: ${result.totalReward.toFixed(1)})`);
        
        // Auto-advance
        if (currentIndex < fetchedPeople.length - 1) {
          currentIndex++;
          console.log('\n📍 Next person:');
          displayPerson(fetchedPeople[currentIndex], currentIndex);
        }
        break;
      }
      
      case 'dislike': {
        if (fetchedPeople.length === 0) {
          console.log('⚠️  No person selected.');
          break;
        }
        if (!argStr) {
          console.log('⚠️  Please provide a reason: dislike <reason>');
          break;
        }
        
        const person = fetchedPeople[currentIndex];
        const result = recordDislike(person, argStr);
        console.log(`\n👎 DISLIKED: ${person.full_name}`);
        console.log(`   Reason: ${argStr}`);
        console.log(`   Reward: ${REWARD_SIGNALS.DISLIKE} (Total: ${result.totalReward.toFixed(1)})`);
        
        // Auto-advance
        if (currentIndex < fetchedPeople.length - 1) {
          currentIndex++;
          console.log('\n📍 Next person:');
          displayPerson(fetchedPeople[currentIndex], currentIndex);
        }
        break;
      }
      
      case 'compare': {
        if (currentIndex === 0) {
          console.log('⚠️  Need previous person to compare. Go to index > 0.');
          break;
        }
        
        const current = fetchedPeople[currentIndex];
        const prev = fetchedPeople[currentIndex - 1];
        
        console.log(`\n🔄 COMPARE:`);
        console.log(`   A: ${prev.full_name}`);
        console.log(`   B: ${current.full_name}`);
        console.log(`\nWhich is better? Type:`);
        console.log(`   prefer_a <reason>  - Choose ${prev.full_name}`);
        console.log(`   prefer_b <reason>  - Choose ${current.full_name}`);
        break;
      }
      
      case 'prefer_a': {
        if (!argStr) {
          console.log('⚠️  Please provide a reason: prefer_a <reason>');
          break;
        }
        const current = fetchedPeople[currentIndex];
        const prev = fetchedPeople[currentIndex - 1];
        recordPreferencePair(prev, current, argStr);
        console.log(`✅ Recorded: "${prev.full_name}" > "${current.full_name}"`);
        console.log(`   Reason: ${argStr}`);
        break;
      }
      
      case 'prefer_b': {
        if (!argStr) {
          console.log('⚠️  Please provide a reason: prefer_b <reason>');
          break;
        }
        const current = fetchedPeople[currentIndex];
        const prev = fetchedPeople[currentIndex - 1];
        recordPreferencePair(current, prev, argStr);
        console.log(`✅ Recorded: "${current.full_name}" > "${prev.full_name}"`);
        console.log(`   Reason: ${argStr}`);
        break;
      }
      
      case 'score': {
        if (fetchedPeople.length === 0) {
          console.log('⚠️  No person selected.');
          break;
        }
        displayPerson(fetchedPeople[currentIndex], currentIndex);
        break;
      }
      
      case 'rank': {
        if (fetchedPeople.length === 0) {
          console.log('⚠️  No people fetched.');
          break;
        }
        
        const ranked = fetchedPeople
          .map((p, i) => ({ person: p, originalIndex: i, ...scoreEntity(p) }))
          .sort((a, b) => b.score - a.score);
        
        console.log('\n🏆 RANKED BY PREFERENCE SCORE:');
        console.log('────────────────────────────────────────────────────────────────');
        ranked.forEach((r, i) => {
          const bar = '█'.repeat(Math.round(r.score / 10)) + '░'.repeat(10 - Math.round(r.score / 10));
          const features = extractFeatures(r.person);
          console.log(`${(i + 1).toString().padStart(2)}. ${r.score}/100 [${bar}] ${features.name}`);
          if (r.reasons.length > 0) {
            console.log(`    ${r.reasons.slice(0, 2).join(', ')}`);
          }
        });
        break;
      }
      
      case 'similar': {
        if (fetchedPeople.length === 0 || store.likedEntities.length === 0) {
          console.log('⚠️  Need fetched people and liked entities.');
          break;
        }
        
        const current = fetchedPeople[currentIndex];
        const currentFeatures = extractFeatures(current);
        const currentEmb = embed(currentFeatures.textForEmbedding);
        
        console.log(`\n🔗 SIMILAR TO: ${currentFeatures.name}`);
        console.log('────────────────────────────────────────────────────────────────');
        
        const similarities = store.likedEntities
          .filter(e => e.embedding)
          .map(e => ({
            name: e.name,
            similarity: cosineSimilarity(currentEmb, e.embedding),
            reason: e.reason,
          }))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 5);
        
        if (similarities.length > 0) {
          console.log('Similar to LIKED:');
          similarities.forEach(s => {
            console.log(`   ${Math.round(s.similarity * 100)}% - ${s.name}`);
            if (s.reason) console.log(`       Liked because: ${s.reason}`);
          });
        }
        break;
      }
      
      case 'stats':
        displayStats();
        break;
        
      case 'prefs': {
        console.log('\n📋 LEARNED PREFERENCES:');
        console.log('────────────────────────────────────────────────────────────────');
        
        const sorted = [...store.learnedPreferences]
          .sort((a, b) => Math.abs(b.positiveWeight - b.negativeWeight) - Math.abs(a.positiveWeight - a.negativeWeight));
        
        sorted.slice(0, 15).forEach(p => {
          const net = p.positiveWeight - p.negativeWeight;
          const sign = net >= 0 ? '+' : '';
          const emoji = net >= 0 ? '✅' : '❌';
          console.log(`${emoji} ${p.category}: ${p.value} (${sign}${net.toFixed(2)})`);
          if (p.positiveReasons.length > 0) {
            console.log(`   👍 ${p.positiveReasons[0]}`);
          }
          if (p.negativeReasons.length > 0) {
            console.log(`   👎 ${p.negativeReasons[0]}`);
          }
        });
        break;
      }
      
      case 'export': {
        const data = {
          format: 'dpo_preference_pairs',
          exportedAt: new Date().toISOString(),
          stats: {
            likes: store.likedEntities.length,
            dislikes: store.dislikedEntities.length,
            pairs: store.preferencePairs.length,
            totalReward: store.totalReward,
          },
          pairs: store.preferencePairs,
          rewardHistory: store.rewardHistory,
          learnedPreferences: store.learnedPreferences,
        };
        
        console.log('\n📦 TRAINING DATA EXPORT:');
        console.log('────────────────────────────────────────────────────────────────');
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'clear':
        store.likedEntities = [];
        store.dislikedEntities = [];
        store.learnedPreferences = [];
        store.preferencePairs = [];
        store.rewardHistory = [];
        store.totalReward = 0;
        store.embeddings.clear();
        console.log('✅ All preferences cleared.');
        break;
        
      case 'quit':
      case 'exit':
        console.log('\n👋 Goodbye!');
        displayStats();
        rl.close();
        process.exit(0);
        break;
        
      default:
        if (cmd) {
          console.log(`Unknown command: ${cmd}. Type "help" for commands.`);
        }
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
  
  rl.prompt();
}

// Main
console.log('═══════════════════════════════════════════════════════════════');
console.log('🧠 RL AGENT - Reinforcement Learning for Deal Sourcing');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('Features:');
console.log('  • Real Specter API data');
console.log('  • Preference learning with explicit reasons');
console.log('  • Semantic embeddings for similarity matching');
console.log('  • DPO-style preference pairs');
console.log('  • 100% offline scoring');
console.log('');
console.log('Type "help" for commands or "searches" to start.');
console.log('═══════════════════════════════════════════════════════════════');

rl.prompt();
rl.on('line', handleCommand);
rl.on('close', () => process.exit(0));

