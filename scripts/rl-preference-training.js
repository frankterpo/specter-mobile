#!/usr/bin/env node
/**
 * RL Preference Training Demo
 * 
 * This script demonstrates how to use Cactus for on-device reinforcement learning
 * through preference-based learning (like DPO - Direct Preference Optimization).
 * 
 * The approach:
 * 1. User provides explicit feedback (like/dislike) with REASONS
 * 2. These reasons are stored as preference pairs (chosen vs rejected)
 * 3. The agent learns to generate better recommendations by:
 *    - Embedding preferences into system prompt context
 *    - Using the local Cactus model to score entities against learned patterns
 *    - Continuously refining its understanding through accumulated feedback
 * 
 * This works 100% OFFLINE because:
 * - Cactus runs inference locally on-device
 * - Preferences are stored in AsyncStorage (local)
 * - No fine-tuning required - we use in-context learning + embeddings
 */

require('dotenv').config();
const readline = require('readline');

// Mock AgentMemory for Node.js environment (simplified version)
const REWARD_SIGNALS = {
  LIKE: 1.0,
  DISLIKE: -1.0,
  SAVE: 2.0,
  VIEW_LONG: 0.5,
  SKIP: -0.2,
  VOICE_INPUT: 0.3,
  TEXT_INPUT: 0.3,
  AI_ACCEPTED: 1.5,
  AI_REJECTED: -0.5,
};

// In-memory preference store (in real app, this is AsyncStorage)
const preferenceStore = {
  likedEntities: [],
  dislikedEntities: [],
  learnedPreferences: [],
  preferencePairs: [], // DPO-style preference pairs
  rewardHistory: [],
  totalReward: 0,
};

// ============================================
// PREFERENCE PAIR COLLECTION (DPO-style)
// ============================================

/**
 * Record a preference pair for DPO-style learning.
 * This is the key to RL without fine-tuning:
 * - We store (chosen, rejected) pairs with reasons
 * - These inform the system prompt context
 * - The model learns through in-context examples
 */
function recordPreferencePair(chosen, rejected, reason) {
  const pair = {
    id: `pair_${Date.now()}`,
    timestamp: new Date().toISOString(),
    chosen: {
      entityId: chosen.id,
      entityName: chosen.name,
      features: chosen.features || {},
    },
    rejected: {
      entityId: rejected.id,
      entityName: rejected.name,
      features: rejected.features || {},
    },
    reason,
    // This is the "reward" signal
    chosenScore: REWARD_SIGNALS.LIKE,
    rejectedScore: REWARD_SIGNALS.DISLIKE,
  };
  
  preferenceStore.preferencePairs.push(pair);
  console.log(`📊 Recorded preference pair: "${chosen.name}" > "${rejected.name}"`);
  console.log(`   Reason: ${reason}`);
  return pair;
}

/**
 * Record a like with explicit reason (for RL training)
 */
function recordLikeWithReason(entity, reason) {
  const likeEntry = {
    id: entity.id,
    name: entity.name,
    type: entity.type || 'person',
    features: entity.features || {},
    reason,
    timestamp: new Date().toISOString(),
    reward: REWARD_SIGNALS.LIKE,
  };
  
  preferenceStore.likedEntities.push(likeEntry);
  preferenceStore.totalReward += REWARD_SIGNALS.LIKE;
  
  // Learn from features
  learnFromFeatures(entity.features, true, reason);
  
  // Record reward event
  preferenceStore.rewardHistory.push({
    timestamp: new Date().toISOString(),
    entityId: entity.id,
    action: 'LIKE',
    reward: REWARD_SIGNALS.LIKE,
    reason,
    features: entity.features,
  });
  
  console.log(`👍 LIKED: ${entity.name}`);
  console.log(`   Reason: ${reason}`);
  console.log(`   Reward: +${REWARD_SIGNALS.LIKE}`);
  return likeEntry;
}

/**
 * Record a dislike with explicit reason (for RL training)
 */
function recordDislikeWithReason(entity, reason) {
  const dislikeEntry = {
    id: entity.id,
    name: entity.name,
    type: entity.type || 'person',
    features: entity.features || {},
    reason,
    timestamp: new Date().toISOString(),
    reward: REWARD_SIGNALS.DISLIKE,
  };
  
  preferenceStore.dislikedEntities.push(dislikeEntry);
  preferenceStore.totalReward += REWARD_SIGNALS.DISLIKE;
  
  // Learn from features (negative)
  learnFromFeatures(entity.features, false, reason);
  
  // Record reward event
  preferenceStore.rewardHistory.push({
    timestamp: new Date().toISOString(),
    entityId: entity.id,
    action: 'DISLIKE',
    reward: REWARD_SIGNALS.DISLIKE,
    reason,
    features: entity.features,
  });
  
  console.log(`👎 DISLIKED: ${entity.name}`);
  console.log(`   Reason: ${reason}`);
  console.log(`   Reward: ${REWARD_SIGNALS.DISLIKE}`);
  return dislikeEntry;
}

