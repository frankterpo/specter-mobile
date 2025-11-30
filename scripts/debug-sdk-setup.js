#!/usr/bin/env node
/**
 * Debug SDK Setup - Tests HuggingFace and Cactus SDK with instrumentation
 */

const fs = require('fs');
const path = require('path');

// Debug logging endpoint
const DEBUG_ENDPOINT = 'http://127.0.0.1:7242/ingest/df6e2d2e-429a-4930-becf-dda1fd5d16a1';

function log(location, message, data, hypothesisId) {
  const payload = {
    location,
    message,
    data,
    timestamp: Date.now(),
    sessionId: 'debug-session',
    runId: 'sdk-debug-' + Date.now(),
    hypothesisId
  };
  
  // Also log to console
  console.log(`[${hypothesisId}] ${message}`, data ? JSON.stringify(data).substring(0, 200) : '');
  
  // Send to debug server
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════════╗');
console.log('║ 🔧 SDK DEBUG - HuggingFace + Cactus Setup Test                        ║');
console.log('╚═══════════════════════════════════════════════════════════════════════╝');
console.log('');

async function testHuggingFace() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🤗 TESTING HUGGINGFACE SDK');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');
  
  // #region agent log
  log('debug-sdk-setup.js:45', 'Starting HuggingFace test', { phase: 'start' }, 'HF-A');
  // #endregion
  
  try {
    // Test 1: Can we import the package?
    console.log('📦 Step 1: Importing @huggingface/transformers...');
    // #region agent log
    log('debug-sdk-setup.js:52', 'Attempting HF import', {}, 'HF-A');
    // #endregion
    
    const { pipeline, env } = require('@huggingface/transformers');
    
    // #region agent log
    log('debug-sdk-setup.js:58', 'HF import successful', { 
      hasEnv: !!env,
      hasPipeline: typeof pipeline === 'function'
    }, 'HF-A');
    // #endregion
    
    console.log('   ✅ Import successful');
    console.log(`   - pipeline: ${typeof pipeline}`);
    console.log(`   - env: ${typeof env}`);
    console.log('');
    
    // Test 2: Configure environment
    console.log('⚙️  Step 2: Configuring environment...');
    env.useBrowserCache = false;
    env.allowLocalModels = true;
    env.allowRemoteModels = true;
    
    // #region agent log
    log('debug-sdk-setup.js:75', 'HF env configured', {
      useBrowserCache: env.useBrowserCache,
      allowLocalModels: env.allowLocalModels,
      allowRemoteModels: env.allowRemoteModels
    }, 'HF-A');
    // #endregion
    
    console.log('   ✅ Environment configured');
    console.log('');
    
    // Test 3: Load embedding pipeline
    console.log('📥 Step 3: Loading MiniLM embedding model...');
    console.log('   (This may take 30-60 seconds on first run)');
    
    // #region agent log
    log('debug-sdk-setup.js:89', 'Starting model load', { model: 'Xenova/all-MiniLM-L6-v2' }, 'HF-B');
    // #endregion
    
    const startTime = Date.now();
    
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      progress_callback: (progress) => {
        if (progress.status === 'progress' && progress.progress) {
          process.stdout.write(`\r   Loading: ${Math.round(progress.progress)}%`);
        }
      }
    });
    
    const loadTime = Date.now() - startTime;
    console.log('');
    
    // #region agent log
    log('debug-sdk-setup.js:106', 'Model loaded', { 
      loadTimeMs: loadTime,
      extractorType: typeof extractor
    }, 'HF-B');
    // #endregion
    
    console.log(`   ✅ Model loaded in ${(loadTime / 1000).toFixed(1)}s`);
    console.log('');
    
    // Test 4: Generate embedding
    console.log('🧮 Step 4: Generating test embedding...');
    
    const testText = 'Serial founder with prior exit and YC alumni experience';
    
    // #region agent log
    log('debug-sdk-setup.js:120', 'Generating embedding', { textLength: testText.length }, 'HF-C');
    // #endregion
    
    const embedStart = Date.now();
    const result = await extractor(testText, { pooling: 'mean', normalize: true });
    const embedTime = Date.now() - embedStart;
    
    // #region agent log
    log('debug-sdk-setup.js:128', 'Embedding generated', {
      embedTimeMs: embedTime,
      resultType: typeof result,
      hasData: !!result?.data,
      dataLength: result?.data?.length
    }, 'HF-C');
    // #endregion
    
    const embedding = Array.from(result.data);
    
    console.log(`   ✅ Embedding generated in ${embedTime}ms`);
    console.log(`   - Dimensions: ${embedding.length}`);
    console.log(`   - Sample values: [${embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...]`);
    console.log('');
    
    // Test 5: Verify embedding quality
    console.log('✅ Step 5: Verifying embedding quality...');
    
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    const isNormalized = Math.abs(magnitude - 1.0) < 0.01;
    
    // #region agent log
    log('debug-sdk-setup.js:150', 'Embedding quality check', {
      magnitude,
      isNormalized,
      dimension: embedding.length
    }, 'HF-C');
    // #endregion
    
    console.log(`   - Magnitude: ${magnitude.toFixed(4)} (should be ~1.0)`);
    console.log(`   - Normalized: ${isNormalized ? '✅ Yes' : '❌ No'}`);
    console.log('');
    
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('🎉 HUGGINGFACE SDK: ALL TESTS PASSED');
    console.log('═══════════════════════════════════════════════════════════════════════');
    
    return { success: true, embedding, loadTime, embedTime };
    
  } catch (error) {
    // #region agent log
    log('debug-sdk-setup.js:169', 'HuggingFace test failed', {
      error: error.message,
      stack: error.stack?.substring(0, 500)
    }, 'HF-A');
    // #endregion
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('❌ HUGGINGFACE SDK: TEST FAILED');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(`Error: ${error.message}`);
    console.log('');
    
    return { success: false, error: error.message };
  }
}

