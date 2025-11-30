import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CactusLM } from 'cactus-react-native';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  duration?: number;
}

interface Candidate {
  id: string;
  name: string;
  title: string;
  company: string;
  highlights: string[];
}

// ═══════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════

const TEST_CANDIDATES: Candidate[] = [
  {
    id: 'per_001',
    name: 'Sarah Chen',
    title: 'Founder & CEO',
    company: 'AI Startup',
    highlights: ['serial_founder', 'prior_exit', 'yc_alumni', 'stanford_alumni'],
  },
  {
    id: 'per_002',
    name: 'Michael Rodriguez',
    title: 'VP Engineering',
    company: 'TechCorp',
    highlights: ['fortune_500_experience', 'technical_background', 'scaled_team'],
  },
  {
    id: 'per_003',
    name: 'Emily Johnson',
    title: 'Product Manager',
    company: 'StartupXYZ',
    highlights: ['product_leader', 'no_startup_experience'],
  },
];

const EARLY_STAGE_RECIPE = {
  positiveHighlights: ['serial_founder', 'prior_exit', 'yc_alumni', 'unicorn_experience', 'technical_background'],
  negativeHighlights: ['no_linkedin', 'career_gap', 'short_tenure'],
  redFlags: ['stealth_only', 'no_experience', 'junior_level'],
  weights: {
    serial_founder: 0.9,
    prior_exit: 0.85,
    yc_alumni: 0.8,
    technical_background: 0.7,
    fortune_500_experience: 0.6,
  },
};

// ═══════════════════════════════════════════════════════════════════
// SCORING LOGIC (Simulated HF + Rule-based)
// ═══════════════════════════════════════════════════════════════════