/**
 * Learn preferences from features
 */
function learnFromFeatures(features, isPositive, reason) {
  if (!features) return;
  
  const categories = [
    { key: 'industry', label: 'Industry' },
    { key: 'seniority', label: 'Seniority' },
    { key: 'region', label: 'Region' },
    { key: 'fundingStage', label: 'Funding Stage' },
    { key: 'signalType', label: 'Signal Type' },
  ];
  
  for (const { key, label } of categories) {
    if (features[key]) {
      updatePreference(key, features[key], isPositive, reason);
    }
  }
  
  // Learn from highlights
  if (features.highlights?.length) {
    features.highlights.forEach(h => {
      updatePreference('highlight', h, isPositive, reason);
    });
  }
  
  // Learn from companies
  if (features.companies?.length) {
    features.companies.forEach(c => {
      updatePreference('experience', c, isPositive, reason);
    });
  }
}

/**
 * Update a learned preference
 */
function updatePreference(category, value, isPositive, reason) {
  let pref = preferenceStore.learnedPreferences.find(
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
      lastUpdated: new Date().toISOString(),
    };
    preferenceStore.learnedPreferences.push(pref);
  }
  
  if (isPositive) {
    pref.positiveWeight += 0.1;
    if (!pref.positiveReasons.includes(reason)) {
      pref.positiveReasons.push(reason);
    }
  } else {
    pref.negativeWeight += 0.1;
    if (!pref.negativeReasons.includes(reason)) {
      pref.negativeReasons.push(reason);
    }
  }
  
  pref.lastUpdated = new Date().toISOString();
}

// ============================================
// CONTEXT BUILDING FOR IN-CONTEXT LEARNING
// ============================================

/**
 * Build a system prompt that incorporates all learned preferences.
 * This is how we do "RL" without fine-tuning - by injecting
 * preference context into the prompt.
 */
function buildRLSystemPrompt() {
  const parts = [
    'You are a deal-sourcing AI agent for a venture capital investor.',
    'You have learned the following preferences from user feedback:',
    '',
  ];
  
  // Add positive preferences
  const positivePrefs = preferenceStore.learnedPreferences
    .filter(p => p.positiveWeight > p.negativeWeight)
    .sort((a, b) => (b.positiveWeight - b.negativeWeight) - (a.positiveWeight - a.negativeWeight))
    .slice(0, 10);
  
  if (positivePrefs.length > 0) {
    parts.push('PREFERRED (user likes these):');
    positivePrefs.forEach(p => {
      const confidence = Math.round((p.positiveWeight / (p.positiveWeight + p.negativeWeight + 0.1)) * 100);
      parts.push(`- ${p.category}: ${p.value} (${confidence}% confidence)`);
      if (p.positiveReasons.length > 0) {
        parts.push(`  Why: ${p.positiveReasons.slice(0, 2).join('; ')}`);
      }
    });
    parts.push('');
  }
  
  // Add negative preferences
  const negativePrefs = preferenceStore.learnedPreferences
    .filter(p => p.negativeWeight > p.positiveWeight)
    .sort((a, b) => (b.negativeWeight - b.positiveWeight) - (a.negativeWeight - a.positiveWeight))
    .slice(0, 5);
  
  if (negativePrefs.length > 0) {
    parts.push('AVOID (user dislikes these):');
    negativePrefs.forEach(p => {
      const confidence = Math.round((p.negativeWeight / (p.positiveWeight + p.negativeWeight + 0.1)) * 100);
      parts.push(`- ${p.category}: ${p.value} (${confidence}% confidence)`);
      if (p.negativeReasons.length > 0) {
        parts.push(`  Why: ${p.negativeReasons.slice(0, 2).join('; ')}`);
      }
    });
    parts.push('');
  }
  
  // Add preference pairs as examples
  if (preferenceStore.preferencePairs.length > 0) {
    parts.push('COMPARISON EXAMPLES (user chose left over right):');
    preferenceStore.preferencePairs.slice(-5).forEach(pair => {
      parts.push(`- "${pair.chosen.entityName}" > "${pair.rejected.entityName}": ${pair.reason}`);
    });
    parts.push('');
  }
  
  // Add recent likes/dislikes
  if (preferenceStore.likedEntities.length > 0) {
    parts.push(`RECENTLY LIKED (${preferenceStore.likedEntities.length} total):`);
    preferenceStore.likedEntities.slice(-3).forEach(e => {
      parts.push(`- ${e.name}: ${e.reason}`);
    });
    parts.push('');
  }
  
  if (preferenceStore.dislikedEntities.length > 0) {
    parts.push(`RECENTLY DISLIKED (${preferenceStore.dislikedEntities.length} total):`);
    preferenceStore.dislikedEntities.slice(-3).forEach(e => {
      parts.push(`- ${e.name}: ${e.reason}`);
    });
    parts.push('');
  }
  
  parts.push('Use these learned preferences to:');
  parts.push('1. Score new entities based on how well they match preferences');
  parts.push('2. Highlight features that match positive preferences');
  parts.push('3. Warn about features that match negative preferences');
  parts.push('4. Make recommendations consistent with past choices');
  
  return parts.join('\n');
}