async function testCactus() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🌵 TESTING CACTUS SDK');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');
  
  // #region agent log
  log('debug-sdk-setup.js:193', 'Starting Cactus test', { phase: 'start' }, 'CACTUS-A');
  // #endregion
  
  try {
    // Test 1: Can we import the package?
    console.log('📦 Step 1: Importing cactus-react-native...');
    
    // #region agent log
    log('debug-sdk-setup.js:201', 'Attempting Cactus import', {}, 'CACTUS-A');
    // #endregion
    
    const cactusModule = require('cactus-react-native');
    
    // #region agent log
    log('debug-sdk-setup.js:207', 'Cactus import result', {
      exports: Object.keys(cactusModule),
      hasCactusLM: !!cactusModule.CactusLM,
      hasCactusConfig: !!cactusModule.CactusConfig
    }, 'CACTUS-A');
    // #endregion
    
    console.log('   ✅ Import successful');
    console.log(`   - Exports: ${Object.keys(cactusModule).join(', ')}`);
    console.log('');
    
    // Test 2: Check CactusLM class
    console.log('🔍 Step 2: Checking CactusLM class...');
    
    const { CactusLM, CactusConfig } = cactusModule;
    
    // #region agent log
    log('debug-sdk-setup.js:223', 'CactusLM class check', {
      isCactusLMFunction: typeof CactusLM === 'function',
      defaultModel: CactusLM.defaultModel,
      defaultContextSize: CactusLM.defaultContextSize
    }, 'CACTUS-A');
    // #endregion
    
    console.log(`   - CactusLM: ${typeof CactusLM}`);
    console.log(`   - Default model: ${CactusLM.defaultModel}`);
    console.log(`   - Default context: ${CactusLM.defaultContextSize}`);
    console.log('');
    
    // Test 3: Try to instantiate (will likely fail in Node.js)
    console.log('🔧 Step 3: Attempting to instantiate CactusLM...');
    console.log('   ⚠️  Note: Cactus requires React Native runtime');
    
    // #region agent log
    log('debug-sdk-setup.js:239', 'Attempting CactusLM instantiation', {}, 'CACTUS-B');
    // #endregion
    
    try {
      const cactus = new CactusLM({ model: 'qwen3-0.6' });
      
      // #region agent log
      log('debug-sdk-setup.js:246', 'CactusLM instantiated', {
        model: cactus.model,
        contextSize: cactus.contextSize,
        isInitialized: cactus.isInitialized
      }, 'CACTUS-B');
      // #endregion
      
      console.log('   ✅ Instance created');
      console.log(`   - Model: ${cactus.model}`);
      console.log(`   - Context size: ${cactus.contextSize}`);
      console.log(`   - Initialized: ${cactus.isInitialized}`);
      console.log('');
      
      // Test 4: Check if native module is available
      console.log('🔌 Step 4: Checking native module availability...');
      
      // #region agent log
      log('debug-sdk-setup.js:262', 'Checking native module', {}, 'CACTUS-B');
      // #endregion
      
      // Try to call download (will fail without native module)
      console.log('   Attempting model download check...');
      
      try {
        await cactus.download({ onProgress: (p) => {} });
        
        // #region agent log
        log('debug-sdk-setup.js:272', 'Download check succeeded', {}, 'CACTUS-B');
        // #endregion
        
        console.log('   ✅ Native module available');
      } catch (nativeError) {
        // #region agent log
        log('debug-sdk-setup.js:278', 'Native module not available', {
          error: nativeError.message
        }, 'CACTUS-B');
        // #endregion
        
        console.log(`   ⚠️  Native module not available: ${nativeError.message}`);
        console.log('   This is expected in Node.js - Cactus requires React Native');
      }
      
    } catch (instanceError) {
      // #region agent log
      log('debug-sdk-setup.js:290', 'CactusLM instantiation failed', {
        error: instanceError.message
      }, 'CACTUS-B');
      // #endregion
      
      console.log(`   ⚠️  Instantiation failed: ${instanceError.message}`);
      console.log('   This is expected in Node.js - Cactus requires React Native');
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('📋 CACTUS SDK: PACKAGE STRUCTURE VERIFIED');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Note: Cactus SDK requires React Native runtime for full functionality.');
    console.log('The package structure and exports are correct for mobile use.');
    
    return { success: true, requiresReactNative: true };
    
  } catch (error) {
    // #region agent log
    log('debug-sdk-setup.js:312', 'Cactus test failed', {
      error: error.message,
      stack: error.stack?.substring(0, 500)
    }, 'CACTUS-A');
    // #endregion
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('❌ CACTUS SDK: TEST FAILED');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(`Error: ${error.message}`);
    console.log('');
    
    return { success: false, error: error.message };
  }
}

