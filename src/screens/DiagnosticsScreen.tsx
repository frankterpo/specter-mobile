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
import { logger, LogEntry } from '../utils/logger';
import { useAuth } from '@clerk/clerk-expo';
import { getCactusClient } from '../ai/cactusClient';

export default function DiagnosticsScreen() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { isSignedIn, userId } = useAuth();

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
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  useEffect(() => {
    setLogs(logger.getLogs());
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
        <Text style={styles.title}>🔬 Diagnostics</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={handleExport} style={styles.iconButton}>
            <Ionicons name="share-outline" size={24} color="#1a365d" />
          </Pressable>
          <Pressable onPress={handleClear} style={styles.iconButton}>
            <Ionicons name="trash-outline" size={24} color="#EF4444" />
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

      {/* Cactus AI Test Section */}
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
              <Text style={styles.statItem}>
                ⚡ {cactusState.stats.tokensPerSecond?.toFixed(1)} tok/s
              </Text>
              <Text style={styles.statItem}>
                ⏱️ {cactusState.stats.totalTimeMs?.toFixed(0)}ms
              </Text>
            </View>
          )}

          {cactusState.error && (
            <Text style={styles.errorText}>❌ {cactusState.error}</Text>
          )}
        </View>
      </View>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 8,
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
  statItem: {
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