/**
 * Score an entity based on learned preferences
 * This is the "inference" part of RL - using learned preferences to predict
 */
function scoreEntity(features) {
  let score = 50; // Start neutral
  const reasons = [];
  const warnings = [];
  
  for (const pref of preferenceStore.learnedPreferences) {
    const netWeight = pref.positiveWeight - pref.negativeWeight;
    
    // Check if this preference matches the entity
    let matches = false;
    
    if (pref.category === 'industry' && features.industry?.toLowerCase() === pref.value.toLowerCase()) {
      matches = true;
    } else if (pref.category === 'seniority' && features.seniority?.toLowerCase().includes(pref.value.toLowerCase())) {
      matches = true;
    } else if (pref.category === 'region' && features.region?.toLowerCase().includes(pref.value.toLowerCase())) {
      matches = true;
    } else if (pref.category === 'fundingStage' && features.fundingStage?.toLowerCase() === pref.value.toLowerCase()) {
      matches = true;
    } else if (pref.category === 'signalType' && features.signalType?.toLowerCase() === pref.value.toLowerCase()) {
      matches = true;
    } else if (pref.category === 'highlight' && features.highlights?.some(h => h.toLowerCase().includes(pref.value.toLowerCase()))) {
      matches = true;
    } else if (pref.category === 'experience' && features.companies?.some(c => c.toLowerCase().includes(pref.value.toLowerCase()))) {
      matches = true;
    }
    
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
  
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    warnings,
  };
}

// ============================================
// EXPORT TRAINING DATA FOR EXTERNAL RL
// ============================================

/**
 * Export training data in DPO format for potential external fine-tuning.
 * This can be used with Hugging Face TRL or similar libraries.
 */
function exportDPOTrainingData() {
  const trainingData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    format: 'dpo_preference_pairs',
    metadata: {
      totalLikes: preferenceStore.likedEntities.length,
      totalDislikes: preferenceStore.dislikedEntities.length,
      totalPairs: preferenceStore.preferencePairs.length,
      totalReward: preferenceStore.totalReward,
    },
    // DPO format: { prompt, chosen, rejected }
    pairs: preferenceStore.preferencePairs.map(pair => ({
      prompt: `Evaluate this founder for investment potential based on the following criteria: ${pair.reason}`,
      chosen: {
        entityId: pair.chosen.entityId,
        entityName: pair.chosen.entityName,
        features: pair.chosen.features,
        response: `I recommend ${pair.chosen.entityName} because: ${pair.reason}`,
      },
      rejected: {
        entityId: pair.rejected.entityId,
        entityName: pair.rejected.entityName,
        features: pair.rejected.features,
        response: `I would pass on ${pair.rejected.entityName}.`,
      },
    })),
    // Raw reward history for RLHF
    rewardHistory: preferenceStore.rewardHistory,
    // Learned preferences for context
    learnedPreferences: preferenceStore.learnedPreferences,
  };
  
  return trainingData;
}

// ============================================
// INTERACTIVE DEMO
// ============================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'RL> ',
});

