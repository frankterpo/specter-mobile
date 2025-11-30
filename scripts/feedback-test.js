#!/usr/bin/env node
/**
 * Feedback Test Script
 * Tests like/dislike with datapoints and notes
 * 
 * Run: node scripts/feedback-test.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const readline = require('readline');

const DB_PATH = path.join(__dirname, '..', 'specter-ai.db');

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════════╗');
console.log('║ 👍 SPECTER AI - FEEDBACK TEST                                         ║');
console.log('╚═══════════════════════════════════════════════════════════════════════╝');
console.log('');

const db = new Database(DB_PATH);

// Get active persona
const activePersona = db.prepare('SELECT * FROM personas WHERE is_active = 1').get();
console.log(`Active Persona: ${activePersona.name}`);
console.log('');

// Sample candidates for testing
const SAMPLE_CANDIDATES = [
  {
    id: 'per_test_001',
    name: 'Sarah Chen',
    title: 'Founder & CEO',
    company: 'Stealth AI Startup',
    highlights: ['serial_founder', 'prior_exit', 'yc_alumni', 'stanford_alumni'],
    ai_score: 92,
    ai_recommendation: 'STRONG_PASS'
  },
  {
    id: 'per_test_002',
    name: 'Michael Rodriguez',
    title: 'VP Engineering',
    company: 'TechCorp',
    highlights: ['fortune_500_experience', 'technical_background', 'scaled_team'],
    ai_score: 68,
    ai_recommendation: 'SOFT_PASS'
  },
  {
    id: 'per_test_003',
    name: 'Emily Johnson',
    title: 'Product Manager',
    company: 'StartupXYZ',
    highlights: ['product_leader', 'no_startup_experience'],
    ai_score: 45,
    ai_recommendation: 'BORDERLINE'
  },
  {
    id: 'per_test_004',
    name: 'David Kim',
    title: 'Consultant',
    company: 'McKinsey',
    highlights: ['consultant_only', 'no_technical_background'],
    ai_score: 32,
    ai_recommendation: 'PASS'
  }
];

// Insert feedback function
function insertFeedback(candidate, action, datapoints, note, userAgreed) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO feedback 
    (persona_id, entity_id, entity_type, action, datapoints, note, ai_score, ai_recommendation, user_agreed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    activePersona.id,
    candidate.id,
    'person',
    action,
    JSON.stringify(datapoints),
    note,
    candidate.ai_score,
    candidate.ai_recommendation,
    userAgreed ? 1 : 0
  );
}

// Update learned weights
function updateWeight(datapoint, isLike) {
  const existing = db.prepare(
    'SELECT * FROM learned_weights WHERE persona_id = ? AND datapoint = ?'
  ).get(activePersona.id, datapoint);
  
  if (existing) {
    const newLikes = existing.like_count + (isLike ? 1 : 0);
    const newDislikes = existing.dislike_count + (isLike ? 0 : 1);
    const newWeight = (newLikes - newDislikes) / (newLikes + newDislikes);
    
    db.prepare(`
      UPDATE learned_weights 
      SET like_count = ?, dislike_count = ?, weight = ?, last_updated = datetime('now')
      WHERE persona_id = ? AND datapoint = ?
    `).run(newLikes, newDislikes, newWeight, activePersona.id, datapoint);
  } else {
    const weight = isLike ? 1.0 : -1.0;
    db.prepare(`
      INSERT INTO learned_weights (persona_id, datapoint, weight, like_count, dislike_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(activePersona.id, datapoint, weight, isLike ? 1 : 0, isLike ? 0 : 1);
  }
}

// Display candidate
function displayCandidate(candidate, index) {
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log(`CANDIDATE ${index + 1}/${SAMPLE_CANDIDATES.length}`);
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log(`   Name: ${candidate.name}`);
  console.log(`   Title: ${candidate.title}`);
  console.log(`   Company: ${candidate.company}`);
  console.log(`   Highlights: ${candidate.highlights.join(', ')}`);
  console.log('');
  console.log(`   🤖 AI Score: ${candidate.ai_score}/100`);
  console.log(`   🤖 AI Recommendation: ${candidate.ai_recommendation}`);
  console.log('');
}

// Simulate automated feedback for demo
console.log('📝 Simulating Feedback (Automated Demo):');
console.log('');

SAMPLE_CANDIDATES.forEach((candidate, i) => {
  displayCandidate(candidate, i);
  
  // Simulate user feedback based on AI recommendation
  let action, userAgreed;
  
  if (candidate.ai_score >= 60) {
    // AI recommends pass - user agrees
    action = 'like';
    userAgreed = true;
    console.log(`   👍 USER: LIKE (Agreed with AI)`);
  } else if (candidate.ai_score >= 40) {
    // AI borderline - user disagrees (likes anyway)
    action = 'like';
    userAgreed = false;
    console.log(`   👍 USER: LIKE (Disagreed with AI - saw potential)`);
  } else {
    // AI recommends pass - user agrees
    action = 'dislike';
    userAgreed = true;
    console.log(`   👎 USER: DISLIKE (Agreed with AI)`);
  }
  
  // Select datapoints for feedback
  const selectedDatapoints = candidate.highlights.slice(0, 2);
  console.log(`   📌 Datapoints: ${selectedDatapoints.join(', ')}`);
  
  const note = action === 'like' 
    ? 'Strong founder profile, worth meeting'
    : 'Not a fit for early stage';
  console.log(`   📝 Note: "${note}"`);
  
  // Insert feedback
  insertFeedback(candidate, action, selectedDatapoints, note, userAgreed);
  
  // Update weights for each datapoint
  selectedDatapoints.forEach(dp => updateWeight(dp, action === 'like'));
  
  console.log(`   ✅ Feedback saved`);
  console.log('');
});

// Show feedback summary
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('📊 FEEDBACK SUMMARY');
console.log('═══════════════════════════════════════════════════════════════════════');

const feedbackStats = db.prepare(`
  SELECT 
    action,
    COUNT(*) as count,
    SUM(CASE WHEN user_agreed = 1 THEN 1 ELSE 0 END) as agreed_count
  FROM feedback 
  WHERE persona_id = ?
  GROUP BY action
`).all(activePersona.id);

feedbackStats.forEach(stat => {
  const emoji = stat.action === 'like' ? '👍' : '👎';
  console.log(`   ${emoji} ${stat.action.toUpperCase()}: ${stat.count} (${stat.agreed_count} agreed with AI)`);
});

const totalFeedback = db.prepare('SELECT COUNT(*) as count FROM feedback WHERE persona_id = ?').get(activePersona.id);
console.log(`   📊 Total: ${totalFeedback.count} feedback items`);

// Show learned weights
console.log('');
console.log('📈 LEARNED WEIGHTS (Updated from Feedback):');
console.log('─────────────────────────────────────────────────────────────────────');

const weights = db.prepare(`
  SELECT * FROM learned_weights 
  WHERE persona_id = ? 
  ORDER BY weight DESC
`).all(activePersona.id);

weights.forEach(w => {
  const bar = w.weight > 0 
    ? '█'.repeat(Math.round(w.weight * 10)) 
    : '░'.repeat(Math.round(Math.abs(w.weight) * 10));
  const sign = w.weight > 0 ? '+' : '';
  console.log(`   ${w.datapoint.padEnd(25)} ${sign}${w.weight.toFixed(2)} ${bar} (${w.like_count}👍 ${w.dislike_count}👎)`);
});

db.close();

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('✅ FEEDBACK TEST COMPLETED');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');
console.log('Next: Run node scripts/rl-weights.js to see weight calculations');
console.log('');

