// AI Insights Card Component
// Displays AI analysis with tool execution traces

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface ToolCall {
  tool: string;
  args?: Record<string, any>;
  result?: any;
  error?: string;
}

interface AIInsightsCardProps {
  score?: number;
  recommendation?: string;
  analysis?: string;
  strengths?: string[];
  concerns?: string[];
  toolCalls?: ToolCall[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function AIInsightsCard({
  score,
  recommendation,
  analysis,
  strengths = [],
  concerns = [],
  toolCalls = [],
  isLoading = false,
  onRefresh
}: AIInsightsCardProps) {
  const [showToolCalls, setShowToolCalls] = useState(false);

  const getRecommendationStyle = () => {
    if (!recommendation) return styles.recommendationDefault;
    if (recommendation.includes('STRONG')) return styles.recommendationStrong;
    if (recommendation.includes('SOFT') || recommendation.includes('GOOD')) return styles.recommendationSoft;
    if (recommendation.includes('BORDERLINE') || recommendation.includes('MODERATE')) return styles.recommendationBorderline;
    return styles.recommendationPass;
  };

  const getScoreColor = () => {
    if (!score) return '#888899';
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#eab308';
    if (score >= 40) return '#f97316';
    return '#ef4444';
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🤖 AI Analysis</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Analyzing candidate...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🤖 AI Analysis</Text>
        {onRefresh && (
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Text style={styles.refreshText}>↻ Refresh</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Score and Recommendation */}
      {(score !== undefined || recommendation) && (
        <View style={styles.scoreSection}>
          {score !== undefined && (
            <View style={styles.scoreContainer}>
              <Text style={[styles.score, { color: getScoreColor() }]}>{score}</Text>
              <Text style={styles.scoreLabel}>/100</Text>
            </View>
          )}
          {recommendation && (
            <View style={[styles.recommendationBadge, getRecommendationStyle()]}>
              <Text style={styles.recommendationText}>{recommendation}</Text>
            </View>
          )}
        </View>
      )}

      {/* Analysis */}
      {analysis && (
        <Text style={styles.analysis}>{analysis}</Text>
      )}

      {/* Strengths */}
      {strengths.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✅ Strengths</Text>
          {strengths.map((strength, i) => (
            <View key={i} style={styles.bulletItem}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{strength}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Concerns */}
      {concerns.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Concerns</Text>
          {concerns.map((concern, i) => (
            <View key={i} style={styles.bulletItem}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletTextConcern}>{concern}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Tool Calls (Expandable) */}
      {toolCalls.length > 0 && (
        <View style={styles.toolCallsSection}>
          <TouchableOpacity 
            style={styles.toolCallsHeader}
            onPress={() => setShowToolCalls(!showToolCalls)}
          >
            <Text style={styles.toolCallsTitle}>
              🔧 Tool Calls ({toolCalls.length})
            </Text>
            <Text style={styles.expandIcon}>
              {showToolCalls ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>
          
          {showToolCalls && (
            <View style={styles.toolCallsList}>
              {toolCalls.map((call, i) => (
                <View key={i} style={styles.toolCall}>
                  <View style={styles.toolCallHeader}>
                    <Text style={styles.toolName}>{call.tool}</Text>
                    {call.error ? (
                      <Text style={styles.toolError}>❌</Text>
                    ) : (
                      <Text style={styles.toolSuccess}>✓</Text>
                    )}
                  </View>
                  {call.args && (
                    <Text style={styles.toolArgs}>
                      Args: {JSON.stringify(call.args)}
                    </Text>
                  )}
                  {call.result && (
                    <Text style={styles.toolResult} numberOfLines={2}>
                      Result: {typeof call.result === 'object' 
                        ? JSON.stringify(call.result).substring(0, 100) + '...'
                        : call.result
                      }
                    </Text>
                  )}
                  {call.error && (
                    <Text style={styles.toolErrorText}>
                      Error: {call.error}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Empty State */}
      {!score && !recommendation && !analysis && strengths.length === 0 && concerns.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No AI analysis available</Text>
          {onRefresh && (
            <TouchableOpacity onPress={onRefresh} style={styles.generateButton}>
              <Text style={styles.generateButtonText}>Generate Analysis</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  refreshButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  refreshText: {
    fontSize: 14,
    color: '#6366f1',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#8888aa',
  },
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  score: {
    fontSize: 36,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: 16,
    color: '#888899',
    marginLeft: 2,
  },
  recommendationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  recommendationDefault: {
    backgroundColor: '#4a4a6a33',
  },
  recommendationStrong: {
    backgroundColor: '#22c55e33',
  },
  recommendationSoft: {
    backgroundColor: '#eab30833',
  },
  recommendationBorderline: {
    backgroundColor: '#f9731633',
  },
  recommendationPass: {
    backgroundColor: '#ef444433',
  },
  recommendationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  analysis: {
    fontSize: 14,
    color: '#ccccdd',
    lineHeight: 20,
    marginBottom: 12,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#aaaacc',
    marginBottom: 8,
  },
  bulletItem: {
    flexDirection: 'row',
    paddingLeft: 4,
    marginBottom: 4,
  },
  bulletDot: {
    color: '#22c55e',
    marginRight: 8,
    fontSize: 14,
  },
  bulletText: {
    fontSize: 13,
    color: '#ccccdd',
    flex: 1,
  },
  bulletTextConcern: {
    fontSize: 13,
    color: '#f97316',
    flex: 1,
  },
  toolCallsSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
    paddingTop: 12,
  },
  toolCallsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toolCallsTitle: {
    fontSize: 13,
    color: '#8888aa',
  },
  expandIcon: {
    fontSize: 12,
    color: '#8888aa',
  },
  toolCallsList: {
    marginTop: 8,
    gap: 8,
  },
  toolCall: {
    backgroundColor: '#252540',
    borderRadius: 8,
    padding: 8,
  },
  toolCallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toolName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
  },
  toolSuccess: {
    color: '#22c55e',
  },
  toolError: {
    color: '#ef4444',
  },
  toolArgs: {
    fontSize: 11,
    color: '#888899',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  toolResult: {
    fontSize: 11,
    color: '#aaaacc',
    marginTop: 4,
  },
  toolErrorText: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666688',
    marginBottom: 12,
  },
  generateButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  generateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});