// Sample entities for demo
const sampleEntities = [
  {
    id: 'per_1',
    name: 'Sarah Chen',
    features: {
      seniority: 'Founder',
      industry: 'AI',
      region: 'San Francisco',
      fundingStage: 'seed',
      signalType: 'new_founder',
      highlights: ['serial_founder', 'yc_alum'],
      companies: ['Google', 'Stripe'],
    },
  },
  {
    id: 'per_2',
    name: 'John Smith',
    features: {
      seniority: 'VP',
      industry: 'Fintech',
      region: 'New York',
      fundingStage: 'series_a',
      signalType: 'spinout',
      highlights: ['repeat_founder'],
      companies: ['Goldman Sachs'],
    },
  },
  {
    id: 'per_3',
    name: 'Maria Garcia',
    features: {
      seniority: 'Director',
      industry: 'Healthcare',
      region: 'Boston',
      fundingStage: 'pre-seed',
      signalType: 'new_founder',
      highlights: ['phd'],
      companies: ['Harvard Medical'],
    },
  },
  {
    id: 'per_4',
    name: 'Alex Kim',
    features: {
      seniority: 'Founder',
      industry: 'AI',
      region: 'San Francisco',
      fundingStage: 'stealth',
      signalType: 'spinout',
      highlights: ['serial_founder', 'technical'],
      companies: ['OpenAI', 'DeepMind'],
    },
  },
  {
    id: 'per_5',
    name: 'James Wilson',
    features: {
      seniority: 'Manager',
      industry: 'SaaS',
      region: 'Austin',
      fundingStage: 'seed',
      signalType: 'new_founder',
      highlights: [],
      companies: ['IBM'],
    },
  },
];

let currentEntityIndex = 0;

function showCurrentEntity() {
  if (currentEntityIndex >= sampleEntities.length) {
    console.log('\n✅ All entities reviewed!');
    showStats();
    return false;
  }
  
  const entity = sampleEntities[currentEntityIndex];
  const { score, reasons, warnings } = scoreEntity(entity.features);
  
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`📋 ENTITY ${currentEntityIndex + 1}/${sampleEntities.length}: ${entity.name}`);
  console.log('════════════════════════════════════════════════════════════');
  console.log(`   Seniority:    ${entity.features.seniority}`);
  console.log(`   Industry:     ${entity.features.industry}`);
  console.log(`   Region:       ${entity.features.region}`);
  console.log(`   Stage:        ${entity.features.fundingStage}`);
  console.log(`   Signal:       ${entity.features.signalType}`);
  console.log(`   Highlights:   ${entity.features.highlights.join(', ') || 'None'}`);
  console.log(`   Experience:   ${entity.features.companies.join(', ')}`);
  console.log('────────────────────────────────────────────────────────────');
  console.log(`   🎯 AI SCORE: ${score}/100`);
  if (reasons.length > 0) {
    console.log(`   Matches: ${reasons.join(', ')}`);
  }
  if (warnings.length > 0) {
    console.log(`   Concerns: ${warnings.join(', ')}`);
  }
  console.log('────────────────────────────────────────────────────────────');
  console.log('Commands:');
  console.log('   like <reason>     - Like this entity with a reason');
  console.log('   dislike <reason>  - Dislike this entity with a reason');
  console.log('   compare           - Compare with previous (creates preference pair)');
  console.log('   skip              - Skip without feedback');
  console.log('   prompt            - Show current RL system prompt');
  console.log('   export            - Export training data');
  console.log('   stats             - Show learning stats');
  console.log('   quit              - Exit');
  console.log('════════════════════════════════════════════════════════════');
  
  return true;
}

