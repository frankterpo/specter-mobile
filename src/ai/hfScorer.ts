// HuggingFace Embeddings for Semantic Scoring
// Uses MiniLM for embedding persona recipes and candidate profiles

import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js for React Native
env.useBrowserCache = false;
env.allowLocalModels = true;

// Types
export interface EmbeddingResult {
  text: string;
  embedding: number[];
}

export interface SimilarityResult {
  score: number;
  matchedCriteria: string[];
  explanation: string;
}

// Embedding pipeline
let embeddingPipeline: any = null;
let isInitialized = false;

/**
 * Initialize the embedding model
 * Uses Xenova/all-MiniLM-L6-v2 for fast, accurate embeddings
 */
export async function initEmbeddings(): Promise<void> {
  if (isInitialized) return;
  
  try {
    console.log('🤗 Loading HuggingFace embedding model...');
    
    embeddingPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { 
        progress_callback: (progress: any) => {
          if (progress.status === 'progress') {
            console.log(`   Loading: ${Math.round(progress.progress)}%`);
          }
        }
      }
    );
    
    isInitialized = true;
    console.log('✅ HuggingFace embeddings initialized');
  } catch (error) {
    console.error('❌ Failed to initialize HuggingFace:', error);
    throw error;
  }
}

/**
 * Generate embedding for text
 */
export async function embed(text: string): Promise<number[]> {
  if (!embeddingPipeline) {
    throw new Error('Embeddings not initialized. Call initEmbeddings() first.');
  }
  
  const result = await embeddingPipeline(text, {
    pooling: 'mean',
    normalize: true
  });
  
  // Convert to array
  return Array.from(result.data);
}

/**
 * Generate embeddings for multiple texts
 */
export async function embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  
  for (const text of texts) {
    const embedding = await embed(text);
    results.push({ text, embedding });
  }
  
  return results;
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have same dimension');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Convert persona recipe to embeddable text
 */
export function recipeToText(recipe: {
  positiveHighlights: string[];
  negativeHighlights: string[];
  redFlags: string[];
}): string {
  const positive = recipe.positiveHighlights
    .map(h => h.replace(/_/g, ' '))
    .join(', ');
  
  const negative = recipe.negativeHighlights
    .map(h => h.replace(/_/g, ' '))
    .join(', ');
  
  const redFlags = recipe.redFlags
    .map(h => h.replace(/_/g, ' '))
    .join(', ');
  
  return `
Ideal candidate profile:
Positive signals: ${positive}
Concerns: ${negative}
Red flags to avoid: ${redFlags}
  `.trim();
}

/**
 * Convert candidate profile to embeddable text
 */
export function candidateToText(candidate: {
  name?: string;
  title?: string;
  company?: string;
  highlights?: string[];
  experience?: { company: string; title: string }[];
}): string {
  const highlights = (candidate.highlights || [])
    .map(h => h.replace(/_/g, ' '))
    .join(', ');
  
  const experience = (candidate.experience || [])
    .map(e => `${e.title} at ${e.company}`)
    .join('; ');
  
  return `
Candidate: ${candidate.name || 'Unknown'}
Current role: ${candidate.title || 'Unknown'} at ${candidate.company || 'Unknown'}
Key highlights: ${highlights}
Experience: ${experience}
  `.trim();
}

/**
 * Score a candidate against a persona recipe using embeddings
 */
export async function scoreCandidate(
  candidate: {
    name?: string;
    title?: string;
    company?: string;
    highlights?: string[];
    experience?: { company: string; title: string }[];
  },
  recipe: {
    positiveHighlights: string[];
    negativeHighlights: string[];
    redFlags: string[];
  },
  learnedWeights?: Record<string, number>
): Promise<SimilarityResult> {
  // Generate embeddings
  const recipeText = recipeToText(recipe);
  const candidateText = candidateToText(candidate);
  
  const recipeEmbedding = await embed(recipeText);
  const candidateEmbedding = await embed(candidateText);
  
  // Calculate semantic similarity
  const semanticScore = cosineSimilarity(recipeEmbedding, candidateEmbedding);
  
  // Also calculate rule-based score for comparison
  const highlights = candidate.highlights || [];
  const matchedCriteria: string[] = [];
  let ruleScore = 50;
  
  for (const h of highlights) {
    const normalized = h.toLowerCase().replace(/\s+/g, '_');
    
    // Check positive
    if (recipe.positiveHighlights.some(p => normalized.includes(p) || p.includes(normalized))) {
      const weight = learnedWeights?.[normalized] || 0.5;
      ruleScore += weight * 15;
      matchedCriteria.push(`+${h}`);
    }
    
    // Check negative
    if (recipe.negativeHighlights.some(n => normalized.includes(n) || n.includes(normalized))) {
      const weight = learnedWeights?.[normalized] || -0.3;
      ruleScore += weight * 15;
      matchedCriteria.push(`-${h}`);
    }
    
    // Check red flags
    if (recipe.redFlags.some(r => normalized.includes(r) || r.includes(normalized))) {
      const weight = learnedWeights?.[normalized] || -0.5;
      ruleScore += weight * 20;
      matchedCriteria.push(`🚩${h}`);
    }
  }
  
  // Combine semantic and rule-based scores
  // Semantic: 40%, Rule-based: 60%
  const combinedScore = Math.round(
    (semanticScore * 100 * 0.4) + (Math.max(0, Math.min(100, ruleScore)) * 0.6)
  );
  
  // Generate explanation
  let explanation: string;
  if (combinedScore >= 80) {
    explanation = `Strong semantic match (${(semanticScore * 100).toFixed(0)}%) with positive signals: ${matchedCriteria.filter(c => c.startsWith('+')).join(', ')}`;
  } else if (combinedScore >= 60) {
    explanation = `Good match (${(semanticScore * 100).toFixed(0)}% semantic) with some concerns`;
  } else if (combinedScore >= 40) {
    explanation = `Borderline match. Semantic similarity: ${(semanticScore * 100).toFixed(0)}%`;
  } else {
    explanation = `Low match (${(semanticScore * 100).toFixed(0)}% semantic). Red flags: ${matchedCriteria.filter(c => c.startsWith('🚩')).join(', ')}`;
  }
  
  return {
    score: combinedScore,
    matchedCriteria,
    explanation
  };
}

/**
 * Find most similar candidates from a list
 */
export async function findSimilarCandidates(
  targetCandidate: {
    name?: string;
    title?: string;
    company?: string;
    highlights?: string[];
    experience?: { company: string; title: string }[];
  },
  candidates: Array<{
    id: string;
    name?: string;
    title?: string;
    company?: string;
    highlights?: string[];
    experience?: { company: string; title: string }[];
  }>,
  topK: number = 5
): Promise<Array<{ id: string; similarity: number }>> {
  const targetEmbedding = await embed(candidateToText(targetCandidate));
  
  const similarities: Array<{ id: string; similarity: number }> = [];
  
  for (const candidate of candidates) {
    const candidateEmbedding = await embed(candidateToText(candidate));
    const similarity = cosineSimilarity(targetEmbedding, candidateEmbedding);
    similarities.push({ id: candidate.id, similarity });
  }
  
  // Sort by similarity and return top K
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/**
 * Check if embeddings are ready
 */
export function isEmbeddingsReady(): boolean {
  return isInitialized && embeddingPipeline !== null;
}

/**
 * Cleanup embeddings
 */
export async function cleanupEmbeddings(): Promise<void> {
  embeddingPipeline = null;
  isInitialized = false;
}

