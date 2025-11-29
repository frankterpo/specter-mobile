#!/usr/bin/env node
/**
 * RL Training Data Collector for Specter Agent
 * 
 * Collects preference pairs from user actions (like/dislike) to train
 * the bulk action model using DPO (Direct Preference Optimization).
 * 
 * Training Flow:
 * 1. User likes/dislikes founders → generates preference pairs
 * 2. Export to training format (DPO pairs)
 * 3. Fine-tune Qwen model on preferences
 * 4. Deploy updated model via Cactus SDK
 * 
 * Usage: node scripts/rl-training.js
 */

require('dotenv').config();

// ============================================
// REWARD SIGNALS (matches agentMemory.ts)
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
// TRAINING DATA STRUCTURE
// ============================================

/**
 * DPO Training Pair
 * For each pair, the model learns to prefer "chosen" over "rejected"
 */
class TrainingDataCollector {
  constructor() {
    this.events = [];           // Raw reward events
    this.preferencePairs = [];  // DPO pairs for training
    this.featureWeights = {};   // Learned feature importance
  }

  // ─────────────────────────────────────────
  // RECORD USER ACTIONS
  // ─────────────────────────────────────────

  recordLike(entity, features, reason = null) {
    const event = {
      timestamp: new Date().toISOString(),
      entityId: entity.person_id || entity.id,
      entityName: entity.full_name || entity.name,
      action: 'LIKE',
      reward: REWARD_SIGNALS.LIKE,
      features: this.extractFeatures(entity, features),
      reason,
    };
    this.events.push(event);
    this.updateFeatureWeights(event.features, 1);
    return event;
  }

  recordDislike(entity, features, reason = null) {
    const event = {
      timestamp: new Date().toISOString(),
      entityId: entity.person_id || entity.id,
      entityName: entity.full_name || entity.name,
      action: 'DISLIKE',
      reward: REWARD_SIGNALS.DISLIKE,
      features: this.extractFeatures(entity, features),
      reason,
    };
    this.events.push(event);
    this.updateFeatureWeights(event.features, -1);
    return event;
  }

  recordAIDecision(entity, features, accepted, aiReason) {
    const event = {
      timestamp: new Date().toISOString(),
      entityId: entity.person_id || entity.id,
      entityName: entity.full_name || entity.name,
      action: accepted ? 'AI_ACCEPTED' : 'AI_REJECTED',
      reward: accepted ? REWARD_SIGNALS.AI_ACCEPTED : REWARD_SIGNALS.AI_REJECTED,
      features: this.extractFeatures(entity, features),
      reason: aiReason,
    };
    this.events.push(event);
    // AI rejections are very valuable - user explicitly disagreed with AI
    this.updateFeatureWeights(event.features, accepted ? 1.5 : -1.5);
    return event;
  }

  // ─────────────────────────────────────────
  // FEATURE EXTRACTION
  // ─────────────────────────────────────────

  extractFeatures(entity, additionalFeatures = {}) {
    return {
      // From entity
      highlights: entity.highlights || entity.people_highlights || [],
      seniority: entity.seniority || entity.level_of_seniority,
      region: entity.region,
      industries: entity.industries || [],
      signalType: entity.signal_type,
      signalScore: entity.signal_score,
      
      // From experience (if available)
      currentCompany: entity.experience?.find(e => e.is_current)?.company_name,
      yearsExperience: entity.years_of_experience,
      
      // Additional context
      ...additionalFeatures,
    };
  }

  // ─────────────────────────────────────────
  // FEATURE WEIGHT LEARNING
  // ─────────────────────────────────────────

