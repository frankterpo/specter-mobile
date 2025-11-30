#!/usr/bin/env node
/**
 * RL Weights Script
 * Displays and analyzes learned weights from feedback
 * 
 * Run: node scripts/rl-weights.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'specter-ai.db');

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════════╗');
console.log('║ 🧠 SPECTER AI - REINFORCEMENT LEARNING WEIGHTS                        ║');
console.log('╚═══════════════════════════════════════════════════════════════════════╝');
console.log('');

const db = new Database(DB_PATH);

// Get all personas
const personas = db.prepare('SELECT * FROM personas').all();

personas.forEach(persona => {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`${persona.name}`);
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  // Get feedback stats
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN action = 'like' THEN 1 ELSE 0 END) as likes,
      SUM(CASE WHEN action = 'dislike' THEN 1 ELSE 0 END) as dislikes,
      SUM(CASE WHEN user_agreed = 1 THEN 1 ELSE 0 END) as agreed,
      AVG(ai_score) as avg_ai_score
    FROM feedback 
    WHERE persona_id = ?
  `).get(persona.id);
  
  if (stats.total === 0) {
    console.log('   No feedback data yet');
    console.log('');
    return;
  }
  
  console.log('');
  console.log('📊 Feedback Statistics:');
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log(`   Total Feedback: ${stats.total}`);
  console.log(`   Likes: ${stats.likes} (${((stats.likes / stats.total) * 100).toFixed(1)}%)`);
  console.log(`   Dislikes: ${stats.dislikes} (${((stats.dislikes / stats.total) * 100).toFixed(1)}%)`);
  console.log(`   AI Agreement Rate: ${((stats.agreed / stats.total) * 100).toFixed(1)}%`);
  console.log(`   Avg AI Score: ${stats.avg_ai_score?.toFixed(1) || 'N/A'}`);
  
  // Get positive weights
  const positiveWeights = db.prepare(`
    SELECT * FROM learned_weights 
    WHERE persona_id = ? AND weight > 0
    ORDER BY weight DESC
    LIMIT 10
  `).all(persona.id);
  
  if (positiveWeights.length > 0) {
    console.log('');
    console.log('🟢 Top Positive Signals (Learned):');
    console.log('─────────────────────────────────────────────────────────────────────');
    
    positiveWeights.forEach((w, i) => {
      const bar = '█'.repeat(Math.round(w.weight * 10));
      console.log(`   ${(i + 1).toString().padStart(2)}. ${w.datapoint.padEnd(25)} +${w.weight.toFixed(2)} ${bar}`);
      console.log(`       (${w.like_count} likes, ${w.dislike_count} dislikes)`);
    });
  }
  
  // Get negative weights
  const negativeWeights = db.prepare(`
    SELECT * FROM learned_weights 
    WHERE persona_id = ? AND weight < 0
    ORDER BY weight ASC
    LIMIT 10
  `).all(persona.id);
  
  if (negativeWeights.length > 0) {
    console.log('');
    console.log('🔴 Top Negative Signals (Learned):');
    console.log('─────────────────────────────────────────────────────────────────────');
    
    negativeWeights.forEach((w, i) => {
      const bar = '░'.repeat(Math.round(Math.abs(w.weight) * 10));
      console.log(`   ${(i + 1).toString().padStart(2)}. ${w.datapoint.padEnd(25)} ${w.weight.toFixed(2)} ${bar}`);
      console.log(`       (${w.like_count} likes, ${w.dislike_count} dislikes)`);
    });
  }
  
  // Compare with recipe defaults
  const recipe = persona.recipe_json ? JSON.parse(persona.recipe_json) : null;
  
  if (recipe && recipe.weights) {
    console.log('');
    console.log('📈 Weight Drift (Learned vs Recipe Default):');
    console.log('─────────────────────────────────────────────────────────────────────');
    
    const allWeights = db.prepare(`
      SELECT * FROM learned_weights WHERE persona_id = ?
    `).all(persona.id);
    
    allWeights.forEach(learned => {
      const defaultWeight = recipe.weights[learned.datapoint];
      if (defaultWeight !== undefined) {
        const drift = learned.weight - defaultWeight;
        const driftStr = drift > 0 ? `+${drift.toFixed(2)}` : drift.toFixed(2);
        const arrow = drift > 0.1 ? '↑' : drift < -0.1 ? '↓' : '→';
        console.log(`   ${learned.datapoint.padEnd(25)} Default: ${defaultWeight.toFixed(2)} → Learned: ${learned.weight.toFixed(2)} (${arrow} ${driftStr})`);
      }
    });
  }
  
  console.log('');
});

// Export summary
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('📤 EXPORT FOR HUGGING FACE FINE-TUNING');
console.log('═══════════════════════════════════════════════════════════════════════');

const allFeedback = db.prepare(`
  SELECT 
    f.*,
    p.name as persona_name
  FROM feedback f
  JOIN personas p ON f.persona_id = p.id
`).all();

if (allFeedback.length > 0) {
  console.log('');
  console.log('DPO Training Pairs (Direct Preference Optimization):');
  console.log('─────────────────────────────────────────────────────────────────────');
  
  // Group by entity to create preference pairs
  const entities = {};
  allFeedback.forEach(f => {
    if (!entities[f.entity_id]) {
      entities[f.entity_id] = [];
    }
    entities[f.entity_id].push(f);
  });
  
  let pairCount = 0;
  Object.entries(entities).forEach(([entityId, feedbacks]) => {
    const likes = feedbacks.filter(f => f.action === 'like');
    const dislikes = feedbacks.filter(f => f.action === 'dislike');
    
    // Create pairs where same entity was liked by one persona, disliked by another
    // This is useful for training persona-specific preferences
    if (likes.length > 0 || dislikes.length > 0) {
      pairCount++;
      const f = feedbacks[0];
      console.log(`   ${pairCount}. Entity: ${entityId}`);
      console.log(`      Action: ${f.action}`);
      console.log(`      Datapoints: ${f.datapoints || '[]'}`);
      console.log(`      AI Score: ${f.ai_score}, User Agreed: ${f.user_agreed ? 'Yes' : 'No'}`);
    }
  });
  
  console.log('');
  console.log(`Total training examples: ${allFeedback.length}`);
  console.log('');
  console.log('Export command: node scripts/export-training.js');
} else {
  console.log('');
  console.log('No feedback data to export yet.');
  console.log('Run: node scripts/feedback-test.js to generate sample data');
}

db.close();

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('✅ RL WEIGHTS ANALYSIS COMPLETED');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');

