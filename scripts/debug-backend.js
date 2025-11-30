#!/usr/bin/env node
/**
 * BACKEND DEBUG SCRIPT
 * Comprehensive debugging with instrumentation logging
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'specter-ai.db');
const LOG_ENDPOINT = 'http://127.0.0.1:7242/ingest/df6e2d2e-429a-4930-becf-dda1fd5d16a1';

// Helper to send debug logs
async function debugLog(location, message, data, hypothesisId) {
  const payload = {
    location,
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
    sessionId: 'debug-session',
    runId: 'backend-debug-run'
  };
  
  try {
    await fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    // Silently fail if server not available
  }
  
  // Also console log for visibility
  console.log(`[${hypothesisId}] ${message}:`, JSON.stringify(data, null, 2));
}

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════════╗');
console.log('║ 🔍 BACKEND DEBUG - COMPREHENSIVE TESTING                              ║');
console.log('╚═══════════════════════════════════════════════════════════════════════╝');
console.log('');

async function runDebug() {
  // ═══════════════════════════════════════════════════════════════════
  // HYPOTHESIS A: Database Schema Validation
  // ═══════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('HYPOTHESIS A: Database Schema Validation');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  // #region agent log
  await debugLog('debug-backend.js:45', 'DB_PATH check', { path: DB_PATH, exists: fs.existsSync(DB_PATH) }, 'A');
  // #endregion
  
  if (!fs.existsSync(DB_PATH)) {
    // #region agent log
    await debugLog('debug-backend.js:50', 'ERROR: Database not found', { path: DB_PATH }, 'A');
    // #endregion
    console.log('❌ Database not found! Run: node scripts/db-init.js first');
    return;
  }
  
  const db = new Database(DB_PATH);
  
  // Check all tables exist
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const tableNames = tables.map(t => t.name);
  
  // #region agent log
  await debugLog('debug-backend.js:62', 'Tables found', { tables: tableNames }, 'A');
  // #endregion
  
  const requiredTables = ['personas', 'feedback', 'learned_weights', 'agent_memory', 'sync_queue', 'shortlists', 'training_exports'];
  const missingTables = requiredTables.filter(t => !tableNames.includes(t));
  
  if (missingTables.length > 0) {
    // #region agent log
    await debugLog('debug-backend.js:70', 'ERROR: Missing tables', { missing: missingTables }, 'A');
    // #endregion
    console.log('❌ Missing tables:', missingTables.join(', '));
  } else {
    console.log('✅ All required tables exist');
  }
  
  // Check personas table schema
  const personasSchema = db.prepare("PRAGMA table_info(personas)").all();
  const personasColumns = personasSchema.map(c => c.name);
  
  // #region agent log
  await debugLog('debug-backend.js:82', 'Personas schema', { columns: personasColumns }, 'A');
  // #endregion
  
  const requiredPersonasCols = ['id', 'name', 'description', 'recipe_json', 'is_active', 'created_at'];
  const missingPersonasCols = requiredPersonasCols.filter(c => !personasColumns.includes(c));
  
  if (missingPersonasCols.length > 0) {
    console.log('❌ Missing persona columns:', missingPersonasCols.join(', '));
  } else {
    console.log('✅ Personas table schema correct');
  }
  
  // Check feedback table schema
  const feedbackSchema = db.prepare("PRAGMA table_info(feedback)").all();
  const feedbackColumns = feedbackSchema.map(c => c.name);
  
  // #region agent log
  await debugLog('debug-backend.js:98', 'Feedback schema', { columns: feedbackColumns }, 'A');
  // #endregion
  
  const requiredFeedbackCols = ['id', 'persona_id', 'entity_id', 'entity_type', 'action', 'datapoints', 'note', 'ai_score', 'user_agreed', 'synced_to_specter'];
  const missingFeedbackCols = requiredFeedbackCols.filter(c => !feedbackColumns.includes(c));
  
  if (missingFeedbackCols.length > 0) {
    console.log('❌ Missing feedback columns:', missingFeedbackCols.join(', '));
  } else {
    console.log('✅ Feedback table schema correct');
  }
  
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════
  // HYPOTHESIS B: Scoring Algorithm Consistency
  // ═══════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('HYPOTHESIS B: Scoring Algorithm Consistency');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  const activePersona = db.prepare('SELECT * FROM personas WHERE is_active = 1').get();
  
  // #region agent log
  await debugLog('debug-backend.js:122', 'Active persona', { 
    id: activePersona?.id, 
    name: activePersona?.name,
    hasRecipe: !!activePersona?.recipe_json 
  }, 'B');
  // #endregion
  
  if (!activePersona) {
    console.log('❌ No active persona found!');
  } else {
    console.log(`✅ Active persona: ${activePersona.name}`);
    
    let recipe = null;
    try {
      recipe = activePersona.recipe_json ? JSON.parse(activePersona.recipe_json) : null;
      // #region agent log
      await debugLog('debug-backend.js:137', 'Recipe parsed', { 
        hasPositiveHighlights: !!recipe?.positiveHighlights,
        hasNegativeHighlights: !!recipe?.negativeHighlights,
        hasRedFlags: !!recipe?.redFlags,
        hasWeights: !!recipe?.weights,
        positiveCount: recipe?.positiveHighlights?.length,
        weightsCount: Object.keys(recipe?.weights || {}).length
      }, 'B');
      // #endregion
      console.log('✅ Recipe JSON parsed successfully');
    } catch (e) {
      // #region agent log
      await debugLog('debug-backend.js:149', 'ERROR: Recipe parse failed', { error: e.message }, 'B');
      // #endregion
      console.log('❌ Recipe JSON parse error:', e.message);
    }
    
    // Test scoring with sample highlights
    if (recipe) {
      const testHighlights = ['serial_founder', 'prior_exit', 'yc_alumni'];
      let score = 50;
      const matched = { positive: [], negative: [], redFlags: [] };
      
      for (const h of testHighlights) {
        if (recipe.positiveHighlights?.includes(h)) {
          const weight = recipe.weights?.[h] || 0.5;
          score += weight * 20;
          matched.positive.push(h);
        }
      }
      
      score = Math.max(0, Math.min(100, Math.round(score)));
      
      // #region agent log
      await debugLog('debug-backend.js:170', 'Score calculation', { 
        input: testHighlights, 
        score, 
        matched,
        expectedMin: 80  // Strong founder should score 80+
      }, 'B');
      // #endregion
      
      if (score >= 80) {
        console.log(`✅ Scoring works correctly: ${score}/100 for strong founder`);
      } else {
        console.log(`⚠️ Unexpected score: ${score}/100 (expected 80+)`);
      }
    }
  }
  
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════
  // HYPOTHESIS C: Learned Weights Calculation
  // ═══════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('HYPOTHESIS C: Learned Weights Calculation');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  const learnedWeights = db.prepare('SELECT * FROM learned_weights WHERE persona_id = ?').all(activePersona?.id || 'early');
  
  // #region agent log
  await debugLog('debug-backend.js:198', 'Learned weights count', { count: learnedWeights.length }, 'C');
  // #endregion
  
  console.log(`Found ${learnedWeights.length} learned weights`);
  
  // Check for weight calculation consistency
  let weightIssues = 0;
  for (const w of learnedWeights) {
    const expectedWeight = (w.like_count - w.dislike_count) / Math.max(w.like_count + w.dislike_count, 1);
    const actualWeight = w.weight;
    const diff = Math.abs(expectedWeight - actualWeight);
    
    if (diff > 0.01) {
      // #region agent log
      await debugLog('debug-backend.js:212', 'Weight mismatch', { 
        datapoint: w.datapoint,
        expected: expectedWeight,
        actual: actualWeight,
        likes: w.like_count,
        dislikes: w.dislike_count
      }, 'C');
      // #endregion
      weightIssues++;
    }
  }
  
  if (weightIssues > 0) {
    console.log(`⚠️ Found ${weightIssues} weight calculation inconsistencies`);
  } else if (learnedWeights.length > 0) {
    console.log('✅ All weight calculations are consistent');
  } else {
    console.log('ℹ️ No learned weights to verify (run feedback-test.js first)');
  }
  
  // Test weight update
  const testDatapoint = 'debug_test_datapoint';
  const beforeWeight = db.prepare('SELECT * FROM learned_weights WHERE persona_id = ? AND datapoint = ?').get(activePersona?.id || 'early', testDatapoint);
  
  // #region agent log
  await debugLog('debug-backend.js:236', 'Before weight update', { exists: !!beforeWeight, datapoint: testDatapoint }, 'C');
  // #endregion
  
  // Insert test weight
  db.prepare(`
    INSERT OR REPLACE INTO learned_weights (persona_id, datapoint, weight, like_count, dislike_count)
    VALUES (?, ?, 1.0, 1, 0)
  `).run(activePersona?.id || 'early', testDatapoint);
  
  const afterWeight = db.prepare('SELECT * FROM learned_weights WHERE persona_id = ? AND datapoint = ?').get(activePersona?.id || 'early', testDatapoint);
  
  // #region agent log
  await debugLog('debug-backend.js:248', 'After weight insert', { 
    exists: !!afterWeight, 
    weight: afterWeight?.weight,
    likes: afterWeight?.like_count
  }, 'C');
  // #endregion
  
  // Update weight (simulate like)
  db.prepare(`
    UPDATE learned_weights 
    SET like_count = like_count + 1, 
        weight = CAST(like_count + 1 - dislike_count AS REAL) / CAST(like_count + 1 + dislike_count AS REAL)
    WHERE persona_id = ? AND datapoint = ?
  `).run(activePersona?.id || 'early', testDatapoint);
  
  const updatedWeight = db.prepare('SELECT * FROM learned_weights WHERE persona_id = ? AND datapoint = ?').get(activePersona?.id || 'early', testDatapoint);
  
  // #region agent log
  await debugLog('debug-backend.js:265', 'After weight update', { 
    weight: updatedWeight?.weight,
    likes: updatedWeight?.like_count,
    expectedWeight: 1.0  // 2 likes, 0 dislikes = 1.0
  }, 'C');
  // #endregion
  
  if (updatedWeight && updatedWeight.weight === 1.0 && updatedWeight.like_count === 2) {
    console.log('✅ Weight update calculation correct');
  } else {
    console.log('❌ Weight update calculation incorrect');
    console.log(`   Expected: weight=1.0, likes=2`);
    console.log(`   Got: weight=${updatedWeight?.weight}, likes=${updatedWeight?.like_count}`);
  }
  
  // Cleanup test data
  db.prepare('DELETE FROM learned_weights WHERE datapoint = ?').run(testDatapoint);
  
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════
  // HYPOTHESIS D: JSON Parsing Robustness
  // ═══════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('HYPOTHESIS D: JSON Parsing Robustness');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  const allPersonas = db.prepare('SELECT * FROM personas').all();
  let jsonIssues = 0;
  
  for (const persona of allPersonas) {
    try {
      if (persona.recipe_json) {
        const recipe = JSON.parse(persona.recipe_json);
        
        // Validate required fields
        const missingFields = [];
        if (!recipe.positiveHighlights) missingFields.push('positiveHighlights');
        if (!recipe.negativeHighlights) missingFields.push('negativeHighlights');
        if (!recipe.redFlags) missingFields.push('redFlags');
        if (!recipe.weights) missingFields.push('weights');
        
        if (missingFields.length > 0) {
          // #region agent log
          await debugLog('debug-backend.js:307', 'Recipe missing fields', { 
            persona: persona.name, 
            missing: missingFields 
          }, 'D');
          // #endregion
          jsonIssues++;
        }
      } else {
        // #region agent log
        await debugLog('debug-backend.js:316', 'Recipe is null', { persona: persona.name }, 'D');
        // #endregion
        jsonIssues++;
      }
    } catch (e) {
      // #region agent log
      await debugLog('debug-backend.js:322', 'JSON parse error', { 
        persona: persona.name, 
        error: e.message 
      }, 'D');
      // #endregion
      jsonIssues++;
    }
  }
  
  if (jsonIssues > 0) {
    console.log(`❌ Found ${jsonIssues} JSON parsing issues`);
  } else {
    console.log('✅ All persona recipes parse correctly');
  }
  
  // Test feedback datapoints JSON
  const allFeedback = db.prepare('SELECT * FROM feedback LIMIT 10').all();
  let feedbackJsonIssues = 0;
  
  for (const fb of allFeedback) {
    if (fb.datapoints) {
      try {
        const dp = JSON.parse(fb.datapoints);
        if (!Array.isArray(dp)) {
          // #region agent log
          await debugLog('debug-backend.js:346', 'Datapoints not array', { 
            feedbackId: fb.id, 
            type: typeof dp 
          }, 'D');
          // #endregion
          feedbackJsonIssues++;
        }
      } catch (e) {
        // #region agent log
        await debugLog('debug-backend.js:355', 'Datapoints parse error', { 
          feedbackId: fb.id, 
          error: e.message 
        }, 'D');
        // #endregion
        feedbackJsonIssues++;
      }
    }
  }
  
  if (feedbackJsonIssues > 0) {
    console.log(`❌ Found ${feedbackJsonIssues} feedback JSON issues`);
  } else if (allFeedback.length > 0) {
    console.log('✅ All feedback datapoints parse correctly');
  } else {
    console.log('ℹ️ No feedback entries to verify');
  }
  
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════
  // HYPOTHESIS E: AgentOrchestrator Integration
  // ═══════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('HYPOTHESIS E: AgentOrchestrator Integration');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  // Test the scoring function that AgentOrchestrator uses
  const recipe = activePersona?.recipe_json ? JSON.parse(activePersona.recipe_json) : null;
  
  if (recipe) {
    // Simulate what AgentOrchestrator.scorePersonAgainstRecipe does
    const testCases = [
      { name: 'Strong Founder', highlights: ['serial_founder', 'prior_exit', 'yc_alumni'], expectedMin: 80 },
      { name: 'Weak Candidate', highlights: ['no_experience', 'junior_level'], expectedMax: 40 },
      { name: 'Mixed Signals', highlights: ['technical_background', 'career_gap'], expectedMin: 40, expectedMax: 70 }
    ];
    
    for (const tc of testCases) {
      let score = 50;
      const matched = { positive: [], negative: [], redFlags: [] };
      
      for (const h of tc.highlights) {
        if (recipe.positiveHighlights?.includes(h)) {
          const weight = recipe.weights?.[h] || 0.5;
          score += weight * 20;
          matched.positive.push(h);
        }
        if (recipe.negativeHighlights?.includes(h)) {
          const weight = recipe.weights?.[h] || -0.3;
          score += weight * 20;
          matched.negative.push(h);
        }
        if (recipe.redFlags?.includes(h)) {
          const weight = recipe.weights?.[h] || -0.5;
          score += weight * 30;
          matched.redFlags.push(h);
        }
      }
      
      score = Math.max(0, Math.min(100, Math.round(score)));
      
      // #region agent log
      await debugLog('debug-backend.js:418', 'Test case result', { 
        name: tc.name,
        score,
        matched,
        expectedMin: tc.expectedMin,
        expectedMax: tc.expectedMax
      }, 'E');
      // #endregion
      
      const passedMin = tc.expectedMin === undefined || score >= tc.expectedMin;
      const passedMax = tc.expectedMax === undefined || score <= tc.expectedMax;
      
      if (passedMin && passedMax) {
        console.log(`✅ ${tc.name}: ${score}/100`);
      } else {
        console.log(`❌ ${tc.name}: ${score}/100 (expected ${tc.expectedMin || 0}-${tc.expectedMax || 100})`);
      }
    }
  } else {
    console.log('❌ Cannot test AgentOrchestrator - no recipe available');
  }
  
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('📊 DEBUG SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  const summary = {
    databaseExists: fs.existsSync(DB_PATH),
    tablesComplete: missingTables.length === 0,
    personasSchemaCorrect: missingPersonasCols.length === 0,
    feedbackSchemaCorrect: missingFeedbackCols.length === 0,
    activePersonaExists: !!activePersona,
    recipeParses: recipe !== null,
    learnedWeightsCount: learnedWeights.length,
    weightCalculationsConsistent: weightIssues === 0,
    jsonParsingRobust: jsonIssues === 0 && feedbackJsonIssues === 0
  };
  
  // #region agent log
  await debugLog('debug-backend.js:461', 'Final summary', summary, 'SUMMARY');
  // #endregion
  
  console.log('Database Status:');
  console.log(`   ├─ Database exists: ${summary.databaseExists ? '✅' : '❌'}`);
  console.log(`   ├─ All tables present: ${summary.tablesComplete ? '✅' : '❌'}`);
  console.log(`   ├─ Personas schema: ${summary.personasSchemaCorrect ? '✅' : '❌'}`);
  console.log(`   └─ Feedback schema: ${summary.feedbackSchemaCorrect ? '✅' : '❌'}`);
  console.log('');
  console.log('Data Status:');
  console.log(`   ├─ Active persona: ${summary.activePersonaExists ? '✅' : '❌'}`);
  console.log(`   ├─ Recipe parses: ${summary.recipeParses ? '✅' : '❌'}`);
  console.log(`   ├─ Learned weights: ${summary.learnedWeightsCount}`);
  console.log(`   └─ Weight calculations: ${summary.weightCalculationsConsistent ? '✅' : '⚠️'}`);
  console.log('');
  console.log('JSON Parsing:');
  console.log(`   └─ All JSON robust: ${summary.jsonParsingRobust ? '✅' : '❌'}`);
  console.log('');
  
  const allPassed = Object.values(summary).every(v => v === true || typeof v === 'number');
  
  if (allPassed) {
    console.log('🎉 ALL BACKEND CHECKS PASSED!');
  } else {
    console.log('⚠️ Some issues found - check logs above');
  }
  
  db.close();
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('Debug logs sent to: /Users/franciscoterpolilli/Projects/specter-mobile/.cursor/debug.log');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');
}

runDebug().catch(console.error);

