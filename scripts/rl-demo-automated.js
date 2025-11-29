#!/usr/bin/env node
/**
 * RL Demo - Automated Test
 * 
 * This script demonstrates the full RL preference learning flow
 * without requiring interactive input.
 * 
 * Key concepts for on-device RL with Cactus:
 * 
 * 1. IN-CONTEXT LEARNING (no fine-tuning needed)
 *    - Preferences are injected into the system prompt
 *    - Cactus model uses this context for inference
 *    - Works 100% offline
 * 
 * 2. PREFERENCE PAIRS (DPO-style)
 *    - User chooses A over B with a reason
 *    - These pairs inform future recommendations
 *    - Can be exported for external fine-tuning if needed
 * 
 * 3. REWARD SIGNALS
 *    - Each action has a numeric reward
 *    - Total reward tracks engagement quality
 *    - Used for ranking and prioritization
 * 
 * 4. FEATURE LEARNING
 *    - System learns which features correlate with likes/dislikes
 *    - Builds weighted preferences per category
 *    - Scores new entities based on learned patterns
 */

require('dotenv').config();

// ============================================
// REWARD SIGNALS
// ============================================

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

// ============================================
// PREFERENCE STORE (simulates AgentMemory)
// ============================================

const preferenceStore = {
  likedEntities: [],
  dislikedEntities: [],
  learnedPreferences: [],
  preferencePairs: [],
  rewardHistory: [],
  totalReward: 0,
};

// ============================================
// LEARNING FUNCTIONS
// ============================================

function recordLikeWithReason(entity, reason) {
  preferenceStore.likedEntities.push({
    id: entity.id,
    name: entity.name,
    features: entity.features,
    reason,
    timestamp: new Date().toISOString(),
  });
  preferenceStore.totalReward += REWARD_SIGNALS.LIKE;
  learnFromFeatures(entity.features, true, reason);
  
  preferenceStore.rewardHistory.push({
    timestamp: new Date().toISOString(),
    entityId: entity.id,
    action: 'LIKE',
    reward: REWARD_SIGNALS.LIKE,
    reason,
  });
}

function recordDislikeWithReason(entity, reason) {
  preferenceStore.dislikedEntities.push({
    id: entity.id,
    name: entity.name,
    features: entity.features,
    reason,
    timestamp: new Date().toISOString(),
  });
  preferenceStore.totalReward += REWARD_SIGNALS.DISLIKE;
  learnFromFeatures(entity.features, false, reason);
  
  preferenceStore.rewardHistory.push({
    timestamp: new Date().toISOString(),
    entityId: entity.id,
    action: 'DISLIKE',
    reward: REWARD_SIGNALS.DISLIKE,
    reason,
  });
}

function recordPreferencePair(chosen, rejected, reason) {
  preferenceStore.preferencePairs.push({
    id: `pair_${Date.now()}`,
    timestamp: new Date().toISOString(),
    chosen: { entityId: chosen.id, entityName: chosen.name, features: chosen.features },
    rejected: { entityId: rejected.id, entityName: rejected.name, features: rejected.features },
    reason,
  });
}

function learnFromFeatures(features, isPositive, reason) {
  const categories = ['industry', 'seniority', 'region', 'fundingStage', 'signalType'];
  
  for (const key of categories) {
    if (features[key]) {
      updatePreference(key, features[key], isPositive, reason);
    }
  }
  
  if (features.highlights?.length) {
    features.highlights.forEach(h => updatePreference('highlight', h, isPositive, reason));
  }
  
  if (features.companies?.length) {
    features.companies.forEach(c => updatePreference('experience', c, isPositive, reason));
  }
}

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
    };
    preferenceStore.learnedPreferences.push(pref);
  }
  
  if (isPositive) {
    pref.positiveWeight += 0.15;
    if (!pref.positiveReasons.includes(reason)) pref.positiveReasons.push(reason);
  } else {
    pref.negativeWeight += 0.15;
    if (!pref.negativeReasons.includes(reason)) pref.negativeReasons.push(reason);
  }
}

// ============================================
// SCORING FUNCTION (uses learned preferences)
// ============================================

