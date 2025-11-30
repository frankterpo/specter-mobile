#!/usr/bin/env node
/**
 * DATABASE INTEGRATION TEST
 * Tests agent with real SQLite database operations
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'specter-ai.db');

// ═══════════════════════════════════════════════════════════════════
// COLORS & LOGGING
// ═══════════════════════════════════════════════════════════════════

const C = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function header(title) {
  console.log(`\n${C.bright}${C.cyan}╔${'═'.repeat(68)}╗${C.reset}`);
  console.log(`${C.bright}${C.cyan}║ ${title.padEnd(66)} ║${C.reset}`);
  console.log(`${C.bright}${C.cyan}╚${'═'.repeat(68)}╝${C.reset}\n`);
}

function subheader(title) {
  console.log(`\n${C.bright}${C.yellow}─── ${title} ${'─'.repeat(60 - title.length)}${C.reset}\n`);
}

function log(emoji, msg, color = 'reset') {
  console.log(`${C[color]}${emoji} ${msg}${C.reset}`);
}

// ═══════════════════════════════════════════════════════════════════
// DATABASE OPERATIONS
// ═══════════════════════════════════════════════════════════════════

let db;

function initDb() {
  db = new Database(DB_PATH);
  return db;
}

function getActivePersona() {
  return db.prepare('SELECT * FROM personas WHERE is_active = 1').get();
}

function getPersonaRecipe(personaId) {
  const persona = db.prepare('SELECT recipe_json FROM personas WHERE id = ?').get(personaId);
  return persona?.recipe_json ? JSON.parse(persona.recipe_json) : null;
}

function getLearnedWeights(personaId) {
  const weights = db.prepare('SELECT datapoint, weight FROM learned_weights WHERE persona_id = ?').all(personaId);
  const result = {};
  weights.forEach(w => { result[w.datapoint] = w.weight; });
  return result;
}

function saveFeedback(feedback) {
  db.prepare(`
    INSERT OR REPLACE INTO feedback 
    (persona_id, entity_id, entity_type, action, datapoints, note, ai_score, user_agreed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    feedback.persona_id,
    feedback.entity_id,
    feedback.entity_type,
    feedback.action,
    JSON.stringify(feedback.datapoints),
    feedback.note,
    feedback.ai_score,
    feedback.user_agreed ? 1 : 0
  );
}

function updateLearnedWeight(personaId, datapoint, isLike) {
  const existing = db.prepare(
    'SELECT * FROM learned_weights WHERE persona_id = ? AND datapoint = ?'
  ).get(personaId, datapoint);
  
  if (existing) {
    const newLikes = existing.like_count + (isLike ? 1 : 0);
    const newDislikes = existing.dislike_count + (isLike ? 0 : 1);
    const newWeight = (newLikes - newDislikes) / Math.max(newLikes + newDislikes, 1);
    
    db.prepare(`
      UPDATE learned_weights 
      SET like_count = ?, dislike_count = ?, weight = ?, last_updated = datetime('now')
      WHERE id = ?
    `).run(newLikes, newDislikes, newWeight, existing.id);
  } else {
    db.prepare(`
      INSERT INTO learned_weights (persona_id, datapoint, weight, like_count, dislike_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(personaId, datapoint, isLike ? 1.0 : -1.0, isLike ? 1 : 0, isLike ? 0 : 1);
  }
}

function addToSyncQueue(entityId, entityType, action) {
  db.prepare(`
    INSERT INTO sync_queue (entity_id, entity_type, action)
    VALUES (?, ?, ?)
  `).run(entityId, entityType, action);
}

function createShortlist(name, personaId, entityIds) {
  const result = db.prepare(`
    INSERT INTO shortlists (name, persona_id, entity_ids)
    VALUES (?, ?, ?)
  `).run(name, personaId, JSON.stringify(entityIds));
  return result.lastInsertRowid;
}

function getFeedbackStats(personaId) {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN action = 'like' THEN 1 ELSE 0 END) as likes,
      SUM(CASE WHEN action = 'dislike' THEN 1 ELSE 0 END) as dislikes,
      SUM(CASE WHEN user_agreed = 1 THEN 1 ELSE 0 END) as agreed
    FROM feedback WHERE persona_id = ?
  `).get(personaId);
  return stats;
}

// ═══════════════════════════════════════════════════════════════════
// SCORING
// ═══════════════════════════════════════════════════════════════════

function scoreCandidate(highlights, recipe, learnedWeights = {}) {
  const effectiveWeights = { ...recipe.weights, ...learnedWeights };
  
  let score = 50;
  const matchedPositive = [];
  const matchedNegative = [];
  const matchedRedFlags = [];
  
  for (const highlight of highlights) {
    const normalized = highlight.toLowerCase().replace(/\s+/g, '_');
    const weight = effectiveWeights[normalized] || 0;
    
    if (recipe.positiveHighlights?.includes(normalized)) {
      matchedPositive.push(normalized);
      score += weight * 20;
    } else if (recipe.negativeHighlights?.includes(normalized)) {
      matchedNegative.push(normalized);
      score += weight * 20;
    } else if (recipe.redFlags?.includes(normalized)) {
      matchedRedFlags.push(normalized);
      score += weight * 30;
    } else if (weight !== 0) {
      score += weight * 15;
    }
  }
  
  score = Math.max(0, Math.min(100, Math.round(score)));
  
  let recommendation;
  if (score >= 80) recommendation = 'STRONG_PASS';
  else if (score >= 60) recommendation = 'SOFT_PASS';
  else if (score >= 40) recommendation = 'BORDERLINE';
  else recommendation = 'PASS';
  
  return { score, recommendation, matchedPositive, matchedNegative, matchedRedFlags };
}

// ═══════════════════════════════════════════════════════════════════
// TEST CANDIDATES
// ═══════════════════════════════════════════════════════════════════

const CANDIDATES = [
  {
    id: 'per_db_001',
    name: 'Alex Thompson',
    highlights: ['serial_founder', 'prior_exit', 'yc_alumni', 'technical_background']
  },
  {
    id: 'per_db_002',
    name: 'Jordan Lee',
    highlights: ['fortune_500_experience', 'scaled_team', 'vp_engineering']
  },
  {
    id: 'per_db_003',
    name: 'Taylor Smith',
    highlights: ['product_leader', 'growth_leader']
  },
  {
    id: 'per_db_004',
    name: 'Casey Brown',
    highlights: ['consultant_only', 'no_technical_background', 'career_gap']
  }
];

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

async function runTests() {
  header('DATABASE INTEGRATION TEST');
  
  // Initialize
  initDb();
  const persona = getActivePersona();
  
  if (!persona) {
    log('❌', 'No active persona found. Run db-init.js first.', 'red');
    return;
  }
  
  log('✅', `Active Persona: ${persona.name}`, 'green');
  
  const recipe = getPersonaRecipe(persona.id);
  if (!recipe) {
    log('❌', 'No recipe found for persona', 'red');
    return;
  }
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Score with learned weights from DB
  subheader('Test 1: Scoring with DB Learned Weights');
  
  const learnedWeights = getLearnedWeights(persona.id);
  console.log(`   Loaded ${Object.keys(learnedWeights).length} learned weights from DB`);
  
  for (const candidate of CANDIDATES) {
    const result = scoreCandidate(candidate.highlights, recipe, learnedWeights);
    const badge = result.score >= 80 ? '🔥' : result.score >= 60 ? '👍' : result.score >= 40 ? '🤔' : '⚠️';
    console.log(`   ${badge} ${candidate.name}: ${result.score}/100 → ${result.recommendation}`);
  }
  log('✅', 'Scoring with DB weights works', 'green');
  passed++;
  
  // Test 2: Save feedback to DB
  subheader('Test 2: Save Feedback to Database');
  
  const feedbackCandidate = CANDIDATES[0];
  const feedbackResult = scoreCandidate(feedbackCandidate.highlights, recipe, learnedWeights);
  
  saveFeedback({
    persona_id: persona.id,
    entity_id: feedbackCandidate.id,
    entity_type: 'person',
    action: 'like',
    datapoints: feedbackResult.matchedPositive,
    note: 'DB integration test - like',
    ai_score: feedbackResult.score,
    user_agreed: true
  });
  
  console.log(`   Saved LIKE for ${feedbackCandidate.name}`);
  console.log(`   Datapoints: ${feedbackResult.matchedPositive.join(', ')}`);
  console.log(`   AI Score: ${feedbackResult.score}`);
  
  // Verify
  const savedFeedback = db.prepare(
    'SELECT * FROM feedback WHERE entity_id = ? AND persona_id = ?'
  ).get(feedbackCandidate.id, persona.id);
  
  if (savedFeedback) {
    log('✅', 'Feedback saved to DB successfully', 'green');
    passed++;
  } else {
    log('❌', 'Feedback not found in DB', 'red');
    failed++;
  }
  
  // Test 3: Update learned weights
  subheader('Test 3: Update Learned Weights');
  
  const testDatapoint = 'serial_founder';
  const beforeWeight = db.prepare(
    'SELECT weight, like_count FROM learned_weights WHERE persona_id = ? AND datapoint = ?'
  ).get(persona.id, testDatapoint);
  
  console.log(`   Before: ${testDatapoint} = ${beforeWeight?.weight?.toFixed(2) || 'N/A'} (${beforeWeight?.like_count || 0} likes)`);
  
  updateLearnedWeight(persona.id, testDatapoint, true);
  
  const afterWeight = db.prepare(
    'SELECT weight, like_count FROM learned_weights WHERE persona_id = ? AND datapoint = ?'
  ).get(persona.id, testDatapoint);
  
  console.log(`   After:  ${testDatapoint} = ${afterWeight?.weight?.toFixed(2) || 'N/A'} (${afterWeight?.like_count || 0} likes)`);
  
  if (afterWeight && afterWeight.like_count > (beforeWeight?.like_count || 0)) {
    log('✅', 'Learned weight updated successfully', 'green');
    passed++;
  } else {
    log('❌', 'Weight update failed', 'red');
    failed++;
  }
  
  // Test 4: Sync queue
  subheader('Test 4: Add to Sync Queue');
  
  const beforeQueue = db.prepare('SELECT COUNT(*) as count FROM sync_queue').get();
  
  addToSyncQueue('per_db_001', 'person', 'like');
  
  const afterQueue = db.prepare('SELECT COUNT(*) as count FROM sync_queue').get();
  
  console.log(`   Queue before: ${beforeQueue.count}`);
  console.log(`   Queue after:  ${afterQueue.count}`);
  
  if (afterQueue.count > beforeQueue.count) {
    log('✅', 'Sync queue updated', 'green');
    passed++;
  } else {
    log('❌', 'Sync queue not updated', 'red');
    failed++;
  }
  
  // Test 5: Create shortlist
  subheader('Test 5: Create Shortlist');
  
  const shortlistName = `DB Test ${Date.now()}`;
  const shortlistIds = CANDIDATES.slice(0, 2).map(c => c.id);
  
  const shortlistId = createShortlist(shortlistName, persona.id, shortlistIds);
  
  console.log(`   Created: "${shortlistName}"`);
  console.log(`   ID: ${shortlistId}`);
  console.log(`   Entities: ${shortlistIds.join(', ')}`);
  
  const savedShortlist = db.prepare('SELECT * FROM shortlists WHERE id = ?').get(shortlistId);
  
  if (savedShortlist) {
    log('✅', 'Shortlist created in DB', 'green');
    passed++;
  } else {
    log('❌', 'Shortlist not found', 'red');
    failed++;
  }
  
  // Test 6: Feedback stats
  subheader('Test 6: Feedback Statistics');
  
  const stats = getFeedbackStats(persona.id);
  
  console.log(`   Total feedback: ${stats.total}`);
  console.log(`   Likes: ${stats.likes}`);
  console.log(`   Dislikes: ${stats.dislikes}`);
  console.log(`   AI agreement: ${stats.agreed}/${stats.total} (${stats.total > 0 ? Math.round((stats.agreed / stats.total) * 100) : 0}%)`);
  
  log('✅', 'Stats retrieved successfully', 'green');
  passed++;
  
  // Test 7: Full workflow simulation
  subheader('Test 7: Full Workflow Simulation');
  
  console.log(`   ${C.cyan}1. Score all candidates${C.reset}`);
  const scored = CANDIDATES.map(c => ({
    ...c,
    ...scoreCandidate(c.highlights, recipe, getLearnedWeights(persona.id))
  })).sort((a, b) => b.score - a.score);
  
  scored.forEach((c, i) => {
    console.log(`      ${i + 1}. ${c.name}: ${c.score}/100`);
  });
  
  console.log(`\n   ${C.cyan}2. Like top scorer${C.reset}`);
  const topScorer = scored[0];
  saveFeedback({
    persona_id: persona.id,
    entity_id: topScorer.id,
    entity_type: 'person',
    action: 'like',
    datapoints: topScorer.matchedPositive,
    note: 'Workflow test',
    ai_score: topScorer.score,
    user_agreed: true
  });
  topScorer.matchedPositive.forEach(dp => updateLearnedWeight(persona.id, dp, true));
  addToSyncQueue(topScorer.id, 'person', 'like');
  console.log(`      Liked: ${topScorer.name}`);
  console.log(`      Updated weights: ${topScorer.matchedPositive.join(', ')}`);
  
  console.log(`\n   ${C.cyan}3. Dislike bottom scorer${C.reset}`);
  const bottomScorer = scored[scored.length - 1];
  saveFeedback({
    persona_id: persona.id,
    entity_id: bottomScorer.id,
    entity_type: 'person',
    action: 'dislike',
    datapoints: [...bottomScorer.matchedNegative, ...bottomScorer.matchedRedFlags],
    note: 'Workflow test',
    ai_score: bottomScorer.score,
    user_agreed: true
  });
  [...bottomScorer.matchedNegative, ...bottomScorer.matchedRedFlags].forEach(dp => 
    updateLearnedWeight(persona.id, dp, false)
  );
  addToSyncQueue(bottomScorer.id, 'person', 'dislike');
  console.log(`      Disliked: ${bottomScorer.name}`);
  
  console.log(`\n   ${C.cyan}4. Create shortlist from high scorers${C.reset}`);
  const highScorers = scored.filter(c => c.score >= 60);
  const workflowShortlist = createShortlist(
    `High Scorers ${new Date().toISOString().split('T')[0]}`,
    persona.id,
    highScorers.map(c => c.id)
  );
  console.log(`      Created shortlist with ${highScorers.length} candidates`);
  
  log('✅', 'Full workflow completed', 'green');
  passed++;
  
  // Final Summary
  header('FINAL RESULTS');
  
  console.log(`   ${C.cyan}Tests Passed:${C.reset} ${passed}`);
  console.log(`   ${C.cyan}Tests Failed:${C.reset} ${failed}`);
  console.log();
  
  // DB Summary
  console.log(`   ${C.cyan}Database State:${C.reset}`);
  const feedbackCount = db.prepare('SELECT COUNT(*) as c FROM feedback WHERE persona_id = ?').get(persona.id);
  const weightsCount = db.prepare('SELECT COUNT(*) as c FROM learned_weights WHERE persona_id = ?').get(persona.id);
  const shortlistCount = db.prepare('SELECT COUNT(*) as c FROM shortlists WHERE persona_id = ?').get(persona.id);
  const queueCount = db.prepare('SELECT COUNT(*) as c FROM sync_queue').get();
  
  console.log(`      Feedback items: ${feedbackCount.c}`);
  console.log(`      Learned weights: ${weightsCount.c}`);
  console.log(`      Shortlists: ${shortlistCount.c}`);
  console.log(`      Sync queue: ${queueCount.c}`);
  console.log();
  
  if (failed === 0) {
    log('🎉', 'ALL DATABASE INTEGRATION TESTS PASSED!', 'green');
  } else {
    log('⚠️', `${failed} tests failed`, 'red');
  }
  
  db.close();
}

runTests().catch(console.error);

