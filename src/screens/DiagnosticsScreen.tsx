// Diagnostic Dashboard for QA and Debugging
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { logger, LogEntry } from '../utils/logger';
import { useAuth } from '@clerk/clerk-expo';
import { getCactusClient, getCompletionLogs, CompletionLog } from '../ai/cactusClient';
import { getAgentMemory, UserPreference } from '../ai/agentMemory';

type DiagnosticsTab = 'logs' | 'memory' | 'prompts' | 'cactus';

export default function DiagnosticsScreen() {
  const navigation = useNavigation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { isSignedIn, userId } = useAuth();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<DiagnosticsTab>('memory');

  // Memory Inspector State
  const [memoryStats, setMemoryStats] = useState<{
    totalInteractions: number;
    totalConversations: number;
    likedCount: number;
    dislikedCount: number;
    preferencesLearned: number;
    toolCallsThisSession: number;
  } | null>(null);
  const [likedEntities, setLikedEntities] = useState<{ id: string; name: string; reason?: string }[]>([]);
  const [dislikedEntities, setDislikedEntities] = useState<{ id: string; name: string; reason?: string }[]>([]);
  const [preferences, setPreferences] = useState<UserPreference[]>([]);
  const [memoryContext, setMemoryContext] = useState<string>('');

  // Prompt Inspector State
  const [completionLogs, setCompletionLogs] = useState<CompletionLog[]>([]);
  const [selectedCompletion, setSelectedCompletion] = useState<CompletionLog | null>(null);

  // Cactus AI State
  const [cactusState, setCactusState] = useState<{
    status: 'idle' | 'downloading' | 'initializing' | 'ready' | 'generating' | 'error';
    progress: number;
    response: string;
    error: string | null;
    stats: { tokensPerSecond?: number; totalTimeMs?: number } | null;
  }>({
    status: 'idle',
    progress: 0,
    response: '',
    error: null,
    stats: null,
  });

  // Load memory data
  const loadMemoryData = async () => {
    try {
      const memory = getAgentMemory();
      await memory.load();
      
      const stats = memory.getStats();
      setMemoryStats(stats);
      
      // Get liked/disliked entities
      const liked = memory.getLikedEntities();
      const disliked = memory.getDislikedEntities();
      setLikedEntities(liked);
      setDislikedEntities(disliked);
      
      // Get learned preferences
      const prefs = memory.getLearnedPreferences();
      setPreferences(prefs);
      
      // Get full context
      const context = memory.buildFullContext();
      setMemoryContext(context);
      
      logger.info('Diagnostics', 'Memory data loaded', stats);
    } catch (error) {
      logger.error('Diagnostics', 'Failed to load memory', error);
    }
  };

  // Load completion logs
  const loadCompletionLogs = () => {
    const logs = getCompletionLogs();
    setCompletionLogs(logs);
  };

  const testCactusAI = async () => {
    setCactusState({ status: 'downloading', progress: 0, response: '', error: null, stats: null });
    
    try {
      const client = getCactusClient();
      
      // Download model
      await client.download((progress) => {
        setCactusState(prev => ({ ...prev, progress }));
      });
      
      setCactusState(prev => ({ ...prev, status: 'initializing' }));
      
      // Initialize
      await client.ensureReady();
      
      setCactusState(prev => ({ ...prev, status: 'generating', response: '' }));
      
      // Test completion with streaming
      const result = await client.complete({
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Keep responses brief.' },
          { role: 'user', content: 'Say "Cactus AI is working!" in exactly those words.' },
        ],
        options: { maxTokens: 50, temperature: 0.3 },
        onToken: (token) => {
          setCactusState(prev => ({ ...prev, response: prev.response + token }));
        },
      });
      
      setCactusState(prev => ({
        ...prev,
        status: 'ready',
        stats: {
          tokensPerSecond: result.tokensPerSecond,
          totalTimeMs: result.totalTimeMs,
        },
      }));
      
      logger.info('CactusTest', 'AI test completed successfully', result);
    } catch (error: any) {
      logger.error('CactusTest', 'AI test failed', error);
      setCactusState(prev => ({
        ...prev,
        status: 'error',
        error: error.message || 'Unknown error',
      }));
    }
  };

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        setLogs(logger.getLogs());
        if (activeTab === 'memory') loadMemoryData();
        if (activeTab === 'prompts') loadCompletionLogs();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, activeTab]);

  useEffect(() => {
    setLogs(logger.getLogs());
    loadMemoryData();
    loadCompletionLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.level === filter;
  });

  const handleExport = async () => {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        userId,
        isSignedIn,
        logs: logger.getLogs(),
        summary: {
          total: logs.length,
          errors: logs.filter(l => l.level === 'error').length,
          warnings: logs.filter(l => l.level === 'warn').length,
        },
      };

      await Share.share({
        message: JSON.stringify(exportData, null, 2),
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to export logs');
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Clear Logs?',
      'This will delete all diagnostic logs.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            logger.clearLogs();
            setLogs([]);
          },
        },
      ]
    );
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return '#EF4444';
      case 'warn': return '#F59E0B';
      case 'info': return '#3B82F6';
      case 'debug': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const getLevelEmoji = (level: string) => {
    switch (level) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'info': return '📘';
      case 'debug': return '🔍';
      default: return '📝';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#1E293B" />
          </Pressable>
          <Text style={styles.title}>🔬 Diagnostics</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={handleExport} style={styles.iconButton}>
            <Ionicons name="share-outline" size={22} color="#1a365d" />
          </Pressable>
          <Pressable onPress={handleClear} style={styles.iconButton}>
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
          </Pressable>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{logs.length}</Text>
          <Text style={styles.statLabel}>Total Logs</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#EF4444' }]}>
            {logs.filter(l => l.level === 'error').length}
          </Text>
          <Text style={styles.statLabel}>Errors</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#F59E0B' }]}>
            {logs.filter(l => l.level === 'warn').length}
          </Text>
          <Text style={styles.statLabel}>Warnings</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: isSignedIn ? '#22C55E' : '#EF4444' }]}>
            {isSignedIn ? '✓' : '✗'}
          </Text>
          <Text style={styles.statLabel}>Auth</Text>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabNav}>
        {[
          { id: 'memory' as DiagnosticsTab, label: '🧠 Memory', icon: 'brain' },
          { id: 'prompts' as DiagnosticsTab, label: '💬 Prompts', icon: 'chatbubbles' },
          { id: 'cactus' as DiagnosticsTab, label: '🌵 AI', icon: 'leaf' },
          { id: 'logs' as DiagnosticsTab, label: '📋 Logs', icon: 'list' },
        ].map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={[styles.tabButton, activeTab === tab.id && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, activeTab === tab.id && styles.tabButtonTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Memory Inspector Tab */}
      {activeTab === 'memory' && (
        <ScrollView style={styles.tabContent}>
          {/* Memory Stats */}
          <View style={styles.memorySection}>
            <Text style={styles.sectionTitle}>📊 Memory Stats</Text>
            <View style={styles.memoryStatsGrid}>
              <View style={styles.memoryStatItem}>
                <Text style={styles.memoryStatValue}>{memoryStats?.likedCount || 0}</Text>
                <Text style={styles.memoryStatLabel}>Likes</Text>
              </View>
              <View style={styles.memoryStatItem}>
                <Text style={[styles.memoryStatValue, { color: '#EF4444' }]}>{memoryStats?.dislikedCount || 0}</Text>
                <Text style={styles.memoryStatLabel}>Dislikes</Text>
              </View>
              <View style={styles.memoryStatItem}>
                <Text style={[styles.memoryStatValue, { color: '#8B5CF6' }]}>{memoryStats?.savedCount || 0}</Text>
                <Text style={styles.memoryStatLabel}>Saved</Text>
              </View>
              <View style={styles.memoryStatItem}>
                <Text style={[styles.memoryStatValue, { color: '#F59E0B' }]}>{(memoryStats?.totalReward || 0).toFixed(1)}</Text>
                <Text style={styles.memoryStatLabel}>Reward</Text>
              </View>
            </View>
          </View>

          {/* Learned Preferences */}
          {preferences.length > 0 && (
            <View style={styles.memorySection}>
              <Text style={styles.sectionTitle}>🎓 Learned Preferences</Text>
              {preferences.slice(0, 10).map((pref, idx) => {
                const netScore = pref.confidence - pref.negativeConfidence;
                const isPositive = netScore > 0;
                return (
                  <View key={idx} style={styles.preferenceItem}>
                    <View style={styles.preferenceHeader}>
                      <Text style={styles.preferenceCategory}>{pref.category}</Text>
                      <View style={[styles.preferenceBadge, isPositive ? styles.preferenceBadgePositive : styles.preferenceBadgeNegative]}>
                        <Text style={[styles.preferenceBadgeText, isPositive ? styles.preferenceBadgeTextPositive : styles.preferenceBadgeTextNegative]}>
                          {isPositive ? '+' : ''}{(netScore * 100).toFixed(0)}%
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.preferenceValue}>{pref.value}</Text>
                    <View style={styles.preferenceBar}>
                      <View style={[styles.preferenceBarFill, { width: `${Math.abs(netScore) * 100}%`, backgroundColor: isPositive ? '#22C55E' : '#EF4444' }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Recent Likes */}
          {likedEntities.length > 0 && (
            <View style={styles.memorySection}>
              <Text style={styles.sectionTitle}>👍 Recent Likes ({likedEntities.length})</Text>
              {likedEntities.slice(0, 5).map((entity, idx) => (
                <View key={idx} style={styles.entityItem}>
                  <Ionicons name="thumbs-up" size={14} color="#22C55E" />
                  <Text style={styles.entityName}>{entity.name}</Text>
                  {entity.reason && <Text style={styles.entityReason}>{entity.reason}</Text>}
                </View>
              ))}
            </View>
          )}

          {/* Recent Dislikes */}
          {dislikedEntities.length > 0 && (
            <View style={styles.memorySection}>
              <Text style={styles.sectionTitle}>👎 Recent Dislikes ({dislikedEntities.length})</Text>
              {dislikedEntities.slice(0, 5).map((entity, idx) => (
                <View key={idx} style={styles.entityItem}>
                  <Ionicons name="thumbs-down" size={14} color="#EF4444" />
                  <Text style={styles.entityName}>{entity.name}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Full Context */}
          <View style={styles.memorySection}>
            <Text style={styles.sectionTitle}>🎯 AI Context (injected into prompts)</Text>
            <View style={styles.contextBox}>
              <Text style={styles.contextText}>
                {memoryContext || 'No context built yet. Interact with the app to build memory.'}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.memorySection}>
            <Pressable
              onPress={async () => {
                Alert.alert(
                  'Clear Memory?',
                  'This will delete all learned preferences, likes, and dislikes.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear',
                      style: 'destructive',
                      onPress: async () => {
                        const memory = getAgentMemory();
                        await memory.clearAll();
                        loadMemoryData();
                      },
                    },
                  ]
                );
              }}
              style={styles.dangerButton}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
              <Text style={styles.dangerButtonText}>Clear All Memory</Text>
            </Pressable>

            <Pressable
              onPress={async () => {
                const memory = getAgentMemory();
                const context = memory.buildFullContext();
                const stats = memory.getStats();
                const rewardHistory = memory.getRewardHistory();
                await Share.share({
                  message: JSON.stringify({ stats, context, rewardHistory: rewardHistory.slice(0, 20) }, null, 2),
                });
              }}
              style={styles.exportButton}
            >
              <Ionicons name="share-outline" size={18} color="#3B82F6" />
              <Text style={styles.exportButtonText}>Export Memory</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* Prompt Inspector Tab */}
      {activeTab === 'prompts' && (
        <ScrollView style={styles.tabContent}>
          <View style={styles.memorySection}>
            <Text style={styles.sectionTitle}>📝 Recent Completions ({completionLogs.length})</Text>
            {completionLogs.length === 0 ? (
              <Text style={styles.emptyText}>No completions yet. Use the AI to see prompts here.</Text>
            ) : (
              completionLogs.slice().reverse().map((log, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => setSelectedCompletion(selectedCompletion?.timestamp === log.timestamp ? null : log)}
                  style={[
                    styles.completionCard,
                    selectedCompletion?.timestamp === log.timestamp && styles.completionCardSelected,
                  ]}
                >
                  <View style={styles.completionHeader}>
                    <Text style={styles.completionTime}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </Text>
                    <View style={styles.completionStats}>
                      <Text style={styles.completionStatText}>
                        {log.inferenceTimeMs?.toFixed(0)}ms
                      </Text>
                      {log.toolCalls && log.toolCalls.length > 0 && (
                        <View style={styles.toolBadge}>
                          <Ionicons name="construct" size={10} color="#8B5CF6" />
                          <Text style={styles.toolBadgeText}>{log.toolCalls.length}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.completionPreview} numberOfLines={2}>
                    {log.userMessage}
                  </Text>
                  
                  {selectedCompletion?.timestamp === log.timestamp && (
                    <View style={styles.completionDetails}>
                      <Text style={styles.detailLabel}>System Prompt:</Text>
                      <Text style={styles.detailText} numberOfLines={10}>
                        {log.systemPrompt}
                      </Text>
                      
                      <Text style={styles.detailLabel}>Response:</Text>
                      <Text style={styles.detailText} numberOfLines={10}>
                        {log.response}
                      </Text>
                      
                      {log.toolCalls && log.toolCalls.length > 0 && (
                        <>
                          <Text style={styles.detailLabel}>Tool Calls:</Text>
                          {log.toolCalls.map((tc, i) => (
                            <View key={i} style={styles.toolCallBox}>
                              <Text style={styles.toolCallName}>{tc.name}</Text>
                              <Text style={styles.toolCallArgs}>
                                {JSON.stringify(tc.arguments, null, 2)}
                              </Text>
                              {tc.result && (
                                <Text style={styles.toolCallResult}>
                                  → {JSON.stringify(tc.result).slice(0, 200)}...
                                </Text>
                              )}
                            </View>
                          ))}
                        </>
                      )}
                    </View>
                  )}
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* Cactus AI Test Tab */}
      {activeTab === 'cactus' && (
        <ScrollView style={styles.tabContent}>
          <View style={styles.cactusSection}>
            <View style={styles.cactusHeader}>
              <Text style={styles.cactusTitle}>🌵 Cactus On-Device AI</Text>
              <Pressable
                onPress={testCactusAI}
                disabled={cactusState.status === 'downloading' || cactusState.status === 'generating'}
                style={[
                  styles.testButton,
                  (cactusState.status === 'downloading' || cactusState.status === 'generating') && styles.testButtonDisabled,
                ]}
              >
                {cactusState.status === 'downloading' || cactusState.status === 'initializing' || cactusState.status === 'generating' ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.testButtonText}>Test AI</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.cactusStatus}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Status:</Text>
                <Text style={[
                  styles.statusValue,
                  cactusState.status === 'ready' && { color: '#22C55E' },
                  cactusState.status === 'error' && { color: '#EF4444' },
                ]}>
                  {cactusState.status.toUpperCase()}
                </Text>
              </View>

              {cactusState.status === 'downloading' && (
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBar, { width: `${cactusState.progress * 100}%` }]} />
                  <Text style={styles.progressText}>{Math.round(cactusState.progress * 100)}%</Text>
                </View>
              )}

              {cactusState.response && (
                <View style={styles.responseBox}>
                  <Text style={styles.responseLabel}>Response:</Text>
                  <Text style={styles.responseText}>{cactusState.response}</Text>
                </View>
              )}

              {cactusState.stats && (
                <View style={styles.statsRow}>
                  <Text style={styles.cactusStatText}>
                    ⚡ {cactusState.stats.tokensPerSecond?.toFixed(1)} tok/s
                  </Text>
                  <Text style={styles.cactusStatText}>
                    ⏱️ {cactusState.stats.totalTimeMs?.toFixed(0)}ms
                  </Text>
                </View>
              )}

              {cactusState.error && (
                <Text style={styles.errorText}>❌ {cactusState.error}</Text>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <>
          {/* Filters */}
          <View style={styles.filters}>
        {['all', 'error', 'warn', 'info'].map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f as any)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setAutoRefresh(!autoRefresh)}
          style={[styles.filterChip, autoRefresh && styles.filterChipActive]}
        >
          <Ionicons name="refresh" size={16} color={autoRefresh ? 'white' : '#6B7280'} />
        </Pressable>
      </View>

      {/* Logs */}
      <ScrollView style={styles.logsList}>
        {filteredLogs.reverse().map((log, idx) => (
          <View key={idx} style={styles.logItem}>
            <View style={styles.logHeader}>
              <View style={styles.logHeaderLeft}>
                <Text style={styles.logEmoji}>{getLevelEmoji(log.level)}</Text>
                <Text style={[styles.logLevel, { color: getLevelColor(log.level) }]}>
                  {log.level.toUpperCase()}
                </Text>
                <Text style={styles.logCategory}>{log.category}</Text>
              </View>
              <Text style={styles.logTime}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </Text>
            </View>
            <Text style={styles.logMessage}>{log.message}</Text>
            {log.data && (
              <View style={styles.logData}>
                <Text style={styles.logDataText}>
                  {typeof log.data === 'string'
                    ? log.data
                    : JSON.stringify(log.data, null, 2)}
                </Text>
              </View>
            )}
          </View>
        ))}
        {filteredLogs.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No logs to display</Text>
          </View>
        )}
      </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  // Tab Navigation
  tabNav: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#EFF6FF',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabButtonTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  // Memory Inspector
  memorySection: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  memoryStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  memoryStatItem: {
    alignItems: 'center',
  },
  memoryStatValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#22C55E',
  },
  memoryStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  contextBox: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contextText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#374151',
    lineHeight: 18,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    marginBottom: 8,
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  // Preference items
  preferenceItem: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  preferenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  preferenceCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  preferenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  preferenceBadgePositive: {
    backgroundColor: '#DCFCE7',
  },
  preferenceBadgeNegative: {
    backgroundColor: '#FEE2E2',
  },
  preferenceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  preferenceBadgeTextPositive: {
    color: '#166534',
  },
  preferenceBadgeTextNegative: {
    color: '#991B1B',
  },
  preferenceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 6,
  },
  preferenceBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  preferenceBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  // Entity items
  entityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  entityName: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
  },
  entityReason: {
    fontSize: 11,
    color: '#9CA3AF',
    maxWidth: '40%',
  },
  // Prompt Inspector
  completionCard: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  completionCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  completionTime: {
    fontSize: 11,
    color: '#6B7280',
  },
  completionStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completionStatText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  toolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  toolBadgeText: {
    fontSize: 10,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  completionPreview: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  completionDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#374151',
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 4,
    lineHeight: 16,
  },
  toolCallBox: {
    backgroundColor: '#F5F3FF',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  toolCallName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C3AED',
    marginBottom: 4,
  },
  toolCallArgs: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#4B5563',
  },
  toolCallResult: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#059669',
    marginTop: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#4299E1',
    borderColor: '#4299E1',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTextActive: {
    color: 'white',
  },
  logsList: {
    flex: 1,
  },
  logItem: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  logEmoji: {
    fontSize: 16,
  },
  logLevel: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  logCategory: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  logTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  logMessage: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  logData: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  logDataText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#4B5563',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  // Cactus AI Styles
  cactusSection: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cactusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cactusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  testButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  testButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  testButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  cactusStatus: {
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  progressContainer: {
    height: 24,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 12,
  },
  progressText: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  responseBox: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 4,
  },
  responseText: {
    fontSize: 14,
    color: '#15803D',
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  cactusStatText: {
    fontSize: 13,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
});