function scoreEntity(features) {
  let score = 50;
  const reasons = [];
  const warnings = [];
  
  for (const pref of preferenceStore.learnedPreferences) {
    const netWeight = pref.positiveWeight - pref.negativeWeight;
    let matches = false;
    
    // Check all feature categories
    if (pref.category === 'industry' && features.industry?.toLowerCase() === pref.value.toLowerCase()) matches = true;
    if (pref.category === 'seniority' && features.seniority?.toLowerCase().includes(pref.value.toLowerCase())) matches = true;
    if (pref.category === 'region' && features.region?.toLowerCase().includes(pref.value.toLowerCase())) matches = true;
    if (pref.category === 'fundingStage' && features.fundingStage?.toLowerCase() === pref.value.toLowerCase()) matches = true;
    if (pref.category === 'signalType' && features.signalType?.toLowerCase() === pref.value.toLowerCase()) matches = true;
    if (pref.category === 'highlight' && features.highlights?.some(h => h.toLowerCase().includes(pref.value.toLowerCase()))) matches = true;
    if (pref.category === 'experience' && features.companies?.some(c => c.toLowerCase().includes(pref.value.toLowerCase()))) matches = true;
    
    if (matches) {
      if (netWeight > 0.1) {
        score += netWeight * 25;
        reasons.push(`✓ ${pref.category}: ${pref.value}`);
      } else if (netWeight < -0.1) {
        score -= Math.abs(netWeight) * 25;
        warnings.push(`⚠ ${pref.category}: ${pref.value}`);
      }
    }
  }
  
  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons, warnings };
}

// ============================================
// BUILD RL SYSTEM PROMPT
// ============================================

function buildRLSystemPrompt() {
  const parts = [
    'You are a deal-sourcing AI for a VC investor.',
    'Based on user feedback, you have learned:',
    '',
  ];
  
  const positivePrefs = preferenceStore.learnedPreferences
    .filter(p => p.positiveWeight > p.negativeWeight)
    .sort((a, b) => (b.positiveWeight - b.negativeWeight) - (a.positiveWeight - a.negativeWeight));
  
  const negativePrefs = preferenceStore.learnedPreferences
    .filter(p => p.negativeWeight > p.positiveWeight)
    .sort((a, b) => (b.negativeWeight - b.positiveWeight) - (a.negativeWeight - a.positiveWeight));
  
  if (positivePrefs.length > 0) {
    parts.push('PREFER:');
    positivePrefs.slice(0, 8).forEach(p => {
      const conf = Math.round((p.positiveWeight / (p.positiveWeight + p.negativeWeight + 0.1)) * 100);
      parts.push(`- ${p.category}: ${p.value} (${conf}%)`);
      if (p.positiveReasons.length > 0) parts.push(`  Reason: ${p.positiveReasons[0]}`);
    });
    parts.push('');
  }
  
  if (negativePrefs.length > 0) {
    parts.push('AVOID:');
    negativePrefs.slice(0, 5).forEach(p => {
      const conf = Math.round((p.negativeWeight / (p.positiveWeight + p.negativeWeight + 0.1)) * 100);
      parts.push(`- ${p.category}: ${p.value} (${conf}%)`);
      if (p.negativeReasons.length > 0) parts.push(`  Reason: ${p.negativeReasons[0]}`);
    });
    parts.push('');
  }
  
  if (preferenceStore.preferencePairs.length > 0) {
    parts.push('PREFERENCE EXAMPLES (chosen > rejected):');
    preferenceStore.preferencePairs.slice(-3).forEach(pair => {
      parts.push(`- "${pair.chosen.entityName}" > "${pair.rejected.entityName}": ${pair.reason}`);
    });
  }
  
  return parts.join('\n');
}

// ============================================
// EXPORT FOR EXTERNAL FINE-TUNING
// ============================================

function exportDPOData() {
  return {
    format: 'dpo_preference_pairs',
    exportedAt: new Date().toISOString(),
    pairs: preferenceStore.preferencePairs.map(pair => ({
      prompt: `Evaluate founder for VC investment.`,
      chosen: JSON.stringify(pair.chosen),
      rejected: JSON.stringify(pair.rejected),
      reason: pair.reason,
    })),
    rewardHistory: preferenceStore.rewardHistory,
    learnedPreferences: preferenceStore.learnedPreferences,
  };
}

// ============================================
// SAMPLE DATA
// ============================================

