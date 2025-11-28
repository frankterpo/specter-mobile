// AI Insights Card - On-device founder analysis
// Displays summary, strengths, and risks with streaming support

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getFounderAgent, type FounderAnalysisResult } from '../ai/founderAgent';
import type { Person } from '../api/specter';
import { logger } from '../utils/logger';

interface AIInsightsCardProps {
  person: Person;
  cachedAnalysis?: FounderAnalysisResult | null;
  onAnalysisComplete?: (analysis: FounderAnalysisResult) => void;
}

type Stage = 'idle' | 'downloading' | 'initializing' | 'generating' | 'complete' | 'error';

export default function AIInsightsCard({
  person,
  cachedAnalysis,
  onAnalysisComplete,
}: AIInsightsCardProps) {
  const [stage, setStage] = useState<Stage>(cachedAnalysis ? 'complete' : 'idle');
  const [streamingText, setStreamingText] = useState('');
  const [analysis, setAnalysis] = useState<FounderAnalysisResult | null>(cachedAnalysis || null);
  const [error, setError] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUpResponse, setFollowUpResponse] = useState('');
  const [isAskingFollowUp, setIsAskingFollowUp] = useState(false);
  
  // Pulsing animation for the badge
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (stage === 'generating') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [stage]);

  const generateAnalysis = useCallback(async () => {
    setStage('downloading');
    setStreamingText('');
    setError(null);

    try {
      const agent = getFounderAgent();
      
      const result = await agent.analyzeFounder(person, {
        onProgress: (progressStage) => {
          setStage(progressStage);
        },
        onToken: (token) => {
          setStreamingText(prev => prev + token);
        },
      });

      setAnalysis(result);
      setStage('complete');
      onAnalysisComplete?.(result);
      
      // Success haptic
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      logger.info('AIInsightsCard', 'Analysis complete', {
        personId: person.id,
        tokensPerSecond: result.stats.tokensPerSecond,
      });
    } catch (err: any) {
      logger.error('AIInsightsCard', 'Analysis failed', err);
      setError(err.message || 'Failed to generate analysis');
      setStage('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [person, onAnalysisComplete]);

  const askFollowUp = useCallback(async () => {
    if (!followUpQuestion.trim() || !analysis) return;

    setIsAskingFollowUp(true);
    setFollowUpResponse('');

    try {
      const agent = getFounderAgent();
      
      const result = await agent.askFollowUp(
        person,
        analysis.rawResponse,
        followUpQuestion,
        {
          onToken: (token) => {
            setFollowUpResponse(prev => prev + token);
          },
        }
      );

      setFollowUpQuestion('');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err: any) {
      logger.error('AIInsightsCard', 'Follow-up failed', err);
    } finally {
      setIsAskingFollowUp(false);
    }
  }, [followUpQuestion, analysis, person]);

  // Auto-generate on mount if no cached analysis
  useEffect(() => {
    if (!cachedAnalysis && stage === 'idle') {
      // Small delay to let UI settle
      const timer = setTimeout(generateAnalysis, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const getStageText = () => {
    switch (stage) {
      case 'downloading': return 'Downloading AI model...';
      case 'initializing': return 'Initializing on-device AI...';
      case 'generating': return 'Analyzing founder...';
      default: return '';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with badge */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="sparkles" size={18} color="#8B5CF6" />
          <Text style={styles.title}>AI Insights</Text>
        </View>
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>On-Device • Private</Text>
        </View>
      </View>

      {/* Loading state */}
      {(stage === 'downloading' || stage === 'initializing' || stage === 'generating') && (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingHeader}>
            <ActivityIndicator size="small" color="#8B5CF6" />
            <Text style={styles.loadingText}>{getStageText()}</Text>
          </View>
          
          {/* Streaming text preview */}
          {streamingText && (
            <Animated.View style={[styles.streamingBox, { opacity: pulseAnim }]}>
              <Text style={styles.streamingText}>{streamingText}</Text>
              <View style={styles.cursor} />
            </Animated.View>
          )}
        </View>
      )}

      {/* Error state */}
      {stage === 'error' && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <Pressable onPress={generateAnalysis} style={styles.retryButton}>
            <Ionicons name="refresh" size={16} color="white" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Complete state - show analysis */}
      {stage === 'complete' && analysis && (
        <View style={styles.analysisContainer}>
          {/* Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            {analysis.summary.map((point, idx) => (
              <View key={idx} style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{point}</Text>
              </View>
            ))}
          </View>

          {/* Strengths */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="trending-up" size={16} color="#10B981" />
              <Text style={[styles.sectionTitle, { color: '#10B981' }]}>Strengths</Text>
            </View>
            {analysis.strengths.map((point, idx) => (
              <View key={idx} style={styles.bulletItem}>
                <Text style={[styles.bullet, { color: '#10B981' }]}>✓</Text>
                <Text style={styles.bulletText}>{point}</Text>
              </View>
            ))}
          </View>

          {/* Risks */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="alert-circle-outline" size={16} color="#F59E0B" />
              <Text style={[styles.sectionTitle, { color: '#F59E0B' }]}>Risks / Questions</Text>
            </View>
            {analysis.risks.map((point, idx) => (
              <View key={idx} style={styles.bulletItem}>
                <Text style={[styles.bullet, { color: '#F59E0B' }]}>?</Text>
                <Text style={styles.bulletText}>{point}</Text>
              </View>
            ))}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <Text style={styles.statsText}>
              ⚡ {analysis.stats.tokensPerSecond.toFixed(1)} tok/s
            </Text>
            <Text style={styles.statsText}>
              ⏱️ {(analysis.stats.totalTimeMs / 1000).toFixed(1)}s
            </Text>
          </View>

          {/* Follow-up response */}
          {followUpResponse && (
            <View style={styles.followUpResponse}>
              <Text style={styles.followUpResponseText}>{followUpResponse}</Text>
            </View>
          )}

          {/* Ask AI input */}
          <View style={styles.askContainer}>
            <TextInput
              style={styles.askInput}
              placeholder="Ask a follow-up question..."
              placeholderTextColor="#9CA3AF"
              value={followUpQuestion}
              onChangeText={setFollowUpQuestion}
              editable={!isAskingFollowUp}
            />
            <Pressable
              onPress={askFollowUp}
              disabled={!followUpQuestion.trim() || isAskingFollowUp}
              style={[
                styles.askButton,
                (!followUpQuestion.trim() || isAskingFollowUp) && styles.askButtonDisabled,
              ]}
            >
              {isAskingFollowUp ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="send" size={16} color="white" />
              )}
            </Pressable>
          </View>

          {/* Regenerate button */}
          <Pressable onPress={generateAnalysis} style={styles.regenerateButton}>
            <Ionicons name="refresh" size={14} color="#6B7280" />
            <Text style={styles.regenerateText}>Regenerate</Text>
          </Pressable>
        </View>
      )}

      {/* Idle state - manual trigger */}
      {stage === 'idle' && (
        <Pressable onPress={generateAnalysis} style={styles.generateButton}>
          <Ionicons name="sparkles" size={18} color="white" />
          <Text style={styles.generateButtonText}>Generate AI Analysis</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  badgeText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '500',
  },
  loadingContainer: {
    gap: 12,
  },
  loadingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  streamingBox: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  streamingText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  cursor: {
    width: 2,
    height: 16,
    backgroundColor: '#8B5CF6',
    marginLeft: 2,
  },
  errorContainer: {
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  analysisContainer: {
    gap: 16,
  },
  section: {
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  bulletItem: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 4,
  },
  bullet: {
    fontSize: 14,
    color: '#6B7280',
    width: 12,
  },
  bulletText: {
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  statsText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  followUpResponse: {
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
  },
  followUpResponseText: {
    fontSize: 14,
    color: '#4338CA',
    lineHeight: 20,
  },
  askContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  askInput: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  askButton: {
    backgroundColor: '#8B5CF6',
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  regenerateText: {
    fontSize: 13,
    color: '#6B7280',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    borderRadius: 8,
  },
  generateButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
});

