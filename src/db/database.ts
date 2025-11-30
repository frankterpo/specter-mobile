// SQLite Database for Specter AI Agent
// Stores personas, feedback, learned weights, and sync queue

import * as SQLite from 'expo-sqlite';

// Database instance
let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize the database and create tables
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  
  db = await SQLite.openDatabaseAsync('specter-ai.db');
  
  // Create tables
  await db.execAsync(`
    -- ═══════════════════════════════════════════════════════════════════
    -- TABLE 1: PERSONAS (the 4 investor types + custom)
    -- ═══════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      recipe_json TEXT,
      is_active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- ═══════════════════════════════════════════════════════════════════
    -- TABLE 2: FEEDBACK (likes/dislikes with datapoints)
    -- ═══════════════════════════════════════════════════════════════════
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

    -- ═══════════════════════════════════════════════════════════════════
    -- TABLE 3: LEARNED WEIGHTS (RL output)
    -- ═══════════════════════════════════════════════════════════════════
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

    -- ═══════════════════════════════════════════════════════════════════
    -- TABLE 4: AGENT MEMORY (conversation context)
    -- ═══════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS agent_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      persona_id TEXT NOT NULL,
      memory_type TEXT NOT NULL,
      content TEXT NOT NULL,
      importance REAL DEFAULT 0.5,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- ═══════════════════════════════════════════════════════════════════
    -- TABLE 5: SYNC QUEUE (pending Specter API syncs)
    -- ═══════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      action TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- ═══════════════════════════════════════════════════════════════════
    -- TABLE 6: SHORTLISTS (agent-created lists)
    -- ═══════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS shortlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      persona_id TEXT NOT NULL,
      entity_ids TEXT NOT NULL,
      specter_list_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- ═══════════════════════════════════════════════════════════════════
    -- TABLE 7: TRAINING EXPORTS (for HF fine-tuning)
    -- ═══════════════════════════════════════════════════════════════════
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

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_feedback_persona ON feedback(persona_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_entity ON feedback(entity_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_action ON feedback(action);
    CREATE INDEX IF NOT EXISTS idx_feedback_sync ON feedback(synced_to_specter);
    CREATE INDEX IF NOT EXISTS idx_weights_persona ON learned_weights(persona_id);
    CREATE INDEX IF NOT EXISTS idx_memory_persona ON agent_memory(persona_id);
  `);

  console.log('✅ Database initialized');
  return db;
}

/**
 * Get database instance
 */
export function getDatabase(): SQLite.SQLiteDatabase | null {
  return db;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PERSONA OPERATIONS
// ═══════════════════════════════════════════════════════════════════

export interface Persona {
  id: string;
  name: string;
  description?: string;
  recipe_json?: string;
  is_active: number;
  created_at?: string;
}

export async function insertPersona(persona: Omit<Persona, 'created_at'>): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  
  await db.runAsync(
    `INSERT OR REPLACE INTO personas (id, name, description, recipe_json, is_active)
     VALUES (?, ?, ?, ?, ?)`,
    [persona.id, persona.name, persona.description || null, persona.recipe_json || null, persona.is_active]
  );
}

export async function getActivePersona(): Promise<Persona | null> {
  if (!db) throw new Error('Database not initialized');
  
  const result = await db.getFirstAsync<Persona>(
    'SELECT * FROM personas WHERE is_active = 1'
  );
  return result || null;
}

export async function setActivePersona(personaId: string): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  
  await db.runAsync('UPDATE personas SET is_active = 0');
  await db.runAsync('UPDATE personas SET is_active = 1 WHERE id = ?', [personaId]);
}

export async function getAllPersonas(): Promise<Persona[]> {
  if (!db) throw new Error('Database not initialized');
  
  return await db.getAllAsync<Persona>('SELECT * FROM personas');
}

// ═══════════════════════════════════════════════════════════════════
// FEEDBACK OPERATIONS
// ═══════════════════════════════════════════════════════════════════

export interface Feedback {
  id?: number;
  persona_id: string;
  entity_id: string;
  entity_type: 'person' | 'company';
  action: 'like' | 'dislike';
  datapoints?: string[];
  note?: string;
  ai_score?: number;
  ai_recommendation?: string;
  user_agreed?: boolean;
  synced_to_specter?: boolean;
  created_at?: string;
}