const sampleEntities = [
  {
    id: 'per_1', name: 'Sarah Chen',
    features: { seniority: 'Founder', industry: 'AI', region: 'San Francisco', fundingStage: 'seed', signalType: 'new_founder', highlights: ['serial_founder', 'yc_alum'], companies: ['Google', 'Stripe'] },
  },
  {
    id: 'per_2', name: 'John Smith',
    features: { seniority: 'VP', industry: 'Fintech', region: 'New York', fundingStage: 'series_a', signalType: 'spinout', highlights: ['repeat_founder'], companies: ['Goldman Sachs'] },
  },
  {
    id: 'per_3', name: 'Maria Garcia',
    features: { seniority: 'Director', industry: 'Healthcare', region: 'Boston', fundingStage: 'pre-seed', signalType: 'new_founder', highlights: ['phd'], companies: ['Harvard Medical'] },
  },
  {
    id: 'per_4', name: 'Alex Kim',
    features: { seniority: 'Founder', industry: 'AI', region: 'San Francisco', fundingStage: 'stealth', signalType: 'spinout', highlights: ['serial_founder', 'technical'], companies: ['OpenAI', 'DeepMind'] },
  },
  {
    id: 'per_5', name: 'James Wilson',
    features: { seniority: 'Manager', industry: 'SaaS', region: 'Austin', fundingStage: 'seed', signalType: 'new_founder', highlights: [], companies: ['IBM'] },
  },
  {
    id: 'per_6', name: 'Emily Zhang',
    features: { seniority: 'Founder', industry: 'AI', region: 'San Francisco', fundingStage: 'pre-seed', signalType: 'spinout', highlights: ['serial_founder'], companies: ['Meta', 'Anthropic'] },
  },
];

// ============================================
// RUN DEMO
// ============================================