  updateFeatureWeights(features, direction) {
    // Update weights for each feature based on like/dislike
    
    // Highlights
    (features.highlights || []).forEach(h => {
      const key = `highlight:${h}`;
      this.featureWeights[key] = (this.featureWeights[key] || 0) + direction;
    });
    
    // Seniority
    if (features.seniority) {
      const key = `seniority:${features.seniority}`;
      this.featureWeights[key] = (this.featureWeights[key] || 0) + direction;
    }
    
    // Region
    if (features.region) {
      const key = `region:${features.region}`;
      this.featureWeights[key] = (this.featureWeights[key] || 0) + direction;
    }
    
    // Signal type
    if (features.signalType) {
      const key = `signal:${features.signalType}`;
      this.featureWeights[key] = (this.featureWeights[key] || 0) + direction;
    }
    
    // Industries
    (features.industries || []).forEach(i => {
      const key = `industry:${i}`;
      this.featureWeights[key] = (this.featureWeights[key] || 0) + direction;
    });
  }

  // ─────────────────────────────────────────
  // GENERATE DPO PREFERENCE PAIRS
  // ─────────────────────────────────────────

  generatePreferencePairs() {
    const likes = this.events.filter(e => e.reward > 0);
    const dislikes = this.events.filter(e => e.reward < 0);
    
    const pairs = [];
    
    // Create pairs: liked vs disliked
    likes.forEach(liked => {
      dislikes.forEach(disliked => {
        pairs.push({
          prompt: this.buildPrompt(liked.features, disliked.features),
          chosen: this.buildResponse(liked, 'like'),
          rejected: this.buildResponse(disliked, 'like'),
        });
      });
    });
    
    this.preferencePairs = pairs;
    return pairs;
  }

  buildPrompt(featuresA, featuresB) {
    return `You are a VC deal sourcing agent. Based on the user's investment preferences, decide which founder to prioritize.

User's learned preferences:
${this.getTopPreferences()}

Founder A:
- Highlights: ${featuresA.highlights?.join(', ') || 'None'}
- Seniority: ${featuresA.seniority || 'Unknown'}
- Region: ${featuresA.region || 'Unknown'}
- Signal: ${featuresA.signalType || 'Unknown'}

Founder B:
- Highlights: ${featuresB.highlights?.join(', ') || 'None'}
- Seniority: ${featuresB.seniority || 'Unknown'}
- Region: ${featuresB.region || 'Unknown'}
- Signal: ${featuresB.signalType || 'Unknown'}

Which founder should be prioritized for outreach?`;
  }

  buildResponse(event, action) {
    return `Based on the user's preferences, I recommend ${action === 'like' ? 'prioritizing' : 'skipping'} ${event.entityName}.

Reasoning:
- ${event.features.highlights?.length ? `Has valuable highlights: ${event.features.highlights.join(', ')}` : 'No notable highlights'}
- ${event.features.signalType ? `Signal type: ${event.features.signalType}` : ''}
- ${event.reason || 'Matches overall preference pattern'}

Action: ${action.toUpperCase()}`;
  }

  getTopPreferences() {
    const sorted = Object.entries(this.featureWeights)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 10);
    
    const positive = sorted.filter(([_, v]) => v > 0).map(([k, v]) => `  ✓ ${k} (+${v.toFixed(1)})`);
    const negative = sorted.filter(([_, v]) => v < 0).map(([k, v]) => `  ✗ ${k} (${v.toFixed(1)})`);
    
