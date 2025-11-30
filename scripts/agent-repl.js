#!/usr/bin/env node
/**
 * Agent REPL Script
 * Interactive testing of AI agent with tools
 * 
 * Run: node scripts/agent-repl.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const readline = require('readline');

const DB_PATH = path.join(__dirname, '..', 'specter-ai.db');

// ANSI colors
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════════╗');
console.log('║ 🤖 SPECTER AI AGENT - INTERACTIVE REPL                                ║');
console.log('╚═══════════════════════════════════════════════════════════════════════╝');
console.log('');

const db = new Database(DB_PATH);

// Get active persona
let activePersona = db.prepare('SELECT * FROM personas WHERE is_active = 1').get();
let activeRecipe = activePersona?.recipe_json ? JSON.parse(activePersona.recipe_json) : null;

// Available tools
const TOOLS = {
  switch_persona: {
    description: 'Switch to a different persona',
    parameters: ['persona_id'],
    execute: (args) => {
      const personaId = args[0];
      db.prepare('UPDATE personas SET is_active = 0').run();
      db.prepare('UPDATE personas SET is_active = 1 WHERE id = ?').run(personaId);
      activePersona = db.prepare('SELECT * FROM personas WHERE is_active = 1').get();
      activeRecipe = activePersona?.recipe_json ? JSON.parse(activePersona.recipe_json) : null;
      return `Switched to ${activePersona.name}`;
    }
  },
  
  list_personas: {
    description: 'List all available personas',
    parameters: [],
    execute: () => {
      const personas = db.prepare('SELECT * FROM personas').all();
      return personas.map(p => `${p.is_active ? '✓' : ' '} ${p.id}: ${p.name}`).join('\n');
    }
  },
  
  get_feedback_stats: {
    description: 'Get feedback statistics for current persona',
    parameters: [],
    execute: () => {
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN action = 'like' THEN 1 ELSE 0 END) as likes,
          SUM(CASE WHEN action = 'dislike' THEN 1 ELSE 0 END) as dislikes
        FROM feedback WHERE persona_id = ?
      `).get(activePersona.id);
      return `Total: ${stats.total}, Likes: ${stats.likes}, Dislikes: ${stats.dislikes}`;
    }
  },
  
  get_top_weights: {
    description: 'Get top learned weights for current persona',
    parameters: ['limit'],
    execute: (args) => {
      const limit = parseInt(args[0]) || 5;
      const weights = db.prepare(`
        SELECT * FROM learned_weights 
        WHERE persona_id = ? 
        ORDER BY ABS(weight) DESC 
        LIMIT ?
      `).all(activePersona.id, limit);
      
      if (weights.length === 0) return 'No learned weights yet';
      
      return weights.map(w => {
        const sign = w.weight > 0 ? '+' : '';
        return `${w.datapoint}: ${sign}${w.weight.toFixed(2)} (${w.like_count}👍 ${w.dislike_count}👎)`;
      }).join('\n');
    }
  },
  
  score_candidate: {
    description: 'Score a candidate with highlights',
    parameters: ['highlights (comma-separated)'],
    execute: (args) => {
      const highlights = args[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
      
      if (!activeRecipe) return 'No recipe loaded';
      
      let score = 50;
      const matched = [];
      
      // Get learned weights
      const learnedWeights = {};
      const weights = db.prepare('SELECT * FROM learned_weights WHERE persona_id = ?').all(activePersona.id);
      weights.forEach(w => learnedWeights[w.datapoint] = w.weight);
      
      // Score against recipe
      for (const h of highlights) {
        // Check positive
        if (activeRecipe.positiveHighlights.some(p => h.includes(p) || p.includes(h))) {
          const weight = learnedWeights[h] || activeRecipe.weights[h] || 0.5;
          score += weight * 20;
          matched.push(`+${h}`);
        }
        // Check negative
        if (activeRecipe.negativeHighlights.some(n => h.includes(n) || n.includes(h))) {
          const weight = learnedWeights[h] || activeRecipe.weights[h] || -0.3;
          score += weight * 20;
          matched.push(`-${h}`);
        }
        // Check red flags
        if (activeRecipe.redFlags.some(r => h.includes(r) || r.includes(h))) {
          const weight = learnedWeights[h] || activeRecipe.weights[h] || -0.5;
          score += weight * 30;
          matched.push(`🚩${h}`);
        }
      }
      
      score = Math.max(0, Math.min(100, Math.round(score)));
      
      let recommendation;
      if (score >= 80) recommendation = 'STRONG_PASS';
      else if (score >= 60) recommendation = 'SOFT_PASS';
      else if (score >= 40) recommendation = 'BORDERLINE';
      else recommendation = 'PASS';
      
      return `Score: ${score}/100\nRecommendation: ${recommendation}\nMatched: ${matched.join(', ') || 'none'}`;
    }
  },
  
  bulk_like: {
    description: 'Like multiple entities by ID',
    parameters: ['entity_ids (comma-separated)', 'datapoints (comma-separated)'],
    execute: (args) => {
      const entityIds = args[0].split(',').map(id => id.trim());
      const datapoints = args[1] ? args[1].split(',').map(d => d.trim()) : [];
      
      let count = 0;
      for (const entityId of entityIds) {
        db.prepare(`
          INSERT OR REPLACE INTO feedback 
          (persona_id, entity_id, entity_type, action, datapoints)
          VALUES (?, ?, 'person', 'like', ?)
        `).run(activePersona.id, entityId, JSON.stringify(datapoints));
        
        // Update weights
        for (const dp of datapoints) {
          const existing = db.prepare('SELECT * FROM learned_weights WHERE persona_id = ? AND datapoint = ?').get(activePersona.id, dp);
          if (existing) {
            db.prepare('UPDATE learned_weights SET like_count = like_count + 1, weight = CAST(like_count + 1 - dislike_count AS REAL) / CAST(like_count + 1 + dislike_count AS REAL) WHERE id = ?').run(existing.id);
          } else {
            db.prepare('INSERT INTO learned_weights (persona_id, datapoint, weight, like_count, dislike_count) VALUES (?, ?, 1.0, 1, 0)').run(activePersona.id, dp);
          }
        }
        
        // Add to sync queue
        db.prepare('INSERT INTO sync_queue (entity_id, entity_type, action) VALUES (?, ?, ?)').run(entityId, 'person', 'like');
        
        count++;
      }
      
      return `Liked ${count} entities. Added to sync queue.`;
    }
  },
  
  bulk_dislike: {
    description: 'Dislike multiple entities by ID',
    parameters: ['entity_ids (comma-separated)', 'datapoints (comma-separated)'],
    execute: (args) => {
      const entityIds = args[0].split(',').map(id => id.trim());
      const datapoints = args[1] ? args[1].split(',').map(d => d.trim()) : [];
      
      let count = 0;
      for (const entityId of entityIds) {
        db.prepare(`
          INSERT OR REPLACE INTO feedback 
          (persona_id, entity_id, entity_type, action, datapoints)
          VALUES (?, ?, 'person', 'dislike', ?)
        `).run(activePersona.id, entityId, JSON.stringify(datapoints));
        
        // Update weights
        for (const dp of datapoints) {
          const existing = db.prepare('SELECT * FROM learned_weights WHERE persona_id = ? AND datapoint = ?').get(activePersona.id, dp);
          if (existing) {
            db.prepare('UPDATE learned_weights SET dislike_count = dislike_count + 1, weight = CAST(like_count - dislike_count - 1 AS REAL) / CAST(like_count + dislike_count + 1 AS REAL) WHERE id = ?').run(existing.id);
          } else {
            db.prepare('INSERT INTO learned_weights (persona_id, datapoint, weight, like_count, dislike_count) VALUES (?, ?, -1.0, 0, 1)').run(activePersona.id, dp);
          }
        }
        
        // Add to sync queue
        db.prepare('INSERT INTO sync_queue (entity_id, entity_type, action) VALUES (?, ?, ?)').run(entityId, 'person', 'dislike');
        
        count++;
      }
      
      return `Disliked ${count} entities. Added to sync queue.`;
    }
  },
  
  get_sync_queue: {
    description: 'Show pending syncs to Specter API',
    parameters: [],
    execute: () => {
      const queue = db.prepare('SELECT * FROM sync_queue WHERE attempts < 3').all();
      if (queue.length === 0) return 'Sync queue is empty';
      return queue.map(q => `${q.action}: ${q.entity_id} (attempts: ${q.attempts})`).join('\n');
    }
  },
  
  export_training: {
    description: 'Export training data for HF fine-tuning',
    parameters: [],
    execute: () => {
      const feedback = db.prepare('SELECT * FROM feedback WHERE persona_id = ?').all(activePersona.id);
      const weights = db.prepare('SELECT * FROM learned_weights WHERE persona_id = ?').all(activePersona.id);
      
      const exportData = {
        persona_id: activePersona.id,
        persona_name: activePersona.name,
        exported_at: new Date().toISOString(),
        feedback_count: feedback.length,
        weights_count: weights.length,
        preference_pairs: feedback.map(f => ({
          entity_id: f.entity_id,
          action: f.action,
          datapoints: f.datapoints ? JSON.parse(f.datapoints) : [],
          ai_score: f.ai_score,
          user_agreed: f.user_agreed === 1
        })),
        learned_weights: weights.map(w => ({
          datapoint: w.datapoint,
          weight: w.weight,
          like_count: w.like_count,
          dislike_count: w.dislike_count
        }))
      };
      
      // Save to file
      const fs = require('fs');
      const exportPath = path.join(__dirname, `training-export-${activePersona.id}.json`);
      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
      
      return `Exported ${feedback.length} feedback items and ${weights.length} weights to:\n${exportPath}`;
    }
  },
  
  help: {
    description: 'Show available commands',
    parameters: [],
    execute: () => {
      return Object.entries(TOOLS)
        .map(([name, tool]) => `${name}(${tool.parameters.join(', ')})\n  ${tool.description}`)
        .join('\n\n');
    }
  }
};

// Show current state
console.log(`${CYAN}Active Persona:${RESET} ${activePersona?.name || 'None'}`);
console.log('');
console.log(`${YELLOW}Commands:${RESET}`);
console.log('  help                    - Show all commands');
console.log('  list_personas           - List personas');
console.log('  switch_persona <id>     - Switch persona');
console.log('  score_candidate <h1,h2> - Score by highlights');
console.log('  bulk_like <ids> <dps>   - Like entities');
console.log('  bulk_dislike <ids> <dps>- Dislike entities');
console.log('  get_feedback_stats      - Show feedback stats');
console.log('  get_top_weights <n>     - Show top learned weights');
console.log('  export_training         - Export for HF');
console.log('  exit                    - Exit REPL');
console.log('');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `${GREEN}agent>${RESET} `
});

rl.prompt();

rl.on('line', (line) => {
  const input = line.trim();
  
  if (!input) {
    rl.prompt();
    return;
  }
  
  if (input === 'exit' || input === 'quit') {
    console.log('Goodbye!');
    db.close();
    process.exit(0);
  }
  
  // Parse command
  const match = input.match(/^(\w+)(?:\s+(.*))?$/);
  if (!match) {
    console.log(`${RED}Invalid command${RESET}`);
    rl.prompt();
    return;
  }
  
  const [, command, argsStr] = match;
  const args = argsStr ? argsStr.split(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(a => a.replace(/"/g, '')) : [];
  
  const tool = TOOLS[command];
  if (!tool) {
    console.log(`${RED}Unknown command: ${command}${RESET}`);
    console.log('Type "help" for available commands');
    rl.prompt();
    return;
  }
  
  try {
    const result = tool.execute(args);
    console.log('');
    console.log(result);
    console.log('');
  } catch (error) {
    console.log(`${RED}Error: ${error.message}${RESET}`);
  }
  
  rl.prompt();
});

rl.on('close', () => {
  db.close();
  process.exit(0);
});

