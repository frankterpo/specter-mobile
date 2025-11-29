/**
 * Training Logger for RL Data Export
 * 
 * Exports interaction data in formats suitable for offline RL training:
 * - GRPO (Group Relative Policy Optimization)
 * - PPO (Proximal Policy Optimization)
 * - DPO (Direct Preference Optimization)
 * 
 * Data format follows standard preference learning datasets.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getAgentMemory, RewardEvent, EntityFeatures } from './agentMemory';
import { logger } from '../utils/logger';

// ============================================
// TYPES
// ============================================

export interface TrainingExample {
  id: string;
  timestamp: string;
  entityId: string;
  entityType: 'person' | 'company' | 'signal';
  entityName: string;
  features: EntityFeatures;
  action: 'like' | 'dislike' | 'save' | 'skip';
  reward: number;
  context?: string; // Voice/text feedback
  personaId?: string;
  personaName?: string;
}

export interface PreferencePair {
  id: string;
  timestamp: string;
  chosen: TrainingExample;
  rejected: TrainingExample;
  margin: number; // Reward difference
}

export interface TrainingDataset {
  version: string;
  exportedAt: string;
  personaId?: string;
  personaName?: string;
  stats: {
    totalExamples: number;
    likes: number;
    dislikes: number;
    saves: number;
    skips: number;
    preferencePairs: number;
  };
  examples: TrainingExample[];
  preferencePairs: PreferencePair[];
  learnedPreferences: {
    category: string;
    value: string;
    confidence: number;
    negativeConfidence: number;
  }[];
}

// ============================================
// TRAINING LOGGER
// ============================================

const TRAINING_LOG_KEY = 'specter_training_log';
const MAX_LOG_SIZE = 10000;

class TrainingLogger {
  private logBuffer: TrainingExample[] = [];

  async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(TRAINING_LOG_KEY);
      if (stored) {
        this.logBuffer = JSON.parse(stored);
      }
    } catch (error) {
      logger.error('TrainingLogger', 'Failed to initialize', error);
    }
  }

  /**
   * Log a training example from a user interaction
   */
  logInteraction(example: Omit<TrainingExample, 'id' | 'timestamp'>): void {
    const fullExample: TrainingExample = {
      ...example,
      id: `train_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };

    this.logBuffer.push(fullExample);

    // Trim if too large
    if (this.logBuffer.length > MAX_LOG_SIZE) {
      this.logBuffer = this.logBuffer.slice(-MAX_LOG_SIZE);
    }

    // Async save
    this.saveBuffer();

    logger.debug('TrainingLogger', 'Logged training example', {
      action: example.action,
      entityId: example.entityId,
    });
  }

  private async saveBuffer(): Promise<void> {
    try {
      await AsyncStorage.setItem(TRAINING_LOG_KEY, JSON.stringify(this.logBuffer));
    } catch (error) {
      logger.error('TrainingLogger', 'Failed to save buffer', error);
    }
  }

  /**
   * Generate preference pairs from logged interactions
   * Pairs a liked entity with a disliked entity for DPO training
   */
  generatePreferencePairs(): PreferencePair[] {
    const likes = this.logBuffer.filter(e => e.action === 'like' || e.action === 'save');
    const dislikes = this.logBuffer.filter(e => e.action === 'dislike' || e.action === 'skip');

    const pairs: PreferencePair[] = [];

    // Generate pairs by matching similar features
    for (const liked of likes) {
      // Find a dislike with similar features for better training signal
      const matchingDislike = dislikes.find(d => {
        // Prefer same persona
        if (liked.personaId && d.personaId && liked.personaId !== d.personaId) {
          return false;
        }
        // Prefer similar entity type
        return d.entityType === liked.entityType;
      });

      if (matchingDislike) {
        pairs.push({
          id: `pair_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          chosen: liked,
          rejected: matchingDislike,
          margin: liked.reward - matchingDislike.reward,
        });
      }
    }

    return pairs;
  }

  /**
   * Export training data in standard format
   */
  async exportTrainingData(personaId?: string): Promise<TrainingDataset> {
    const memory = getAgentMemory();
    
    // Filter by persona if specified
    let examples = this.logBuffer;
    if (personaId) {
      examples = examples.filter(e => e.personaId === personaId);
    }

    const preferencePairs = this.generatePreferencePairs();
    const prefs = memory.getLearnedPreferences();

    const dataset: TrainingDataset = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      personaId,
      personaName: personaId ? memory.getPersonas().find(p => p.id === personaId)?.name : undefined,
      stats: {
        totalExamples: examples.length,
        likes: examples.filter(e => e.action === 'like').length,
        dislikes: examples.filter(e => e.action === 'dislike').length,
        saves: examples.filter(e => e.action === 'save').length,
        skips: examples.filter(e => e.action === 'skip').length,
        preferencePairs: preferencePairs.length,
      },
      examples,
      preferencePairs,
      learnedPreferences: prefs.map(p => ({
        category: p.category,
        value: p.value,
        confidence: p.confidence,
        negativeConfidence: p.negativeConfidence,
      })),
    };

    return dataset;
  }

  /**
   * Export as JSON file and share
   */
  async exportAndShare(personaId?: string): Promise<void> {
    try {
      const dataset = await this.exportTrainingData(personaId);
      
      const fileName = `specter_training_${personaId || 'all'}_${Date.now()}.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(dataset, null, 2));
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/json',
          dialogTitle: 'Export Training Data',
        });
      }

      logger.info('TrainingLogger', 'Exported training data', {
        examples: dataset.stats.totalExamples,
        pairs: dataset.stats.preferencePairs,
      });
    } catch (error) {
      logger.error('TrainingLogger', 'Failed to export', error);
      throw error;
    }
  }

  /**
   * Export in JSONL format for HuggingFace datasets
   */
  async exportAsJSONL(personaId?: string): Promise<string> {
    const dataset = await this.exportTrainingData(personaId);
    
    // Convert to JSONL format
    const lines: string[] = [];
    
    // Add examples
    for (const example of dataset.examples) {
      lines.push(JSON.stringify({
        type: 'example',
        ...example,
      }));
    }
    
    // Add preference pairs
    for (const pair of dataset.preferencePairs) {
      lines.push(JSON.stringify({
        type: 'preference_pair',
        ...pair,
      }));
    }
    
    return lines.join('\n');
  }

  /**
   * Get training stats summary
   */
  getStats(): {
    totalExamples: number;
    byAction: Record<string, number>;
    byPersona: Record<string, number>;
    oldestExample: string | null;
    newestExample: string | null;
  } {
    const byAction: Record<string, number> = {};
    const byPersona: Record<string, number> = {};

    for (const example of this.logBuffer) {
      byAction[example.action] = (byAction[example.action] || 0) + 1;
      const personaKey = example.personaName || 'global';
      byPersona[personaKey] = (byPersona[personaKey] || 0) + 1;
    }

    return {
      totalExamples: this.logBuffer.length,
      byAction,
      byPersona,
      oldestExample: this.logBuffer[0]?.timestamp || null,
      newestExample: this.logBuffer[this.logBuffer.length - 1]?.timestamp || null,
    };
  }

  /**
   * Clear all training data
   */
  async clear(): Promise<void> {
    this.logBuffer = [];
    await AsyncStorage.removeItem(TRAINING_LOG_KEY);
    logger.info('TrainingLogger', 'Cleared training data');
  }
}

// Singleton instance
export const trainingLogger = new TrainingLogger();

// Initialize on import
trainingLogger.initialize().catch(err => {
  logger.error('TrainingLogger', 'Failed to initialize on import', err);
});

export default trainingLogger;