    return `Prefers:\n${positive.join('\n')}\n\nAvoids:\n${negative.join('\n')}`;
  }

  // ─────────────────────────────────────────
  // SCORING (for bulk actions)
  // ─────────────────────────────────────────

  scoreEntity(entity) {
    const features = this.extractFeatures(entity);
    let score = 50; // Base score
    const reasons = [];
    
    // Apply learned weights
    (features.highlights || []).forEach(h => {
      const weight = this.featureWeights[`highlight:${h}`] || 0;
      if (weight !== 0) {
        score += weight * 5;
        reasons.push(`${h}: ${weight > 0 ? '+' : ''}${(weight * 5).toFixed(0)}`);
      }
    });
    
    if (features.seniority) {
      const weight = this.featureWeights[`seniority:${features.seniority}`] || 0;
      if (weight !== 0) {
        score += weight * 3;
        reasons.push(`${features.seniority}: ${weight > 0 ? '+' : ''}${(weight * 3).toFixed(0)}`);
      }
    }
    
    if (features.signalType) {
      const weight = this.featureWeights[`signal:${features.signalType}`] || 0;
      if (weight !== 0) {
        score += weight * 4;
        reasons.push(`${features.signalType}: ${weight > 0 ? '+' : ''}${(weight * 4).toFixed(0)}`);
      }
    }
    
    (features.industries || []).forEach(i => {
      const weight = this.featureWeights[`industry:${i}`] || 0;
      if (weight !== 0) {
        score += weight * 2;
        reasons.push(`${i}: ${weight > 0 ? '+' : ''}${(weight * 2).toFixed(0)}`);
      }
    });
    
    return {
      entityId: entity.person_id || entity.id,
      entityName: entity.full_name || entity.name,
      score: Math.max(0, Math.min(100, score)),
      reasons,
      recommendation: score >= 70 ? 'LIKE' : score <= 30 ? 'DISLIKE' : 'REVIEW',
    };
  }

  // ─────────────────────────────────────────
  // BULK ACTION RECOMMENDATIONS
  // ─────────────────────────────────────────

  recommendBulkAction(entities, threshold = 0.7) {
    const scored = entities.map(e => this.scoreEntity(e));
    
    const toLike = scored.filter(s => s.score >= threshold * 100);
    const toDislike = scored.filter(s => s.score <= (1 - threshold) * 100);
    const toReview = scored.filter(s => s.score > (1 - threshold) * 100 && s.score < threshold * 100);
    
    return {
      like: toLike,
      dislike: toDislike,
      review: toReview,
      summary: {
        total: entities.length,
        autoLike: toLike.length,
        autoDislike: toDislike.length,
        needsReview: toReview.length,
        confidence: this.calculateConfidence(),
      },
    };
  }

  calculateConfidence() {
    // Confidence based on number of training examples
    const totalEvents = this.events.length;
    if (totalEvents < 10) return 0.3;
    if (totalEvents < 50) return 0.5;
    if (totalEvents < 100) return 0.7;
    return 0.9;
  }

  // ─────────────────────────────────────────
  // EXPORT FOR TRAINING
  // ─────────────────────────────────────────

  exportTrainingData() {
    return {
      metadata: {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        totalEvents: this.events.length,
        totalPairs: this.preferencePairs.length,
        confidence: this.calculateConfidence(),
      },
      featureWeights: this.featureWeights,
      events: this.events,
      preferencePairs: this.preferencePairs,
    };
  }

  // ─────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────

  getStats() {
    const likes = this.events.filter(e => e.action === 'LIKE').length;
    const dislikes = this.events.filter(e => e.action === 'DISLIKE').length;
    const aiAccepted = this.events.filter(e => e.action === 'AI_ACCEPTED').length;
    const aiRejected = this.events.filter(e => e.action === 'AI_REJECTED').length;
    
    return {
      totalEvents: this.events.length,
      likes,
      dislikes,
      aiAccepted,
      aiRejected,
      aiAcceptanceRate: aiAccepted + aiRejected > 0 
        ? (aiAccepted / (aiAccepted + aiRejected) * 100).toFixed(1) + '%'
        : 'N/A',
      topPositiveFeatures: Object.entries(this.featureWeights)
        .filter(([_, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      topNegativeFeatures: Object.entries(this.featureWeights)
        .filter(([_, v]) => v < 0)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 5),
    };
  }
}

// ============================================
// CLI DEMO
// ============================================

async function demo() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧠 RL TRAINING DATA COLLECTOR');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const collector = new TrainingDataCollector();
  
  // Simulate user actions
  console.log('📝 Simulating user actions...\n');
  
  // User likes serial founders
  collector.recordLike(
    { person_id: 'per_1', full_name: 'Alice Chen', highlights: ['serial_founder', 'yc_alumni'], seniority: 'Founder', region: 'North America' },
    {},
    'Strong track record'
  );
  
  collector.recordLike(
    { person_id: 'per_2', full_name: 'Bob Smith', highlights: ['serial_founder', 'successful_exit'], seniority: 'CEO', signal_type: 'New Company' },
    {},
    'Previous exit'
  );
  
  // User dislikes junior roles
  collector.recordDislike(
    { person_id: 'per_3', full_name: 'Carol Davis', highlights: [], seniority: 'Manager', region: 'Europe' },
    {},
    'Too junior'
  );
  
  collector.recordDislike(
    { person_id: 'per_4', full_name: 'Dan Wilson', highlights: [], seniority: 'Associate', signal_type: 'New Role' },
    {},
    'Not founder material'
  );
  
  // AI recommendation accepted
  collector.recordAIDecision(
    { person_id: 'per_5', full_name: 'Eve Johnson', highlights: ['vc_backed'], seniority: 'Founder', signal_type: 'New Company' },
    {},
    true,
    'AI recommended based on VC-backed highlight'
  );
  
  // AI recommendation rejected
  collector.recordAIDecision(
    { person_id: 'per_6', full_name: 'Frank Lee', highlights: ['fortune_500'], seniority: 'VP' },
    {},
    false,
    'User prefers startup experience over corporate'
  );
  
  // Show stats
  console.log('📊 TRAINING STATS:\n');
  const stats = collector.getStats();
  console.log(`  Total events: ${stats.totalEvents}`);
  console.log(`  Likes: ${stats.likes}`);
  console.log(`  Dislikes: ${stats.dislikes}`);
  console.log(`  AI Accepted: ${stats.aiAccepted}`);
  console.log(`  AI Rejected: ${stats.aiRejected}`);
  console.log(`  AI Acceptance Rate: ${stats.aiAcceptanceRate}`);
  
  console.log('\n  Top Positive Features:');
  stats.topPositiveFeatures.forEach(([k, v]) => console.log(`    ✓ ${k}: +${v.toFixed(1)}`));
  
  console.log('\n  Top Negative Features:');
  stats.topNegativeFeatures.forEach(([k, v]) => console.log(`    ✗ ${k}: ${v.toFixed(1)}`));
  
  // Score a new entity
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('🎯 SCORING NEW ENTITY:\n');
  
  const newFounder = {
    person_id: 'per_new',
    full_name: 'Grace Kim',
    highlights: ['serial_founder'],
    seniority: 'Founder',
    signal_type: 'New Company',
    region: 'North America',
  };
  
  const score = collector.scoreEntity(newFounder);
  console.log(`  Name: ${score.entityName}`);
  console.log(`  Score: ${score.score}/100`);
  console.log(`  Recommendation: ${score.recommendation}`);
  console.log(`  Reasons:`);
  score.reasons.forEach(r => console.log(`    - ${r}`));
  
  // Generate DPO pairs
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('📦 GENERATING DPO TRAINING PAIRS:\n');
  
  const pairs = collector.generatePreferencePairs();
  console.log(`  Generated ${pairs.length} preference pairs for training`);
  
  if (pairs.length > 0) {
    console.log('\n  Sample pair:');
    console.log('  ─────────────');
    console.log(`  Prompt: ${pairs[0].prompt.slice(0, 200)}...`);
    console.log(`  Chosen: ${pairs[0].chosen.slice(0, 100)}...`);
    console.log(`  Rejected: ${pairs[0].rejected.slice(0, 100)}...`);
  }
  
  // Export
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('💾 EXPORT:\n');
  
  const exported = collector.exportTrainingData();
  console.log(`  Ready to export ${exported.events.length} events`);
  console.log(`  ${exported.preferencePairs.length} DPO pairs for fine-tuning`);
  console.log(`  Confidence: ${(exported.metadata.confidence * 100).toFixed(0)}%`);
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ This data can be used to fine-tune Qwen via:');
  console.log('   1. TRL (Transformers RL) with DPO trainer');
  console.log('   2. Export to GGUF for Cactus SDK');
  console.log('   3. Continuous learning via GRPO in-app');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Export for use in other scripts
module.exports = { TrainingDataCollector, REWARD_SIGNALS };

if (require.main === module) {
  demo().catch(console.error);
}

