#!/usr/bin/env node
/**
 * Export Training Data Script
 * Exports feedback and weights for HuggingFace fine-tuning
 * 
 * Run: node scripts/export-training.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'specter-ai.db');

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════════╗');
console.log('║ 📤 SPECTER AI - EXPORT TRAINING DATA                                  ║');
console.log('╚═══════════════════════════════════════════════════════════════════════╝');
console.log('');

const db = new Database(DB_PATH);

// Get all personas
const personas = db.prepare('SELECT * FROM personas').all();

console.log('📋 Exporting training data for all personas...');
console.log('');

const allExports = [];

personas.forEach(persona => {
  console.log(`─────────────────────────────────────────────────────────────────────`);
  console.log(`${persona.name}`);
  console.log(`─────────────────────────────────────────────────────────────────────`);
  
  // Get feedback
  const feedback = db.prepare('SELECT * FROM feedback WHERE persona_id = ?').all(persona.id);
  
  // Get weights
  const weights = db.prepare('SELECT * FROM learned_weights WHERE persona_id = ?').all(persona.id);
  
  if (feedback.length === 0 && weights.length === 0) {
    console.log('   No data to export');
    console.log('');
    return;
  }
  
  console.log(`   Feedback items: ${feedback.length}`);
  console.log(`   Learned weights: ${weights.length}`);
  
  // Create export object
  const exportData = {
    persona: {
      id: persona.id,
      name: persona.name,
      description: persona.description,
      recipe: persona.recipe_json ? JSON.parse(persona.recipe_json) : null
    },
    metadata: {
      exported_at: new Date().toISOString(),
      feedback_count: feedback.length,
      weights_count: weights.length
    },
    preference_pairs: feedback.map(f => ({
      entity_id: f.entity_id,
      entity_type: f.entity_type,
      action: f.action,
      datapoints: f.datapoints ? JSON.parse(f.datapoints) : [],
      note: f.note,
      ai_score: f.ai_score,
      ai_recommendation: f.ai_recommendation,
      user_agreed: f.user_agreed === 1,
      created_at: f.created_at
    })),
    learned_weights: weights.map(w => ({
      datapoint: w.datapoint,
      weight: w.weight,
      like_count: w.like_count,
      dislike_count: w.dislike_count,
      last_updated: w.last_updated
    }))
  };
  
  allExports.push(exportData);
  
  // Save individual persona export
  const exportPath = path.join(__dirname, `training-${persona.id}.json`);
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
  console.log(`   Saved to: ${exportPath}`);
  console.log('');
});

// Save combined export
const combinedPath = path.join(__dirname, 'training-all.json');
fs.writeFileSync(combinedPath, JSON.stringify({
  exported_at: new Date().toISOString(),
  personas: allExports
}, null, 2));

console.log('═══════════════════════════════════════════════════════════════════════');
console.log('📊 EXPORT SUMMARY');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');

let totalFeedback = 0;
let totalWeights = 0;

allExports.forEach(exp => {
  totalFeedback += exp.metadata.feedback_count;
  totalWeights += exp.metadata.weights_count;
});

console.log(`   Total personas: ${allExports.length}`);
console.log(`   Total feedback: ${totalFeedback}`);
console.log(`   Total weights: ${totalWeights}`);
console.log('');
console.log(`   Combined export: ${combinedPath}`);
console.log('');

// Generate DPO format for HuggingFace
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('🤗 HUGGING FACE DPO FORMAT');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');

const dpoData = [];

allExports.forEach(exp => {
  exp.preference_pairs.forEach(pair => {
    // Create DPO training example
    const prompt = `Evaluate this candidate for ${exp.persona.name}:\nDatapoints: ${pair.datapoints.join(', ')}`;
    
    const chosen = pair.action === 'like' 
      ? `This candidate is a good fit. Key signals: ${pair.datapoints.join(', ')}. ${pair.note || ''}`
      : `This candidate is not a good fit. Concerns: ${pair.datapoints.join(', ')}. ${pair.note || ''}`;
    
    const rejected = pair.action === 'like'
      ? `This candidate is not a good fit.`
      : `This candidate is a good fit.`;
    
    dpoData.push({
      prompt,
      chosen,
      rejected,
      persona: exp.persona.id,
      entity_id: pair.entity_id,
      ai_score: pair.ai_score,
      user_agreed: pair.user_agreed
    });
  });
});

if (dpoData.length > 0) {
  const dpoPath = path.join(__dirname, 'training-dpo.jsonl');
  const dpoLines = dpoData.map(d => JSON.stringify(d)).join('\n');
  fs.writeFileSync(dpoPath, dpoLines);
  
  console.log(`   DPO training examples: ${dpoData.length}`);
  console.log(`   Saved to: ${dpoPath}`);
  console.log('');
  console.log('   Sample DPO entry:');
  console.log('   ' + JSON.stringify(dpoData[0], null, 2).split('\n').join('\n   '));
} else {
  console.log('   No DPO data to export (need feedback first)');
}

db.close();

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('✅ EXPORT COMPLETED');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');
console.log('Next steps:');
console.log('  1. Upload training-dpo.jsonl to HuggingFace');
console.log('  2. Fine-tune with TRL library');
console.log('  3. Download fine-tuned model for Cactus SDK');
console.log('');