async function runDemo() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧠 RL PREFERENCE LEARNING DEMO (Automated)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('This demonstrates how Cactus enables on-device RL:');
  console.log('');
  console.log('1. IN-CONTEXT LEARNING - Preferences injected into system prompt');
  console.log('2. PREFERENCE PAIRS - A > B comparisons for DPO-style learning');
  console.log('3. REWARD SIGNALS - Numeric rewards for each action');
  console.log('4. FEATURE LEARNING - Weighted preferences per category');
  console.log('');
  console.log('All learning happens ON-DEVICE - works 100% OFFLINE!');
  console.log('═══════════════════════════════════════════════════════════════');
  
  // Phase 1: Initial scoring (no preferences yet)
  console.log('\n📊 PHASE 1: Initial Scores (No Preferences)');
  console.log('────────────────────────────────────────────────────────────────');
  sampleEntities.forEach(e => {
    const { score } = scoreEntity(e.features);
    console.log(`   ${e.name}: ${score}/100 (neutral - no preferences learned)`);
  });
  
  // Phase 2: User provides feedback with reasons
  console.log('\n📊 PHASE 2: User Provides Feedback (with reasons)');
  console.log('────────────────────────────────────────────────────────────────');
  
  // Simulate user feedback
  console.log('\n👍 LIKE: Sarah Chen');
  recordLikeWithReason(sampleEntities[0], 'Strong AI founder from Google/Stripe with YC background');
  
  console.log('\n👎 DISLIKE: John Smith');
  recordDislikeWithReason(sampleEntities[1], 'Too senior (VP), prefer early founders, Series A is too late');
  
  console.log('\n👍 LIKE: Alex Kim');
  recordLikeWithReason(sampleEntities[3], 'OpenAI/DeepMind spinout in stealth - exactly what I want');
  
  console.log('\n👎 DISLIKE: James Wilson');
  recordDislikeWithReason(sampleEntities[4], 'Manager level is too junior, no highlights, IBM is not exciting');
  
  console.log('\n👍 LIKE: Emily Zhang');
  recordLikeWithReason(sampleEntities[5], 'Serial founder from Meta/Anthropic in AI - perfect fit');
  
  // Phase 3: Create preference pairs (DPO-style)
  console.log('\n📊 PHASE 3: Preference Pairs (DPO-style)');
  console.log('────────────────────────────────────────────────────────────────');
  
  recordPreferencePair(sampleEntities[0], sampleEntities[1], 'Prefer early-stage AI founders over late-stage Fintech VPs');
  console.log('   Sarah Chen > John Smith: "Prefer early-stage AI founders over late-stage Fintech VPs"');
  
  recordPreferencePair(sampleEntities[3], sampleEntities[4], 'Prefer technical founders from top AI labs over corporate managers');
  console.log('   Alex Kim > James Wilson: "Prefer technical founders from top AI labs over corporate managers"');
  
  // Phase 4: Show learned preferences
  console.log('\n📊 PHASE 4: Learned Preferences');
  console.log('────────────────────────────────────────────────────────────────');
  
  const positivePrefs = preferenceStore.learnedPreferences
    .filter(p => p.positiveWeight > p.negativeWeight)
    .sort((a, b) => (b.positiveWeight - b.negativeWeight) - (a.positiveWeight - a.negativeWeight));
  
  const negativePrefs = preferenceStore.learnedPreferences
    .filter(p => p.negativeWeight > p.positiveWeight)
    .sort((a, b) => (b.negativeWeight - b.positiveWeight) - (a.negativeWeight - a.positiveWeight));
  
  console.log('\n✅ POSITIVE PREFERENCES (what user likes):');
  positivePrefs.slice(0, 8).forEach(p => {
    const net = (p.positiveWeight - p.negativeWeight).toFixed(2);
    console.log(`   ${p.category}: ${p.value} (weight: +${net})`);
  });
  
  console.log('\n❌ NEGATIVE PREFERENCES (what user avoids):');
  negativePrefs.slice(0, 5).forEach(p => {
    const net = (p.negativeWeight - p.positiveWeight).toFixed(2);
    console.log(`   ${p.category}: ${p.value} (weight: -${net})`);
  });
  
  // Phase 5: Re-score with learned preferences
  console.log('\n📊 PHASE 5: Updated Scores (After Learning)');
  console.log('────────────────────────────────────────────────────────────────');
  sampleEntities.forEach(e => {
    const { score, reasons, warnings } = scoreEntity(e.features);
    const scoreBar = '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10));
    console.log(`\n   ${e.name}: ${score}/100 [${scoreBar}]`);
    if (reasons.length > 0) console.log(`      Matches: ${reasons.join(', ')}`);
    if (warnings.length > 0) console.log(`      Concerns: ${warnings.join(', ')}`);
  });
  
  // Phase 6: Show RL System Prompt
  console.log('\n📊 PHASE 6: Generated RL System Prompt');
  console.log('────────────────────────────────────────────────────────────────');
  console.log('This prompt is injected into Cactus for in-context learning:\n');
  console.log(buildRLSystemPrompt());
  
  // Phase 7: Test on new entity
  console.log('\n📊 PHASE 7: Score NEW Entity (never seen before)');
  console.log('────────────────────────────────────────────────────────────────');
  
  const newEntity = {
    id: 'per_new', name: 'Lisa Wang',
    features: {
      seniority: 'Founder',
      industry: 'AI',
      region: 'San Francisco',
      fundingStage: 'stealth',
      signalType: 'spinout',
      highlights: ['serial_founder', 'technical'],
      companies: ['Google Brain', 'Tesla AI'],
    },
  };
  
  console.log(`\n   New Entity: ${newEntity.name}`);
  console.log(`   Features: Founder, AI, SF, Stealth, Spinout, Serial Founder`);
  console.log(`   Experience: Google Brain, Tesla AI`);
  
  const { score, reasons, warnings } = scoreEntity(newEntity.features);
  const scoreBar = '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10));
  console.log(`\n   🎯 PREDICTED SCORE: ${score}/100 [${scoreBar}]`);
  if (reasons.length > 0) console.log(`      Matches: ${reasons.join(', ')}`);
  if (warnings.length > 0) console.log(`      Concerns: ${warnings.join(', ')}`);
  
  // Phase 8: Export for external fine-tuning
  console.log('\n📊 PHASE 8: Export Training Data (for external fine-tuning)');
  console.log('────────────────────────────────────────────────────────────────');
  const exportData = exportDPOData();
  console.log(`   Format: ${exportData.format}`);
  console.log(`   Preference Pairs: ${exportData.pairs.length}`);
  console.log(`   Reward Events: ${exportData.rewardHistory.length}`);
  console.log(`   Learned Preferences: ${exportData.learnedPreferences.length}`);
  console.log(`   Total Reward: ${preferenceStore.totalReward.toFixed(1)}`);
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📋 SUMMARY: How Cactus Enables On-Device RL');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('1. ✅ IN-CONTEXT LEARNING');
  console.log('   - Preferences are injected into the system prompt');
  console.log('   - Cactus uses this context for personalized inference');
  console.log('   - No model fine-tuning required');
  console.log('');
  console.log('2. ✅ PREFERENCE PAIRS (DPO-style)');
  console.log('   - User chooses A > B with explicit reasons');
  console.log('   - These pairs can be exported for external fine-tuning');
  console.log('   - Or used directly for in-context examples');
  console.log('');
  console.log('3. ✅ REWARD SIGNALS');
  console.log('   - Each action has a numeric reward value');
  console.log('   - Tracks engagement quality over time');
  console.log('   - Can be used for ranking and prioritization');
  console.log('');
  console.log('4. ✅ 100% OFFLINE');
  console.log('   - All learning happens on-device');
  console.log('   - Cactus runs inference locally');
  console.log('   - Preferences stored in AsyncStorage');
  console.log('');
  console.log('5. ✅ EXPORTABLE');
  console.log('   - Training data can be exported in DPO format');
  console.log('   - Compatible with Hugging Face TRL');
  console.log('   - Can fine-tune a custom model if needed');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
}

runDemo();

