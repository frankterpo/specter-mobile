#!/usr/bin/env node
/**
 * Database Initialization Script
 * Initializes SQLite database with persona recipes
 * 
 * Run: node scripts/db-init.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database path
const DB_PATH = path.join(__dirname, '..', 'specter-ai.db');

// Persona recipes
const PERSONAS = [
  {
    id: 'early',
    name: '🌱 Early Stage VC',
    description: 'Pre-seed to Seed investors looking for exceptional founders',
    recipe_json: JSON.stringify({
      positiveHighlights: ['serial_founder', 'prior_exit', 'yc_alumni', 'techstars_alumni', 'unicorn_experience', 'fortune_500_experience'],
      negativeHighlights: ['no_linkedin', 'career_gap', 'short_tenure'],
      redFlags: ['stealth_only', 'no_experience', 'junior_level'],
      weights: {
        serial_founder: 0.95, prior_exit: 0.90, yc_alumni: 0.85, unicorn_experience: 0.85,
        no_linkedin: -0.30, career_gap: -0.20, stealth_only: -0.50, no_experience: -0.80
      }
    }),
    is_active: 1
  },
  {
    id: 'growth',
    name: '📈 Growth Stage VC',
    description: 'Series A to C investors looking for proven operators',
    recipe_json: JSON.stringify({
      positiveHighlights: ['scaled_company', 'revenue_growth', 'team_builder', 'market_leader', 'enterprise_sales'],
      negativeHighlights: ['early_stage_only', 'no_scale_experience', 'single_company'],
      redFlags: ['no_revenue_experience', 'startup_hopper'],
      weights: {
        scaled_company: 0.90, revenue_growth: 0.85, team_builder: 0.80,
        early_stage_only: -0.40, no_revenue_experience: -0.60
      }
    }),
    is_active: 0
  },
  {
    id: 'pe',
    name: '🏦 Private Equity',
    description: 'PE investors looking for operational excellence',
    recipe_json: JSON.stringify({
      positiveHighlights: ['fortune_500_executive', 'turnaround_experience', 'ceo_experience', 'cfo_experience', 'ma_experience'],
      negativeHighlights: ['startup_only', 'no_p_and_l', 'tech_only'],
      redFlags: ['no_corporate_experience', 'junior_roles_only'],
      weights: {
        fortune_500_executive: 0.85, turnaround_experience: 0.90, ceo_experience: 0.90,
        startup_only: -0.50, no_corporate_experience: -0.60
      }
    }),
    is_active: 0
  },
  {
    id: 'ib',
    name: '🤝 Investment Banker',
    description: 'IB professionals looking for M&A and IPO candidates',
    recipe_json: JSON.stringify({
      positiveHighlights: ['market_leader', 'high_growth', 'profitable', 'ipo_ready', 'strategic_asset'],
      negativeHighlights: ['early_stage', 'pre_revenue', 'single_product'],
      redFlags: ['declining_growth', 'no_clear_exit'],
      weights: {
        market_leader: 0.90, high_growth: 0.80, profitable: 0.85, ipo_ready: 0.90,
        early_stage: -0.50, declining_growth: -0.70
      }
    }),
    is_active: 0
  }
];

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════════╗');
console.log('║ 🗄️  SPECTER AI - DATABASE INITIALIZATION                              ║');
console.log('╚═══════════════════════════════════════════════════════════════════════╝');
console.log('');

// Remove existing database if it exists
if (fs.existsSync(DB_PATH)) {
  console.log('📁 Removing existing database...');
  fs.unlinkSync(DB_PATH);
}

// Create database
console.log(`📁 Creating database at: ${DB_PATH}`);
const db = new Database(DB_PATH);

// Create tables
console.log('📋 Creating tables...');

db.exec(`
  -- PERSONAS TABLE
  CREATE TABLE IF NOT EXISTS personas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    recipe_json TEXT,
    is_active INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- FEEDBACK TABLE
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    action TEXT NOT NULL,
    datapoints TEXT,
    note TEXT,
    ai_score INTEGER,
    ai_recommendation TEXT,
    user_agreed INTEGER,
    synced_to_specter INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(persona_id, entity_id)
  );

  -- LEARNED WEIGHTS TABLE
  CREATE TABLE IF NOT EXISTS learned_weights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id TEXT NOT NULL,
    datapoint TEXT NOT NULL,
    weight REAL DEFAULT 0.0,
    like_count INTEGER DEFAULT 0,
    dislike_count INTEGER DEFAULT 0,
    last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(persona_id, datapoint)
  );

  -- AGENT MEMORY TABLE
  CREATE TABLE IF NOT EXISTS agent_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id TEXT NOT NULL,
    memory_type TEXT NOT NULL,
    content TEXT NOT NULL,
    importance REAL DEFAULT 0.5,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- SYNC QUEUE TABLE
  CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    action TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- SHORTLISTS TABLE
  CREATE TABLE IF NOT EXISTS shortlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    persona_id TEXT NOT NULL,
    entity_ids TEXT NOT NULL,
    specter_list_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- TRAINING EXPORTS TABLE
  CREATE TABLE IF NOT EXISTS training_exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id TEXT NOT NULL,
    export_type TEXT NOT NULL,
    data_json TEXT NOT NULL,
    record_count INTEGER,
    exported_at TEXT DEFAULT CURRENT_TIMESTAMP,
    hf_dataset_id TEXT,
    status TEXT DEFAULT 'pending'
  );

  -- INDEXES
  CREATE INDEX IF NOT EXISTS idx_feedback_persona ON feedback(persona_id);
  CREATE INDEX IF NOT EXISTS idx_feedback_entity ON feedback(entity_id);
  CREATE INDEX IF NOT EXISTS idx_feedback_action ON feedback(action);
  CREATE INDEX IF NOT EXISTS idx_feedback_sync ON feedback(synced_to_specter);
  CREATE INDEX IF NOT EXISTS idx_weights_persona ON learned_weights(persona_id);
  CREATE INDEX IF NOT EXISTS idx_memory_persona ON agent_memory(persona_id);
`);

console.log('✅ Tables created');

// Insert personas
console.log('👤 Inserting personas...');

const insertPersona = db.prepare(`
  INSERT OR REPLACE INTO personas (id, name, description, recipe_json, is_active)
  VALUES (?, ?, ?, ?, ?)
`);

for (const persona of PERSONAS) {
  insertPersona.run(persona.id, persona.name, persona.description, persona.recipe_json, persona.is_active);
  console.log(`   ✓ ${persona.name}`);
}

// Verify
console.log('');
console.log('📊 Database Summary:');
console.log('─────────────────────────────────────────────────────────────────────');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(`   Tables: ${tables.map(t => t.name).join(', ')}`);

const personaCount = db.prepare('SELECT COUNT(*) as count FROM personas').get();
console.log(`   Personas: ${personaCount.count}`);

const activePersona = db.prepare('SELECT * FROM personas WHERE is_active = 1').get();
console.log(`   Active Persona: ${activePersona ? activePersona.name : 'None'}`);

db.close();

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('✅ DATABASE INITIALIZED SUCCESSFULLY');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');
console.log('Next steps:');
console.log('  1. Run: node scripts/persona-test.js');
console.log('  2. Run: node scripts/feedback-test.js');
console.log('  3. Run: node scripts/rl-weights.js');
console.log('');

