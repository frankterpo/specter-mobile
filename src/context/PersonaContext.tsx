// Persona Context for managing active persona state
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SQLite from 'expo-sqlite';

// Types
export interface Persona {
  id: string;
  name: string;
  description: string;
  recipe: PersonaRecipe | null;
  isActive: boolean;
}

export interface PersonaRecipe {
  positiveHighlights: string[];
  negativeHighlights: string[];
  redFlags: string[];
  weights: Record<string, number>;
}

export interface FeedbackStats {
  likes: number;
  dislikes: number;
  total: number;
  agreementRate: number;
}

export interface LearnedWeight {
  datapoint: string;
  weight: number;
  likeCount: number;
  dislikeCount: number;
}

// Context type
interface PersonaContextType {
  // State
  personas: Persona[];
  activePersona: Persona | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  switchPersona: (personaId: string) => Promise<void>;
  getRecipe: () => PersonaRecipe | null;
  getFeedbackStats: () => Promise<FeedbackStats>;
  getLearnedWeights: (limit?: number) => Promise<LearnedWeight[]>;
  
  // Feedback
  submitFeedback: (params: {
    entityId: string;
    entityType: 'person' | 'company';
    action: 'like' | 'dislike';
    datapoints: string[];
    note?: string;
    aiScore?: number;
    aiRecommendation?: string;
    userAgreed?: boolean;
  }) => Promise<void>;
  
  // Sync
  syncPendingFeedback: (token: string) => Promise<number>;
}

// Default context
const PersonaContext = createContext<PersonaContextType | null>(null);