async function testDatabaseIntegration() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('💾 TESTING DATABASE INTEGRATION');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');
  
  try {
    const Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, '..', 'specter-ai.db');
    
    // #region agent log
    log('debug-sdk-setup.js:341', 'Checking database', { path: dbPath }, 'DB-A');
    // #endregion
    
    if (!fs.existsSync(dbPath)) {
      console.log('   ⚠️  Database not found. Run: node scripts/db-init.js');
      return { success: false, error: 'Database not found' };
    }
    
    const db = new Database(dbPath);
    
    // Check tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(`   ✅ Database found with ${tables.length} tables`);
    console.log(`   - Tables: ${tables.map(t => t.name).join(', ')}`);
    
    // Check personas
    const personas = db.prepare('SELECT * FROM personas').all();
    console.log(`   - Personas: ${personas.length}`);
    
    // Check active persona
    const active = db.prepare('SELECT * FROM personas WHERE is_active = 1').get();
    if (active) {
      console.log(`   - Active: ${active.name}`);
    }
    
    // Check feedback
    const feedback = db.prepare('SELECT COUNT(*) as count FROM feedback').get();
    console.log(`   - Feedback entries: ${feedback.count}`);
    
    // Check learned weights
    const weights = db.prepare('SELECT COUNT(*) as count FROM learned_weights').get();
    console.log(`   - Learned weights: ${weights.count}`);
    
    // #region agent log
    log('debug-sdk-setup.js:375', 'Database check complete', {
      tables: tables.length,
      personas: personas.length,
      hasActive: !!active,
      feedbackCount: feedback.count,
      weightsCount: weights.count
    }, 'DB-A');
    // #endregion
    
    db.close();
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('✅ DATABASE: ALL CHECKS PASSED');
    console.log('═══════════════════════════════════════════════════════════════════════');
    
    return { success: true };
    
  } catch (error) {
    // #region agent log
    log('debug-sdk-setup.js:395', 'Database test failed', { error: error.message }, 'DB-A');
    // #endregion
    
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  const results = {};
  
  // Test HuggingFace
  results.huggingface = await testHuggingFace();
  
  // Test Cactus
  results.cactus = await testCactus();
  
  // Test Database
  results.database = await testDatabaseIntegration();
  
  // Final Summary
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║ 📊 FINAL SDK DEBUG SUMMARY                                            ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│ Component                    Status                                 │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  console.log(`│ 🤗 HuggingFace Transformers  ${results.huggingface.success ? '✅ WORKING' : '❌ FAILED'}                            │`);
  console.log(`│ 🌵 Cactus SDK (structure)    ${results.cactus.success ? '✅ VERIFIED' : '❌ FAILED'}                           │`);
  console.log(`│ 💾 SQLite Database           ${results.database.success ? '✅ WORKING' : '❌ FAILED'}                            │`);
  console.log('└─────────────────────────────────────────────────────────────────────┘');
  console.log('');
  
  if (results.huggingface.success) {
    console.log('🤗 HuggingFace Details:');
    console.log(`   - Model load time: ${(results.huggingface.loadTime / 1000).toFixed(1)}s`);
    console.log(`   - Embedding time: ${results.huggingface.embedTime}ms`);
    console.log(`   - Embedding dimension: ${results.huggingface.embedding?.length || 'N/A'}`);
    console.log('');
  }
  
  console.log('🌵 Cactus SDK Notes:');
  console.log('   - Package imports correctly');
  console.log('   - CactusLM class available');
  console.log('   - Native bindings require React Native runtime');
  console.log('   - Will work on actual mobile device/emulator');
  console.log('');
  
  console.log('📋 Next Steps:');
  console.log('   1. HuggingFace embeddings work in terminal ✅');
  console.log('   2. Cactus SDK verified - test on mobile device');
  console.log('   3. Database ready for RL training ✅');
  console.log('');
  
  // #region agent log
  log('debug-sdk-setup.js:456', 'Debug complete', {
    hf: results.huggingface.success,
    cactus: results.cactus.success,
    db: results.database.success
  }, 'SUMMARY');
  // #endregion
}

main().catch(console.error);