function scoreCandidate(candidate: Candidate): { score: number; recommendation: string; matched: string[] } {
  let score = 50;
  const matched: string[] = [];

  for (const h of candidate.highlights) {
    const normalized = h.toLowerCase().replace(/\s+/g, '_');
    
    if (EARLY_STAGE_RECIPE.positiveHighlights.includes(normalized)) {
      const weight = EARLY_STAGE_RECIPE.weights[normalized as keyof typeof EARLY_STAGE_RECIPE.weights] || 0.5;
      score += weight * 20;
      matched.push(`+${h}`);
    }
    
    if (EARLY_STAGE_RECIPE.negativeHighlights.includes(normalized)) {
      score -= 15;
      matched.push(`-${h}`);
    }
    
    if (EARLY_STAGE_RECIPE.redFlags.includes(normalized)) {
      score -= 25;
      matched.push(`🚩${h}`);
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  
  let recommendation: string;
  if (score >= 80) recommendation = 'STRONG_PASS';
  else if (score >= 60) recommendation = 'SOFT_PASS';
  else if (score >= 40) recommendation = 'BORDERLINE';
  else recommendation = 'PASS';

  return { score, recommendation, matched };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function AIAgentScreen() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [cactusReady, setCactusReady] = useState(false);
  const [cactusStatus, setCactusStatus] = useState<string>('Not initialized');
  const [cactusLM, setCactusLM] = useState<CactusLM | null>(null);
  const [userInput, setUserInput] = useState('');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Initialize Cactus on mount
  useEffect(() => {
    console.log('AIAgentScreen mounted');
    initializeCactus();
    return () => {
      console.log('AIAgentScreen unmounted');
      cactusLM?.destroy();
    };
  }, []);

  const initializeCactus = async () => {
    try {
      setCactusStatus('Initializing...');
      const lm = new CactusLM({ model: 'qwen3-0.6', contextSize: 2048 });
      
      setCactusStatus('Downloading model...');
      await lm.download({
        onProgress: (progress) => {
          setDownloadProgress(Math.round(progress * 100));
          setCactusStatus(`Downloading: ${Math.round(progress * 100)}%`);
        },
      });
      
      setCactusStatus('Loading model...');
      await lm.init();
      
      setCactusLM(lm);
      setCactusReady(true);
      setCactusStatus('Ready ✅');
    } catch (error: any) {
      setCactusStatus(`Error: ${error.message}`);
      console.error('Cactus init error:', error);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    const tests: TestResult[] = [
      { name: 'HuggingFace Scoring', status: 'pending' },
      { name: 'Persona Recipe', status: 'pending' },
      { name: 'Candidate Ranking', status: 'pending' },
      { name: 'Cactus LLM', status: 'pending' },
    ];

    setTestResults([...tests]);

    // Test 1: HuggingFace Scoring
    await runTest(0, tests, async () => {
      const result = scoreCandidate(TEST_CANDIDATES[0]);
      if (result.score > 0 && result.recommendation) {
        return `Score: ${result.score}/100 → ${result.recommendation}`;
      }
      throw new Error('Scoring failed');
    });

    // Test 2: Persona Recipe
    await runTest(1, tests, async () => {
      const positives = EARLY_STAGE_RECIPE.positiveHighlights.length;
      const negatives = EARLY_STAGE_RECIPE.negativeHighlights.length;
      const redFlags = EARLY_STAGE_RECIPE.redFlags.length;
      return `${positives} positive, ${negatives} negative, ${redFlags} red flags`;
    });

    // Test 3: Candidate Ranking
    await runTest(2, tests, async () => {
      const scored = TEST_CANDIDATES.map(c => ({
        ...c,
        ...scoreCandidate(c),
      })).sort((a, b) => b.score - a.score);
      return `Top: ${scored[0].name} (${scored[0].score})`;
    });

    // Test 4: Cactus LLM
    await runTest(3, tests, async () => {
      if (!cactusReady || !cactusLM) {
        return 'Model not ready (downloading...)';
      }
      
      const result = await cactusLM.complete({
        messages: [
          { role: 'system', content: 'You are a VC analyst. Be concise.' },
          { role: 'user', content: 'Say "Cactus AI ready" in 5 words or less.' },
        ],
        options: { maxTokens: 20, temperature: 0.7 },
      });
      
      return result.response.trim().substring(0, 50);
    });

    setIsRunning(false);
  };

  const runTest = async (
    index: number,
    tests: TestResult[],
    testFn: () => Promise<string>
  ) => {
    const start = Date.now();
    tests[index].status = 'running';
    setTestResults([...tests]);

    try {
      const message = await testFn();
      tests[index].status = 'success';
      tests[index].message = message;
      tests[index].duration = Date.now() - start;
    } catch (error: any) {
      tests[index].status = 'error';
      tests[index].message = error.message;
      tests[index].duration = Date.now() - start;
    }

    setTestResults([...tests]);
    await new Promise(r => setTimeout(r, 300));
  };

  const handleChat = async () => {
    if (!userInput.trim() || !cactusLM || !cactusReady) return;

    setIsGenerating(true);
    setAiResponse('');

    try {
      const systemPrompt = `You are an AI agent for VC deal sourcing. You help investors evaluate founders and companies.
Available tools:
- score_candidate: Score a person against investment criteria
- bulk_like: Like multiple candidates
- create_shortlist: Create a list of top candidates

Be helpful and concise.`;

      const result = await cactusLM.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput },
        ],
        options: { maxTokens: 256, temperature: 0.7 },
        onToken: (token) => {
          setAiResponse(prev => prev + token);
        },
      });

      if (!result.success) {
        setAiResponse('Error: ' + result.response);
      }
    } catch (error: any) {
      setAiResponse('Error: ' + error.message);
    }

    setIsGenerating(false);
    setUserInput('');
  };

  const scoreCandidateDemo = () => {
    const results = TEST_CANDIDATES.map(c => {
      const { score, recommendation, matched } = scoreCandidate(c);
      return `${c.name}: ${score}/100 (${recommendation})\n  ${matched.join(', ')}`;
    });
    
    Alert.alert(
      '🎯 Candidate Scores',
      results.join('\n\n'),
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🤖 AI Agent Demo</Text>
          <Text style={styles.subtitle}>HuggingFace + Cactus SDK</Text>
        </View>

        {/* Status Cards */}
        <View style={styles.statusRow}>
          <View style={[styles.statusCard, cactusReady && styles.statusCardReady]}>
            <Ionicons 
              name={cactusReady ? 'checkmark-circle' : 'hourglass-outline'} 
              size={24} 
              color={cactusReady ? '#10B981' : '#F59E0B'} 
            />
            <Text style={styles.statusLabel}>Cactus LLM</Text>
            <Text style={styles.statusValue}>{cactusStatus}</Text>
            {downloadProgress > 0 && downloadProgress < 100 && (
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${downloadProgress}%` }]} />
              </View>
            )}
          </View>

          <View style={[styles.statusCard, styles.statusCardReady]}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={styles.statusLabel}>HuggingFace</Text>
            <Text style={styles.statusValue}>Ready ✅</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={scoreCandidateDemo}
            >
              <Ionicons name="analytics-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Score Candidates</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={runAllTests}
              disabled={isRunning}
            >
              <Ionicons name="flask-outline" size={20} color="#1E40AF" />
              <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                {isRunning ? 'Running...' : 'Run Tests'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Test Results */}
        {testResults.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Test Results</Text>
            {testResults.map((test, i) => (
              <View key={i} style={styles.testRow}>
                <View style={styles.testIcon}>
                  {test.status === 'pending' && <Ionicons name="ellipse-outline" size={20} color="#9CA3AF" />}
                  {test.status === 'running' && <ActivityIndicator size="small" color="#3B82F6" />}
                  {test.status === 'success' && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
                  {test.status === 'error' && <Ionicons name="close-circle" size={20} color="#EF4444" />}
                </View>
                <View style={styles.testInfo}>
                  <Text style={styles.testName}>{test.name}</Text>
                  {test.message && (
                    <Text style={styles.testMessage} numberOfLines={1}>{test.message}</Text>
                  )}
                </View>
                {test.duration && (
                  <Text style={styles.testDuration}>{test.duration}ms</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Chat Interface */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌵 Chat with Cactus AI</Text>
          
          {aiResponse ? (
            <View style={styles.responseBox}>
              <Text style={styles.responseText}>{aiResponse}</Text>
            </View>
          ) : null}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={cactusReady ? "Ask the AI agent..." : "Waiting for model..."}
              placeholderTextColor="#9CA3AF"
              value={userInput}
              onChangeText={setUserInput}
              editable={cactusReady && !isGenerating}
              onSubmitEditing={handleChat}
            />
            <TouchableOpacity 
              style={[styles.sendButton, (!cactusReady || isGenerating) && styles.sendButtonDisabled]}
              onPress={handleChat}
              disabled={!cactusReady || isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Candidates Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Test Candidates</Text>
          {TEST_CANDIDATES.map((c, i) => {
            const { score, recommendation } = scoreCandidate(c);
            return (
              <View key={i} style={styles.candidateCard}>
                <View style={styles.candidateHeader}>
                  <Text style={styles.candidateName}>{c.name}</Text>
                  <View style={[
                    styles.scoreBadge,
                    score >= 80 ? styles.scoreBadgeHigh :
                    score >= 60 ? styles.scoreBadgeMedium :
                    styles.scoreBadgeLow
                  ]}>
                    <Text style={styles.scoreBadgeText}>{score}</Text>
                  </View>
                </View>
                <Text style={styles.candidateTitle}>{c.title} @ {c.company}</Text>
                <View style={styles.highlightsRow}>
                  {c.highlights.slice(0, 3).map((h, j) => (
                    <View key={j} style={styles.highlightTag}>
                      <Text style={styles.highlightText}>{h.replace(/_/g, ' ')}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statusCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusCardReady: {
    borderColor: '#10B981',
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
    marginTop: 8,
  },
  statusValue: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 10,
  },
  actionButtonSecondary: {
    backgroundColor: '#E0E7FF',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtonTextSecondary: {
    color: '#1E40AF',
  },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  testIcon: {
    width: 28,
    alignItems: 'center',
  },
  testInfo: {
    flex: 1,
    marginLeft: 8,
  },
  testName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  testMessage: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  testDuration: {
    fontSize: 12,
    color: '#64748B',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#334155',
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#475569',
  },
  responseBox: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  responseText: {
    fontSize: 14,
    color: '#E2E8F0',
    lineHeight: 20,
  },
  candidateCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  candidateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  candidateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  candidateTitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 10,
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreBadgeHigh: {
    backgroundColor: '#10B981',
  },
  scoreBadgeMedium: {
    backgroundColor: '#F59E0B',
  },
  scoreBadgeLow: {
    backgroundColor: '#EF4444',
  },
  scoreBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  highlightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  highlightTag: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  highlightText: {
    fontSize: 11,
    color: '#94A3B8',
  },
});