// Provider component
export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize database
  useEffect(() => {
    async function init() {
      try {
        const database = await SQLite.openDatabaseAsync('specter-ai.db');
        setDb(database);
        
        // Load personas
        const personaRows = await database.getAllAsync<any>('SELECT * FROM personas');
        
        const loadedPersonas: Persona[] = personaRows.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          recipe: p.recipe_json ? JSON.parse(p.recipe_json) : null,
          isActive: p.is_active === 1
        }));
        
        setPersonas(loadedPersonas);
        setActivePersona(loadedPersonas.find(p => p.isActive) || null);
        setIsLoading(false);
      } catch (err: any) {
        console.error('Failed to initialize PersonaContext:', err);
        setError(err.message);
        setIsLoading(false);
      }
    }
    
    init();
  }, []);

  // Switch persona
  const switchPersona = useCallback(async (personaId: string) => {
    if (!db) return;
    
    try {
      await db.runAsync('UPDATE personas SET is_active = 0');
      await db.runAsync('UPDATE personas SET is_active = 1 WHERE id = ?', [personaId]);
      
      // Update state
      setPersonas(prev => prev.map(p => ({
        ...p,
        isActive: p.id === personaId
      })));
      
      const newActive = personas.find(p => p.id === personaId);
      setActivePersona(newActive || null);
      
      console.log(`Switched to persona: ${newActive?.name}`);
    } catch (err: any) {
      console.error('Failed to switch persona:', err);
      setError(err.message);
    }
  }, [db, personas]);

  // Get recipe
  const getRecipe = useCallback(() => {
    return activePersona?.recipe || null;
  }, [activePersona]);

  // Get feedback stats
  const getFeedbackStats = useCallback(async (): Promise<FeedbackStats> => {
    if (!db || !activePersona) {
      return { likes: 0, dislikes: 0, total: 0, agreementRate: 0 };
    }
    
    try {
      const stats = await db.getFirstAsync<any>(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN action = 'like' THEN 1 ELSE 0 END) as likes,
          SUM(CASE WHEN action = 'dislike' THEN 1 ELSE 0 END) as dislikes,
          SUM(CASE WHEN user_agreed = 1 THEN 1 ELSE 0 END) as agreed
        FROM feedback WHERE persona_id = ?
      `, [activePersona.id]);
      
      return {
        likes: stats?.likes || 0,
        dislikes: stats?.dislikes || 0,
        total: stats?.total || 0,
        agreementRate: stats?.total > 0 ? (stats.agreed / stats.total) * 100 : 0
      };
    } catch (err) {
      console.error('Failed to get feedback stats:', err);
      return { likes: 0, dislikes: 0, total: 0, agreementRate: 0 };
    }
  }, [db, activePersona]);

  // Get learned weights
  const getLearnedWeights = useCallback(async (limit: number = 10): Promise<LearnedWeight[]> => {
    if (!db || !activePersona) return [];
    
    try {
      const weights = await db.getAllAsync<any>(`
        SELECT * FROM learned_weights 
        WHERE persona_id = ? 
        ORDER BY ABS(weight) DESC 
        LIMIT ?
      `, [activePersona.id, limit]);
      
      return weights.map(w => ({
        datapoint: w.datapoint,
        weight: w.weight,
        likeCount: w.like_count,
        dislikeCount: w.dislike_count
      }));
    } catch (err) {
      console.error('Failed to get learned weights:', err);
      return [];
    }
  }, [db, activePersona]);

  // Submit feedback
  const submitFeedback = useCallback(async (params: {
    entityId: string;
    entityType: 'person' | 'company';
    action: 'like' | 'dislike';
    datapoints: string[];
    note?: string;
    aiScore?: number;
    aiRecommendation?: string;
    userAgreed?: boolean;
  }) => {
    if (!db || !activePersona) return;
    
    try {
      // Insert feedback
      await db.runAsync(`
        INSERT OR REPLACE INTO feedback 
        (persona_id, entity_id, entity_type, action, datapoints, note, ai_score, ai_recommendation, user_agreed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        activePersona.id,
        params.entityId,
        params.entityType,
        params.action,
        JSON.stringify(params.datapoints),
        params.note || null,
        params.aiScore || null,
        params.aiRecommendation || null,
        params.userAgreed ? 1 : 0
      ]);
      
      // Update learned weights
      const isLike = params.action === 'like';
      for (const dp of params.datapoints) {
        const existing = await db.getFirstAsync<any>(
          'SELECT * FROM learned_weights WHERE persona_id = ? AND datapoint = ?',
          [activePersona.id, dp]
        );
        
        if (existing) {
          const newLikes = existing.like_count + (isLike ? 1 : 0);
          const newDislikes = existing.dislike_count + (isLike ? 0 : 1);
          const newWeight = (newLikes - newDislikes) / (newLikes + newDislikes);
          
          await db.runAsync(`
            UPDATE learned_weights 
            SET like_count = ?, dislike_count = ?, weight = ?, last_updated = datetime('now')
            WHERE id = ?
          `, [newLikes, newDislikes, newWeight, existing.id]);
        } else {
          await db.runAsync(`
            INSERT INTO learned_weights (persona_id, datapoint, weight, like_count, dislike_count)
            VALUES (?, ?, ?, ?, ?)
          `, [activePersona.id, dp, isLike ? 1.0 : -1.0, isLike ? 1 : 0, isLike ? 0 : 1]);
        }
      }
      
      // Add to sync queue
      await db.runAsync(`
        INSERT INTO sync_queue (entity_id, entity_type, action)
        VALUES (?, ?, ?)
      `, [params.entityId, params.entityType, params.action]);
      
      console.log(`Feedback saved: ${params.action} ${params.entityId}`);
    } catch (err: any) {
      console.error('Failed to submit feedback:', err);
      setError(err.message);
    }
  }, [db, activePersona]);

  // Sync pending feedback
  const syncPendingFeedback = useCallback(async (token: string): Promise<number> => {
    if (!db) return 0;
    
    try {
      const queue = await db.getAllAsync<any>(
        'SELECT * FROM sync_queue WHERE attempts < 3'
      );
      
      let synced = 0;
      
      for (const item of queue) {
        try {
          const endpoint = item.entity_type === 'person' 
            ? `https://app.staging.tryspecter.com/api/entity-status/people/${item.entity_id}`
            : `https://app.staging.tryspecter.com/api/entity-status/companies/${item.entity_id}`;
          
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: item.action === 'like' ? 'liked' : 'disliked' })
          });
          
          if (response.ok) {
            await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
            await db.runAsync(
              'UPDATE feedback SET synced_to_specter = 1 WHERE entity_id = ?',
              [item.entity_id]
            );
            synced++;
          } else {
            await db.runAsync(
              'UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?',
              [await response.text(), item.id]
            );
          }
        } catch (err: any) {
          await db.runAsync(
            'UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?',
            [err.message, item.id]
          );
        }
      }
      
      console.log(`Synced ${synced}/${queue.length} feedback items`);
      return synced;
    } catch (err) {
      console.error('Failed to sync feedback:', err);
      return 0;
    }
  }, [db]);

  return (
    <PersonaContext.Provider
      value={{
        personas,
        activePersona,
        isLoading,
        error,
        switchPersona,
        getRecipe,
        getFeedbackStats,
        getLearnedWeights,
        submitFeedback,
        syncPendingFeedback
      }}
    >
      {children}
    </PersonaContext.Provider>
  );
}

// Hook
export function usePersona() {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error('usePersona must be used within a PersonaProvider');
  }
  return context;
}