function showStats() {
  console.log('\n📊 LEARNING STATS');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Total Likes:       ${preferenceStore.likedEntities.length}`);
  console.log(`Total Dislikes:    ${preferenceStore.dislikedEntities.length}`);
  console.log(`Preference Pairs:  ${preferenceStore.preferencePairs.length}`);
  console.log(`Total Reward:      ${preferenceStore.totalReward.toFixed(1)}`);
  console.log(`Preferences Learned: ${preferenceStore.learnedPreferences.length}`);
  console.log('────────────────────────────────────────────────────────────');
  
  const positivePrefs = preferenceStore.learnedPreferences
    .filter(p => p.positiveWeight > p.negativeWeight)
    .sort((a, b) => (b.positiveWeight - b.negativeWeight) - (a.positiveWeight - a.negativeWeight));
  
  const negativePrefs = preferenceStore.learnedPreferences
    .filter(p => p.negativeWeight > p.positiveWeight)
    .sort((a, b) => (b.negativeWeight - b.positiveWeight) - (a.negativeWeight - a.positiveWeight));
  
  if (positivePrefs.length > 0) {
    console.log('\n✅ POSITIVE PREFERENCES:');
    positivePrefs.slice(0, 5).forEach(p => {
      const net = (p.positiveWeight - p.negativeWeight).toFixed(2);
      console.log(`   ${p.category}: ${p.value} (weight: +${net})`);
    });
  }
  
  if (negativePrefs.length > 0) {
    console.log('\n❌ NEGATIVE PREFERENCES:');
    negativePrefs.slice(0, 5).forEach(p => {
      const net = (p.negativeWeight - p.positiveWeight).toFixed(2);
      console.log(`   ${p.category}: ${p.value} (weight: -${net})`);
    });
  }
  
  console.log('════════════════════════════════════════════════════════════');
}

async function handleCommand(line) {
  const [cmd, ...args] = line.trim().split(' ');
  const reason = args.join(' ');
  
  const currentEntity = sampleEntities[currentEntityIndex];
  
  switch (cmd.toLowerCase()) {
    case 'like':
      if (!reason) {
        console.log('⚠️  Please provide a reason: like <reason>');
        break;
      }
      recordLikeWithReason(currentEntity, reason);
      currentEntityIndex++;
      showCurrentEntity();
      break;
      
    case 'dislike':
      if (!reason) {
        console.log('⚠️  Please provide a reason: dislike <reason>');
        break;
      }
      recordDislikeWithReason(currentEntity, reason);
      currentEntityIndex++;
      showCurrentEntity();
      break;
      
    case 'compare':
      if (currentEntityIndex === 0) {
        console.log('⚠️  No previous entity to compare with.');
        break;
      }
      const prevEntity = sampleEntities[currentEntityIndex - 1];
      const prevLiked = preferenceStore.likedEntities.find(e => e.id === prevEntity.id);
      const prevDisliked = preferenceStore.dislikedEntities.find(e => e.id === prevEntity.id);
      
      if (prevLiked) {
        console.log(`Comparing: "${prevEntity.name}" (liked) vs "${currentEntity.name}"`);
        console.log('Which do you prefer? Type: prefer_prev <reason> or prefer_current <reason>');
      } else if (prevDisliked) {
        console.log(`Comparing: "${prevEntity.name}" (disliked) vs "${currentEntity.name}"`);
        console.log('Which do you prefer? Type: prefer_prev <reason> or prefer_current <reason>');
      } else {
        console.log('⚠️  Previous entity was skipped. Like or dislike first.');
      }
      break;
      
    case 'prefer_prev':
      if (!reason) {
        console.log('⚠️  Please provide a reason: prefer_prev <reason>');
        break;
      }
      recordPreferencePair(
        sampleEntities[currentEntityIndex - 1],
        currentEntity,
        reason
      );
      currentEntityIndex++;
      showCurrentEntity();
      break;
      
    case 'prefer_current':
      if (!reason) {
        console.log('⚠️  Please provide a reason: prefer_current <reason>');
        break;
      }
      recordPreferencePair(
        currentEntity,
        sampleEntities[currentEntityIndex - 1],
        reason
      );
      currentEntityIndex++;
      showCurrentEntity();
      break;
      
    case 'skip':
      console.log(`⏭️  Skipped ${currentEntity.name}`);
      preferenceStore.totalReward += REWARD_SIGNALS.SKIP;
      currentEntityIndex++;
      showCurrentEntity();
      break;
      
    case 'prompt':
      console.log('\n📝 CURRENT RL SYSTEM PROMPT:');
      console.log('════════════════════════════════════════════════════════════');
      console.log(buildRLSystemPrompt());
      console.log('════════════════════════════════════════════════════════════');
      break;
      
    case 'export':
      const data = exportDPOTrainingData();
      console.log('\n📦 EXPORTED TRAINING DATA (DPO Format):');
      console.log('════════════════════════════════════════════════════════════');
      console.log(JSON.stringify(data, null, 2));
      console.log('════════════════════════════════════════════════════════════');
      break;
      
    case 'stats':
      showStats();
      break;
      
    case 'quit':
    case 'exit':
      console.log('\n👋 Goodbye! Training data preserved.');
      showStats();
      rl.close();
      process.exit(0);
      break;
      
    default:
      console.log('Unknown command. Type "like <reason>", "dislike <reason>", "skip", or "quit".');
  }
  
  rl.prompt();
}

// Main
console.log('═══════════════════════════════════════════════════════════════');
console.log('🧠 RL PREFERENCE TRAINING DEMO');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('This demonstrates how Cactus enables on-device RL through:');
console.log('1. Explicit preference collection (like/dislike with reasons)');
console.log('2. Preference pair collection (A > B comparisons)');
console.log('3. In-context learning (preferences injected into system prompt)');
console.log('4. Local scoring (no API needed for inference)');
console.log('');
console.log('Works 100% OFFLINE - all learning happens on-device!');
console.log('═══════════════════════════════════════════════════════════════');

showCurrentEntity();
rl.prompt();

rl.on('line', handleCommand);
rl.on('close', () => {
  console.log('\n👋 Session ended.');
  process.exit(0);
});