export async function insertFeedback(feedback: Feedback): Promise<number> {
  if (!db) throw new Error('Database not initialized');
  
  const result = await db.runAsync(
    `INSERT OR REPLACE INTO feedback 
     (persona_id, entity_id, entity_type, action, datapoints, note, ai_score, ai_recommendation, user_agreed, synced_to_specter)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      feedback.persona_id,
      feedback.entity_id,
      feedback.entity_type,
      feedback.action,
      feedback.datapoints ? JSON.stringify(feedback.datapoints) : null,
      feedback.note || null,
      feedback.ai_score || null,
      feedback.ai_recommendation || null,
      feedback.user_agreed ? 1 : 0,
      feedback.synced_to_specter ? 1 : 0
    ]
  );
  
  return result.lastInsertRowId;
}

export async function getFeedbackByPersona(personaId: string): Promise<Feedback[]> {
  if (!db) throw new Error('Database not initialized');
  
  const results = await db.getAllAsync<any>(
    'SELECT * FROM feedback WHERE persona_id = ? ORDER BY created_at DESC',
    [personaId]
  );
  
  return results.map(r => ({
    ...r,
    datapoints: r.datapoints ? JSON.parse(r.datapoints) : [],
    user_agreed: r.user_agreed === 1,
    synced_to_specter: r.synced_to_specter === 1
  }));
}

export async function getUnsyncedFeedback(): Promise<Feedback[]> {
  if (!db) throw new Error('Database not initialized');
  
  const results = await db.getAllAsync<any>(
    'SELECT * FROM feedback WHERE synced_to_specter = 0'
  );
  
  return results.map(r => ({
    ...r,
    datapoints: r.datapoints ? JSON.parse(r.datapoints) : [],
    user_agreed: r.user_agreed === 1,
    synced_to_specter: r.synced_to_specter === 1
  }));
}

export async function markFeedbackSynced(feedbackId: number): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  
  await db.runAsync(
    'UPDATE feedback SET synced_to_specter = 1 WHERE id = ?',
    [feedbackId]
  );
}

export async function getFeedbackStats(personaId: string): Promise<{ likes: number; dislikes: number; total: number }> {
  if (!db) throw new Error('Database not initialized');
  
  const likes = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM feedback WHERE persona_id = ? AND action = ?',
    [personaId, 'like']
  );
  
  const dislikes = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM feedback WHERE persona_id = ? AND action = ?',
    [personaId, 'dislike']
  );
  
  return {
    likes: likes?.count || 0,
    dislikes: dislikes?.count || 0,
    total: (likes?.count || 0) + (dislikes?.count || 0)
  };
}

// ═══════════════════════════════════════════════════════════════════
// LEARNED WEIGHTS OPERATIONS
// ═══════════════════════════════════════════════════════════════════

export interface LearnedWeight {
  id?: number;
  persona_id: string;
  datapoint: string;
  weight: number;
  like_count: number;
  dislike_count: number;
  last_updated?: string;
}

export async function updateLearnedWeight(
  personaId: string,
  datapoint: string,
  isLike: boolean
): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  
  // Upsert the weight
  await db.runAsync(
    `INSERT INTO learned_weights (persona_id, datapoint, weight, like_count, dislike_count, last_updated)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(persona_id, datapoint) DO UPDATE SET
       like_count = like_count + ?,
       dislike_count = dislike_count + ?,
       weight = CAST((like_count + ?) - (dislike_count + ?) AS REAL) / 
                CAST((like_count + ?) + (dislike_count + ?) AS REAL),
       last_updated = datetime('now')`,
    [
      personaId,
      datapoint,
      isLike ? 1.0 : -1.0,
      isLike ? 1 : 0,
      isLike ? 0 : 1,
      isLike ? 1 : 0,
      isLike ? 0 : 1,
      isLike ? 1 : 0,
      isLike ? 0 : 1,
      isLike ? 1 : 0,
      isLike ? 0 : 1
    ]
  );
}

export async function getLearnedWeights(personaId: string): Promise<LearnedWeight[]> {
  if (!db) throw new Error('Database not initialized');
  
  return await db.getAllAsync<LearnedWeight>(
    'SELECT * FROM learned_weights WHERE persona_id = ? ORDER BY weight DESC',
    [personaId]
  );
}

export async function getTopPositiveWeights(personaId: string, limit: number = 10): Promise<LearnedWeight[]> {
  if (!db) throw new Error('Database not initialized');
  
  return await db.getAllAsync<LearnedWeight>(
    'SELECT * FROM learned_weights WHERE persona_id = ? AND weight > 0 ORDER BY weight DESC LIMIT ?',
    [personaId, limit]
  );
}

export async function getTopNegativeWeights(personaId: string, limit: number = 10): Promise<LearnedWeight[]> {
  if (!db) throw new Error('Database not initialized');
  
  return await db.getAllAsync<LearnedWeight>(
    'SELECT * FROM learned_weights WHERE persona_id = ? AND weight < 0 ORDER BY weight ASC LIMIT ?',
    [personaId, limit]
  );
}

// ═══════════════════════════════════════════════════════════════════
// SYNC QUEUE OPERATIONS
// ═══════════════════════════════════════════════════════════════════

export interface SyncQueueItem {
  id?: number;
  entity_id: string;
  entity_type: 'person' | 'company';
  action: 'like' | 'dislike';
  attempts: number;
  last_error?: string;
  created_at?: string;
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'attempts' | 'created_at'>): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  
  await db.runAsync(
    `INSERT INTO sync_queue (entity_id, entity_type, action) VALUES (?, ?, ?)`,
    [item.entity_id, item.entity_type, item.action]
  );
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  if (!db) throw new Error('Database not initialized');
  
  return await db.getAllAsync<SyncQueueItem>(
    'SELECT * FROM sync_queue WHERE attempts < 3 ORDER BY created_at ASC'
  );
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  
  await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
}

export async function incrementSyncAttempt(id: number, error: string): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  
  await db.runAsync(
    'UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?',
    [error, id]
  );
}

// ═══════════════════════════════════════════════════════════════════
// SHORTLIST OPERATIONS
// ═══════════════════════════════════════════════════════════════════

export interface Shortlist {
  id?: number;
  name: string;
  persona_id: string;
  entity_ids: string[];
  specter_list_id?: string;
  created_at?: string;
}

export async function createShortlist(shortlist: Omit<Shortlist, 'id' | 'created_at'>): Promise<number> {
  if (!db) throw new Error('Database not initialized');
  
  const result = await db.runAsync(
    `INSERT INTO shortlists (name, persona_id, entity_ids, specter_list_id)
     VALUES (?, ?, ?, ?)`,
    [shortlist.name, shortlist.persona_id, JSON.stringify(shortlist.entity_ids), shortlist.specter_list_id || null]
  );
  
  return result.lastInsertRowId;
}

export async function getShortlists(personaId: string): Promise<Shortlist[]> {
  if (!db) throw new Error('Database not initialized');
  
  const results = await db.getAllAsync<any>(
    'SELECT * FROM shortlists WHERE persona_id = ? ORDER BY created_at DESC',
    [personaId]
  );
  
  return results.map(r => ({
    ...r,
    entity_ids: JSON.parse(r.entity_ids)
  }));
}

// ═══════════════════════════════════════════════════════════════════
// TRAINING EXPORT OPERATIONS
// ═══════════════════════════════════════════════════════════════════

export async function exportTrainingData(personaId: string): Promise<object> {
  if (!db) throw new Error('Database not initialized');
  
  const feedback = await getFeedbackByPersona(personaId);
  const weights = await getLearnedWeights(personaId);
  
  const exportData = {
    persona_id: personaId,
    exported_at: new Date().toISOString(),
    feedback_count: feedback.length,
    preference_pairs: feedback.map(f => ({
      entity_id: f.entity_id,
      entity_type: f.entity_type,
      action: f.action,
      datapoints: f.datapoints,
      note: f.note,
      ai_score: f.ai_score,
      user_agreed: f.user_agreed
    })),
    learned_weights: weights.map(w => ({
      datapoint: w.datapoint,
      weight: w.weight,
      like_count: w.like_count,
      dislike_count: w.dislike_count
    }))
  };
  
  // Store the export
  await db.runAsync(
    `INSERT INTO training_exports (persona_id, export_type, data_json, record_count)
     VALUES (?, ?, ?, ?)`,
    [personaId, 'preference_pairs', JSON.stringify(exportData), feedback.length]
  );
  
  return exportData;
}

