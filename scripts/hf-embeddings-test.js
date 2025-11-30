#!/usr/bin/env node
/**
 * HuggingFace Embeddings Test Script
 * Tests semantic scoring with MiniLM embeddings
 * 
 * Run: node scripts/hf-embeddings-test.js
 */

const { pipeline, env } = require('@huggingface/transformers');

// Configure for Node.js
env.useBrowserCache = false;
env.allowLocalModels = true;

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════════╗');
console.log('║ 🤗 HUGGING FACE EMBEDDINGS TEST                                       ║');
console.log('╚═══════════════════════════════════════════════════════════════════════╝');
console.log('');

// Persona recipes
const EARLY_STAGE_RECIPE = {
  positiveHighlights: ['serial_founder', 'prior_exit', 'yc_alumni', 'unicorn_experience'],
  negativeHighlights: ['no_linkedin', 'career_gap', 'short_tenure'],
  redFlags: ['stealth_only', 'no_experience', 'junior_level']
};

// Test candidates
const TEST_CANDIDATES = [
  {
    id: 'candidate_1',
    name: 'Sarah Chen',
    title: 'Founder & CEO',
    company: 'AI Startup',
    highlights: ['serial_founder', 'prior_exit', 'yc_alumni', 'stanford_alumni'],
    experience: [
      { company: 'Previous Startup (Acquired)', title: 'CEO' },
      { company: 'AI Startup', title: 'Founder & CEO' }
    ]
  },
  {
    id: 'candidate_2',
    name: 'Michael Rodriguez',
    title: 'VP Engineering',
    company: 'TechCorp',
    highlights: ['fortune_500_experience', 'technical_background', 'scaled_team'],
    experience: [
      { company: 'Google', title: 'Senior Engineer' },
      { company: 'TechCorp', title: 'VP Engineering' }
    ]
  },
  {
    id: 'candidate_3',
    name: 'Emily Johnson',
    title: 'Product Manager',
    company: 'StartupXYZ',
    highlights: ['product_leader', 'no_startup_experience'],
    experience: [
      { company: 'Consulting Firm', title: 'Consultant' },
      { company: 'StartupXYZ', title: 'Product Manager' }
    ]
  },
  {
    id: 'candidate_4',
    name: 'David Kim',
    title: 'Consultant',
    company: 'McKinsey',
    highlights: ['consultant_only', 'no_technical_background'],
    experience: [
      { company: 'McKinsey', title: 'Associate' },
      { company: 'McKinsey', title: 'Consultant' }
    ]
  }
];

// Helper functions
function recipeToText(recipe) {
  const positive = recipe.positiveHighlights.map(h => h.replace(/_/g, ' ')).join(', ');
  const negative = recipe.negativeHighlights.map(h => h.replace(/_/g, ' ')).join(', ');
  const redFlags = recipe.redFlags.map(h => h.replace(/_/g, ' ')).join(', ');
  
  return `
Ideal candidate profile:
Positive signals: ${positive}
Concerns: ${negative}
Red flags to avoid: ${redFlags}
  `.trim();
}

function candidateToText(candidate) {
  const highlights = (candidate.highlights || []).map(h => h.replace(/_/g, ' ')).join(', ');
  const experience = (candidate.experience || []).map(e => `${e.title} at ${e.company}`).join('; ');
  
  return `
Candidate: ${candidate.name}
Current role: ${candidate.title} at ${candidate.company}
Key highlights: ${highlights}
Experience: ${experience}
  `.trim();
}

function cosineSimilarity(a, b) {
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

async function runTest() {
  console.log('📥 Loading MiniLM embedding model...');
  console.log('   (This may take a minute on first run)');
  console.log('');
  
  try {
    // Load model
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true
    });
    
    console.log('✅ Model loaded');
    console.log('');
    
    // Embed recipe
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('📋 EMBEDDING PERSONA RECIPE');
    console.log('═══════════════════════════════════════════════════════════════════════');
    
    const recipeText = recipeToText(EARLY_STAGE_RECIPE);
    console.log('Recipe text:');
    console.log(recipeText);
    console.log('');
    
    const recipeEmbedding = await extractor(recipeText, { pooling: 'mean', normalize: true });
    const recipeVector = Array.from(recipeEmbedding.data);
    console.log(`Embedding dimension: ${recipeVector.length}`);
    console.log('');
    
    // Score each candidate
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('🎯 SCORING CANDIDATES');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('');
    
    const results = [];
    
    for (const candidate of TEST_CANDIDATES) {
      const candidateText = candidateToText(candidate);
      const candidateEmbedding = await extractor(candidateText, { pooling: 'mean', normalize: true });
      const candidateVector = Array.from(candidateEmbedding.data);
      
      const similarity = cosineSimilarity(recipeVector, candidateVector);
      const score = Math.round(similarity * 100);
      
      results.push({
        candidate,
        similarity,
        score
      });
      
      console.log(`─────────────────────────────────────────────────────────────────────`);
      console.log(`${candidate.name} - ${candidate.title}`);
      console.log(`   Highlights: ${candidate.highlights.join(', ')}`);
      console.log(`   Semantic Similarity: ${(similarity * 100).toFixed(1)}%`);
      
      let recommendation;
      if (score >= 80) recommendation = '🟢 STRONG_PASS';
      else if (score >= 70) recommendation = '🟡 SOFT_PASS';
      else if (score >= 60) recommendation = '🟠 BORDERLINE';
      else recommendation = '🔴 PASS';
      
      console.log(`   Recommendation: ${recommendation}`);
      console.log('');
    }
    
    // Rank candidates
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('📊 RANKED RESULTS');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('');
    
    results.sort((a, b) => b.similarity - a.similarity);
    
    results.forEach((r, i) => {
      const bar = '█'.repeat(Math.round(r.similarity * 20));
      console.log(`   ${i + 1}. ${r.candidate.name.padEnd(20)} ${(r.similarity * 100).toFixed(1)}% ${bar}`);
    });
    
    // Find similar candidates
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('🔍 FINDING SIMILAR CANDIDATES');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('');
    
    // Find candidates similar to the top one
    const topCandidate = results[0].candidate;
    console.log(`Finding candidates similar to: ${topCandidate.name}`);
    console.log('');
    
    const topEmbedding = await extractor(candidateToText(topCandidate), { pooling: 'mean', normalize: true });
    const topVector = Array.from(topEmbedding.data);
    
    for (const r of results.slice(1)) {
      const candidateEmbedding = await extractor(candidateToText(r.candidate), { pooling: 'mean', normalize: true });
      const candidateVector = Array.from(candidateEmbedding.data);
      
      const similarity = cosineSimilarity(topVector, candidateVector);
      console.log(`   ${r.candidate.name}: ${(similarity * 100).toFixed(1)}% similar`);
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('✅ HUGGING FACE EMBEDDINGS TEST COMPLETED');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Key insights:');
    console.log('  • Semantic similarity captures meaning beyond keyword matching');
    console.log('  • MiniLM provides fast, accurate embeddings (384 dimensions)');
    console.log('  • Can be combined with rule-based scoring for best results');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('');
    console.log('Note: HuggingFace transformers.js requires Node.js 18+ and may need');
    console.log('additional setup for first-time model download.');
  }
}

runTest();

