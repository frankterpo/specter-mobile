#!/usr/bin/env node
/**
 * Persona Test Script
 * Tests persona switching and recipe loading
 * 
 * Run: node scripts/persona-test.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'specter-ai.db');

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════════╗');
console.log('║ 👤 SPECTER AI - PERSONA TEST                                          ║');
console.log('╚═══════════════════════════════════════════════════════════════════════╝');
console.log('');

const db = new Database(DB_PATH);

// Get all personas
console.log('📋 Available Personas:');
console.log('─────────────────────────────────────────────────────────────────────');

const personas = db.prepare('SELECT * FROM personas').all();

personas.forEach((p, i) => {
  const active = p.is_active ? ' ✓ ACTIVE' : '';
  console.log(`   ${i + 1}. ${p.name}${active}`);
  console.log(`      ${p.description}`);
  
  if (p.recipe_json) {
    const recipe = JSON.parse(p.recipe_json);
    console.log(`      Positive signals: ${recipe.positiveHighlights.slice(0, 3).join(', ')}...`);
    console.log(`      Red flags: ${recipe.redFlags.slice(0, 2).join(', ')}`);
  }
  console.log('');
});

// Test persona switching
console.log('🔄 Testing Persona Switching:');
console.log('─────────────────────────────────────────────────────────────────────');

function switchPersona(personaId) {
  db.prepare('UPDATE personas SET is_active = 0').run();
  db.prepare('UPDATE personas SET is_active = 1 WHERE id = ?').run(personaId);
  
  const active = db.prepare('SELECT * FROM personas WHERE is_active = 1').get();
  return active;
}

// Switch to each persona
for (const persona of personas) {
  const active = switchPersona(persona.id);
  console.log(`   Switched to: ${active.name}`);
}

// Switch back to early stage
switchPersona('early');
const finalActive = db.prepare('SELECT * FROM personas WHERE is_active = 1').get();
console.log(`   Final active: ${finalActive.name}`);

// Test recipe loading
console.log('');
console.log('📖 Testing Recipe Loading:');
console.log('─────────────────────────────────────────────────────────────────────');

const earlyRecipe = JSON.parse(finalActive.recipe_json);

console.log(`   Persona: ${finalActive.name}`);
console.log(`   Positive Highlights (${earlyRecipe.positiveHighlights.length}):`);
earlyRecipe.positiveHighlights.forEach(h => {
  const weight = earlyRecipe.weights[h] || 0;
  console.log(`      • ${h} (weight: ${weight.toFixed(2)})`);
});

console.log(`   Negative Highlights (${earlyRecipe.negativeHighlights.length}):`);
earlyRecipe.negativeHighlights.forEach(h => {
  const weight = earlyRecipe.weights[h] || 0;
  console.log(`      • ${h} (weight: ${weight.toFixed(2)})`);
});

console.log(`   Red Flags (${earlyRecipe.redFlags.length}):`);
earlyRecipe.redFlags.forEach(h => {
  const weight = earlyRecipe.weights[h] || 0;
  console.log(`      • ${h} (weight: ${weight.toFixed(2)})`);
});

db.close();

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('✅ PERSONA TEST COMPLETED');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');

