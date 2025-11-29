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
import { getCactusClient, getCompletionLogs, type CompletionLog } from '../ai/cactusClient.native';
import { getAgentMemory, UserPreference, InvestmentPersona, PersonaMemoryState } from '../ai/agentMemory';
import { getFounderAgent } from '../ai/founderAgent';
import { TextInput } from 'react-native';
import { fetchCompanySavedSearchResults, fetchSavedSearches } from '../api/specter';

type DiagnosticsTab = 'logs' | 'memory' | 'prompts' | 'cactus' | 'agent';

// Persona colors for visual distinction
const PERSONA_COLORS = ['#8B5CF6', '#3B82F6', '#22C55E', '#F59E0B', '#EC4899', '#14B8A6', '#F97316'];

export default function DiagnosticsScreen() {
  const navigation = useNavigation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { isSignedIn, userId, getToken } = useAuth();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<DiagnosticsTab>('memory');

  // Agent Debugger State
  // NOTE: company_id must be a real Specter company ID (UUID format, not domain)
  // Get a real company_id by:
  // 1. Querying Postgres: SELECT company_id FROM companies LIMIT 1;
  // 2. Or using search_entity tool: search for "OpenAI" or "Stripe" to get their company_id
  const [debugPersonJson, setDebugPersonJson] = useState(JSON.stringify({
    "id": "per_test_debug",
    "first_name": "Alex",
    "last_name": "Martinez",
    "full_name": "Alex Martinez",
    "seniority": "Founder",
    "people_highlights": ["ex_openai", "y_combinator_alum"],
    "experience": [
      {
        "company_name": "Stealth AI",
        "title": "Founder & CEO",
        "is_current": true,
        "start_date": "2024-01",
        "company_id": "REPLACE_WITH_REAL_COMPANY_ID_FROM_POSTGRES"
      },
      {
        "company_name": "OpenAI",
        "title": "Research Engineer",
        "is_current": false,
        "start_date": "2022-01",
        "end_date": "2023-12",
        "company_id": "REPLACE_WITH_REAL_COMPANY_ID_FROM_POSTGRES"
      }
    ]
  }, null, 2));
  const [debugResult, setDebugResult] = useState<any>(null);
  const [isDebugRunning, setIsDebugRunning] = useState(false);
  const [isFetchingCompanyId, setIsFetchingCompanyId] = useState(false);

  // Fetch a real company_id from Specter API
  const fetchRealCompanyId = async () => {
    setIsFetchingCompanyId(true);
    try {
      // Get company saved searches
      const searches = await fetchSavedSearches();
      const companySearch = searches.find(s => s.product_type === 'company' && s.full_count > 0);
      
      if (!companySearch) {
        Alert.alert('No Company Searches', 'No company saved searches found. Please create one in the app first.');
        return;
      }

      // Fetch first company from the search
      const results = await fetchCompanySavedSearchResults(undefined, companySearch.id, { limit: 1 });
      
      if (results.items.length === 0) {
        Alert.alert('No Companies', 'No companies found in saved searches.');
        return;
      }

      const company = results.items[0];
      const companyId = company.id || company.company_id;
      const companyName = company.organization_name || company.name || 'Unknown';

      if (!companyId) {
        Alert.alert('No Company ID', 'Company found but no ID available.');
        return;
      }

      // Update JSON with real company_id
      try {
        const personData = JSON.parse(debugPersonJson);
        // Replace all placeholder company_ids with the real one
        if (personData.experience) {
          personData.experience.forEach((exp: any) => {
            if (exp.company_id === 'REPLACE_WITH_REAL_COMPANY_ID_FROM_POSTGRES') {
              exp.company_id = companyId;
              // Also update company_name to match
              if (exp.company_name === 'OpenAI' || exp.company_name === 'Stealth AI') {
                exp.company_name = companyName;
              }
            }
          });
        }
        setDebugPersonJson(JSON.stringify(personData, null, 2));
        Alert.alert('Success', `Updated with real company_id:\n${companyId}\n(${companyName})`);
      } catch (e) {
        Alert.alert('Error', 'Failed to parse JSON. Please check the format.');
      }
    } catch (error: any) {
      Alert.alert('Error', `Failed to fetch company: ${error.message}`);
    } finally {
      setIsFetchingCompanyId(false);
    }
  };

  const runDebugAnalysis = async () => {
    if (!debugPersonJson.trim()) return;
    setIsDebugRunning(true);
    setDebugResult(null);
    
    try {
      const person = JSON.parse(debugPersonJson);
      const agent = getFounderAgent();
      const token = await getToken();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df6e2d2e-429a-4930-becf-dda1fd5d16a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DiagnosticsScreen.tsx:72',message:'Debugger starting analysis',data:{hasToken:!!token,tokenLength:token?.length||0,personId:person.id,companyIds:person.experience?.filter((e:any)=>e.company_id).map((e:any)=>e.company_id)||[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      
      // Get full memory context
      const memory = getAgentMemory();
      const userContext = memory.buildFullContext();
      
      const result = await agent.analyzeFounder(person, {
        token: token || undefined,
        userContext,
        onProgress: (stage) => {
           console.log('[Debugger] Stage:', stage);
        }
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df6e2d2e-429a-4930-becf-dda1fd5d16a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DiagnosticsScreen.tsx:86',message:'Debugger analysis complete',data:{hasToolTrace:!!result.toolTrace,toolTraceCount:result.toolTrace?.length||0,toolTrace:result.toolTrace},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      
      setDebugResult(result);
    } catch (e: any) {
      setDebugResult({ error: e.message });
    } finally {
      setIsDebugRunning(false);
    }
  };

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
  
  // Persona State - now controls which persona's data we're viewing
  const [personas, setPersonas] = useState<InvestmentPersona[]>([]);
  const [activePersona, setActivePersona] = useState<InvestmentPersona | null>(null);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('global'); // 'global' or persona ID
  const [selectedPersonaState, setSelectedPersonaState] = useState<PersonaMemoryState | null>(null);

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

  // Load memory data for the selected persona
  const loadMemoryData = async () => {
    try {
      const memory = getAgentMemory();
      await memory.load();
      
      // Get personas
      const allPersonas = memory.getPersonas();
      setPersonas(allPersonas);
      setActivePersona(memory.getActivePersona());
      
      // Get the selected persona's state (IMPORTANT: this should return isolated memory)
      const personaState = memory.getPersonaState(selectedPersonaId);
      setSelectedPersonaState(personaState);
      
      // Debug: log what we got
      console.log('=== DIAGNOSTICS MEMORY DEBUG ===');
      console.log('Selected Persona ID:', selectedPersonaId);
      console.log('Persona State personaId:', personaState.personaId);
      console.log('Persona State likes:', personaState.likedEntities.length);
      console.log('Persona State dislikes:', personaState.dislikedEntities.length);
      console.log('Global memory likes:', memory.getPersonaState('global').likedEntities.length);
      
      // Debug: Check all persona memory states
      console.log('--- ALL PERSONA MEMORY STATES ---');
      for (const p of allPersonas) {
        const pState = memory.getPersonaState(p.id);
        console.log(`Persona "${p.name}" (${p.id}): likes=${pState.likedEntities.length}, dislikes=${pState.dislikedEntities.length}`);
      }
      console.log('=================================');
      
      // Update stats based on selected persona
      const stats = selectedPersonaId === (memory.getActivePersona()?.id || 'global')
        ? memory.getStats()
        : memory.getPersonaStats(selectedPersonaId);
      
      setMemoryStats({
        totalInteractions: stats.totalInteractions,
        totalConversations: 0,
        likedCount: stats.likedCount,
        dislikedCount: stats.dislikedCount,
        preferencesLearned: stats.preferencesLearned,
        toolCallsThisSession: 0,
      });
      
      // Get liked/disliked entities from selected persona
      setLikedEntities(personaState.likedEntities);
      setDislikedEntities(personaState.dislikedEntities);
      
      // Get learned preferences from selected persona
      setPreferences(personaState.learnedPreferences);
      
      // Get full context (always uses active persona)
      const context = memory.buildFullContext();
      setMemoryContext(context);
      
      logger.info('Diagnostics', 'Memory data loaded for persona', { 
        personaId: selectedPersonaId,
        personaStateId: personaState.personaId,
        likes: personaState.likedEntities.length,
        dislikes: personaState.dislikedEntities.length,
      });
    } catch (error) {
      logger.error('Diagnostics', 'Failed to load memory', error);
    }
  };

  // Handle persona tab selection
  const handlePersonaTabSelect = (personaId: string) => {
    console.log('=== TAB CLICKED ===');
    console.log('Switching to persona:', personaId);
    console.log('Previous selectedPersonaId:', selectedPersonaId);
    setSelectedPersonaId(personaId);
  };

  // Reload when selected persona changes
  useEffect(() => {
    loadMemoryData();
  }, [selectedPersonaId]);

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

      {/* PERSONA TABS - TOP LEVEL (each persona has isolated memory) */}
      <View style={styles.personaNavContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.personaNavContent}
        >
          {/* Global (no persona) tab */}
          <Pressable
            onPress={() => handlePersonaTabSelect('global')}
            style={[
              styles.personaNavTab,
              selectedPersonaId === 'global' && styles.personaNavTabActive,
              selectedPersonaId === 'global' && { borderBottomColor: '#64748B' },
            ]}
          >
            <Ionicons 
              name="globe-outline" 
              size={14} 
              color={selectedPersonaId === 'global' ? '#64748B' : '#94A3B8'} 
            />
            <Text style={[
              styles.personaNavText,
              selectedPersonaId === 'global' && styles.personaNavTextActive,
            ]}>
              Global
            </Text>
            {activePersona === null && (
              <View style={[styles.activeIndicatorDot, { backgroundColor: '#22C55E' }]} />
            )}
          </Pressable>

          {/* Persona tabs */}
          {personas.map((persona, index) => {
            const color = PERSONA_COLORS[index % PERSONA_COLORS.length];
            const isSelected = selectedPersonaId === persona.id;
            const isActive = activePersona?.id === persona.id;
            
            return (
              <Pressable
                key={persona.id}
                onPress={() => handlePersonaTabSelect(persona.id)}
                style={[
                  styles.personaNavTab,
                  isSelected && styles.personaNavTabActive,
                  isSelected && { borderBottomColor: color },
                ]}
              >
                <View style={[styles.personaNavDot, { backgroundColor: color }]} />
                <Text 
                  style={[
                    styles.personaNavText,
                    isSelected && styles.personaNavTextActive,
                    isSelected && { color },
                  ]} 
                  numberOfLines={1}
                >
                  {persona.name}
                </Text>
                {isActive && (
                  <View style={[styles.activeIndicatorDot, { backgroundColor: '#22C55E' }]} />
                )}
              </Pressable>
            );
          })}

          {/* Add persona button */}
          <Pressable
            onPress={() => {
              const memory = getAgentMemory();
              if (personas.length === 0) {
                memory.initializeDefaultPersonas();
                loadMemoryData();
              } else {
                navigation.navigate("Persona" as never);
              }
            }}
            style={styles.addPersonaButton}
          >
            <Ionicons name="add-circle-outline" size={18} color="#3B82F6" />
          </Pressable>
        </ScrollView>
        
        {/* Selected persona indicator */}
        <View style={styles.personaInfoBar}>
          <Text style={styles.personaInfoText}>
            {selectedPersonaId === 'global' 
              ? 'Viewing: Global Memory (no persona)'
              : `Viewing: ${personas.find(p => p.id === selectedPersonaId)?.name || 'Unknown'}`
            }
          </Text>
          {selectedPersonaId !== (activePersona?.id || 'global') && (
            <Pressable
              onPress={() => {
                const memory = getAgentMemory();
                memory.setActivePersona(selectedPersonaId === 'global' ? null : selectedPersonaId);
                loadMemoryData();
              }}
              style={styles.setActiveButton}
            >
              <Text style={styles.setActiveButtonText}>Set as Active</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* CONTENT TABS - SECOND LEVEL (Memory | Prompts | AI | Logs) */}
      <View style={styles.tabNav}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabNavContent}
        >
          {[
            { id: 'memory' as DiagnosticsTab, label: 'Memory', icon: 'bulb-outline' as const, color: '#8B5CF6' },
            { id: 'prompts' as DiagnosticsTab, label: 'Prompts', icon: 'chatbubbles-outline' as const, color: '#3B82F6' },
            { id: 'cactus' as DiagnosticsTab, label: 'AI', icon: 'flash-outline' as const, color: '#22C55E' },
            { id: 'agent' as DiagnosticsTab, label: 'Debugger', icon: 'bug-outline' as const, color: '#F97316' },
            { id: 'logs' as DiagnosticsTab, label: 'Logs', icon: 'list-outline' as const, color: '#F59E0B' },
          ].map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[
                styles.tabButton, 
                activeTab === tab.id && styles.tabButtonActive,
                activeTab === tab.id && { borderBottomColor: tab.color },
              ]}
            >
              <Ionicons 
                name={tab.icon} 
                size={16} 
                color={activeTab === tab.id ? tab.color : '#64748B'} 
              />
              <Text style={[
                styles.tabButtonText, 
                activeTab === tab.id && styles.tabButtonTextActive,
                activeTab === tab.id && { color: tab.color },
              ]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Memory Inspector Tab */}
      {activeTab === 'memory' && (
        <ScrollView style={styles.tabContent}>
          {/* Memory Stats for Selected Persona */}
          <View style={styles.memorySection}>
            <Text style={styles.sectionTitle}>
              📊 Memory Stats {selectedPersonaId !== 'global' && `(${personas.find(p => p.id === selectedPersonaId)?.name})`}
            </Text>
            <View style={styles.memoryStatsGrid}>
              <View style={styles.memoryStatItem}>
                <Text style={styles.memoryStatValue}>{selectedPersonaState?.likedEntities.length || 0}</Text>
                <Text style={styles.memoryStatLabel}>Likes</Text>
              </View>
              <View style={styles.memoryStatItem}>
                <Text style={[styles.memoryStatValue, { color: '#EF4444' }]}>{selectedPersonaState?.dislikedEntities.length || 0}</Text>
                <Text style={styles.memoryStatLabel}>Dislikes</Text>
              </View>
              <View style={styles.memoryStatItem}>
                <Text style={[styles.memoryStatValue, { color: '#8B5CF6' }]}>{selectedPersonaState?.savedEntities?.length || 0}</Text>
                <Text style={styles.memoryStatLabel}>Saved</Text>
              </View>
              <View style={styles.memoryStatItem}>
                <Text style={[styles.memoryStatValue, { color: '#F59E0B' }]}>{(selectedPersonaState?.totalReward || 0).toFixed(1)}</Text>
                <Text style={styles.memoryStatLabel}>Reward</Text>
              </View>
            </View>
          </View>

          {/* Show persona criteria if viewing a specific persona */}
          {selectedPersonaId !== 'global' && (
            <View style={styles.memorySection}>
              <Text style={styles.sectionTitle}>🎯 Persona Criteria</Text>
              {(() => {
                const persona = personas.find(p => p.id === selectedPersonaId);
                if (!persona) return <Text style={styles.emptyText}>Persona not found</Text>;
                
                return (
                  <View style={styles.personaCard}>
                    <Text style={styles.personaDescription}>{persona.description}</Text>
                    
                    <View style={styles.personaCriteria}>
                      {persona.criteria.preferredStages.length > 0 && (
                        <View style={styles.criteriaRow}>
                          <Text style={styles.criteriaLabel}>Stages:</Text>
                          <View style={styles.criteriaChips}>
                            {persona.criteria.preferredStages.map((stage, idx) => (
                              <View key={idx} style={styles.criteriaChip}>
                                <Text style={styles.criteriaChipText}>{stage}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                      {persona.criteria.preferredSignals.length > 0 && (
                        <View style={styles.criteriaRow}>
                          <Text style={styles.criteriaLabel}>Signals:</Text>
                          <View style={styles.criteriaChips}>
                            {persona.criteria.preferredSignals.map((signal, idx) => (
                              <View key={idx} style={[styles.criteriaChip, { backgroundColor: '#FEF3C7' }]}>
                                <Text style={[styles.criteriaChipText, { color: '#B45309' }]}>{signal}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                      {persona.criteria.industryFocus.length > 0 && (
                        <View style={styles.criteriaRow}>
                          <Text style={styles.criteriaLabel}>Industries:</Text>
                          <View style={styles.criteriaChips}>
                            {persona.criteria.industryFocus.map((industry, idx) => (
                              <View key={idx} style={[styles.criteriaChip, { backgroundColor: '#DBEAFE' }]}>
                                <Text style={[styles.criteriaChipText, { color: '#1D4ED8' }]}>{industry}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                      {persona.criteria.regionFocus.length > 0 && (
                        <View style={styles.criteriaRow}>
                          <Text style={styles.criteriaLabel}>Regions:</Text>
                          <View style={styles.criteriaChips}>
                            {persona.criteria.regionFocus.map((region, idx) => (
                              <View key={idx} style={[styles.criteriaChip, { backgroundColor: '#F3E8FF' }]}>
                                <Text style={[styles.criteriaChipText, { color: '#7C3AED' }]}>{region}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                      {persona.criteria.customCriteria && (
                        <View style={styles.criteriaRow}>
                          <Text style={styles.criteriaLabel}>Custom:</Text>
                          <Text style={styles.customCriteriaText}>{persona.criteria.customCriteria}</Text>
                        </View>
                      )}
                    </View>

                    {/* Bulk Action Settings */}
                    <View style={styles.bulkSettingsContainer}>
                      <Text style={styles.bulkSettingsTitle}>Bulk Action Settings</Text>
                      <View style={styles.bulkSettingsGrid}>
                        <View style={styles.bulkSettingItem}>
                          <Text style={styles.bulkSettingValue}>{persona.bulkActionSettings.autoSourceLimit}</Text>
                          <Text style={styles.bulkSettingLabel}>Max Signals</Text>
                        </View>
                        <View style={styles.bulkSettingItem}>
                          <Text style={styles.bulkSettingValue}>{(persona.bulkActionSettings.confidenceThreshold * 100).toFixed(0)}%</Text>
                          <Text style={styles.bulkSettingLabel}>Threshold</Text>
                        </View>
                        <View style={styles.bulkSettingItem}>
                          <Text style={styles.bulkSettingValue}>{persona.bulkActionSettings.defaultAction === 'like' ? '👍' : '📋'}</Text>
                          <Text style={styles.bulkSettingLabel}>{persona.bulkActionSettings.defaultAction === 'like' ? 'Auto-Like' : 'Stage'}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })()}
            </View>
          )}

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
                  <Ionicons name="star-outline" size={14} color="#000" />
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
                  <Ionicons name="close-circle-outline" size={14} color="#000" />
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.completionTime}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </Text>
                      {/* 🎭 PERSONA BADGE - Shows which persona was active */}
                      <View style={[
                        styles.personaBadgeSmall,
                        { backgroundColor: log.activePersona === 'None (Global)' ? '#6B7280' : '#8B5CF6' }
                      ]}>
                        <Text style={styles.personaBadgeSmallText}>
                          {log.activePersona || 'Global'}
                        </Text>
                      </View>
                    </View>
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
                      {/* Context Indicators */}
                      {log.contextIndicators && (
                        <View style={styles.contextIndicators}>
                          <Text style={styles.detailLabel}>🎭 Persona Context:</Text>
                          <View style={styles.indicatorRow}>
                            <View style={[styles.indicator, log.contextIndicators.hasPreferences && styles.indicatorActive]}>
                              <Text style={styles.indicatorText}>Preferences</Text>
                            </View>
                            <View style={[styles.indicator, log.contextIndicators.hasLikes && styles.indicatorActive]}>
                              <Text style={styles.indicatorText}>Likes</Text>
                            </View>
                            <View style={[styles.indicator, log.contextIndicators.hasDislikes && styles.indicatorActive]}>
                              <Text style={styles.indicatorText}>Dislikes</Text>
                            </View>
                          </View>
                          <Text style={styles.contextLength}>
                            System prompt: {log.contextIndicators.systemPromptLength} chars
                          </Text>
                        </View>
                      )}
                      
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

      {/* Agent Debugger Tab */}
      {activeTab === 'agent' && (
        <ScrollView style={styles.tabContent}>
          <View style={styles.memorySection}>
            <Text style={styles.sectionTitle}>🕵️ Agent Debugger</Text>
            <Text style={styles.debugLabel}>Test Person JSON:</Text>
            <TextInput
              style={styles.debugInput}
              multiline
              value={debugPersonJson}
              onChangeText={setDebugPersonJson}
              placeholder='{"id": "..."}'
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <View style={styles.debugButtonRow}>
              <Pressable
                onPress={fetchRealCompanyId}
                disabled={isFetchingCompanyId}
                style={[styles.debugButtonSecondary, isFetchingCompanyId && styles.debugButtonDisabled]}
              >
                {isFetchingCompanyId ? (
                  <ActivityIndicator color="#3B82F6" size="small" />
                ) : (
                  <Text style={styles.debugButtonSecondaryText}>🔍 Fetch Real Company ID</Text>
                )}
              </Pressable>
              
              <Pressable
                onPress={runDebugAnalysis}
                disabled={isDebugRunning}
                style={[styles.debugButton, isDebugRunning && styles.debugButtonDisabled]}
              >
                {isDebugRunning ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.debugButtonText}>Run Agentic Loop</Text>
                )}
              </Pressable>
            </View>
            
            {debugResult && (
              <View style={styles.debugResultBox}>
                <Text style={styles.debugResultTitle}>Result:</Text>
                
                {debugResult.toolTrace && debugResult.toolTrace.length > 0 && (
                  <View style={styles.toolTraceBox}>
                    <Text style={styles.toolTraceTitle}>🛠️ Tool Execution:</Text>
                    {debugResult.toolTrace.map((trace: any, idx: number) => (
                      <View key={idx} style={styles.toolTraceItem}>
                        <Text style={styles.toolTraceName}>{trace.tool}</Text>
                        <Text style={styles.toolTraceArgs}>{JSON.stringify(trace.args)}</Text>
                        <Text style={styles.toolTraceResult}>→ {trace.result.slice(0, 100)}...</Text>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={styles.debugResultText}>
                  {JSON.stringify(debugResult, null, 2)}
                </Text>
              </View>
            )}
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
  // Persona Navigation - TOP LEVEL
  personaNavContainer: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  personaNavContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    height: 44,
  },
  personaNavTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    gap: 6,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  personaNavTabActive: {
    borderBottomWidth: 3,
  },
  personaNavDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  personaNavText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
    maxWidth: 100,
  },
  personaNavTextActive: {
    fontWeight: '600',
    color: '#1E293B',
  },
  activeIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 4,
  },
  addPersonaButton: {
    paddingHorizontal: 12,
    height: 44,
    justifyContent: 'center',
  },
  personaInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  personaInfoText: {
    fontSize: 12,
    color: '#64748B',
  },
  setActiveButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  setActiveButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
  },
  // Tab Navigation - Feed-style (CONTENT TABS)
  tabNav: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    height: 48,
  },
  tabNavContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
    height: 48,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 48,
    gap: 6,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomWidth: 3,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  tabButtonTextActive: {
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
  // Persona Styles
  personaCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  personaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  personaActiveIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
  },
  personaName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#166534',
  },
  personaDescription: {
    fontSize: 13,
    color: '#15803D',
    lineHeight: 18,
    marginBottom: 12,
  },
  personaCriteria: {
    gap: 8,
  },
  criteriaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  criteriaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
    width: 70,
    marginTop: 4,
  },
  criteriaChips: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  criteriaChip: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  criteriaChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
  },
  customCriteriaText: {
    flex: 1,
    fontSize: 12,
    color: '#15803D',
    fontStyle: 'italic',
  },
  bulkSettingsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#BBF7D0',
  },
  bulkSettingsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 8,
  },
  bulkSettingsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  bulkSettingItem: {
    alignItems: 'center',
  },
  bulkSettingValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#166534',
  },
  bulkSettingLabel: {
    fontSize: 10,
    color: '#15803D',
    marginTop: 2,
  },
  noPersonaContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  noPersonaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  noPersonaSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  initPersonasButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    marginTop: 8,
  },
  initPersonasButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  // Persona Tabs - Feed-style
  personaTabsContainer: {
    marginTop: 16,
    marginHorizontal: -16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  personaTabsContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    height: 44,
  },
  personaTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 44,
    gap: 6,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  personaTabActive: {
    borderBottomWidth: 3,
  },
  personaTabIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  personaTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  personaTabTextActive: {
    fontWeight: '600',
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
  // Persona badge for completion logs
  personaBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  personaBadgeSmallText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Context indicators for persona-aware completions
  contextIndicators: {
    backgroundColor: '#F5F3FF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  indicatorRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 6,
  },
  indicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  indicatorActive: {
    backgroundColor: '#22C55E',
  },
  indicatorText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  contextLength: {
    fontSize: 10,
    color: '#6B7280',
    fontStyle: 'italic',
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
  // Debugger
  debugLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  debugInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    fontFamily: 'monospace',
    height: 150,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  debugButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  debugButton: {
    flex: 1,
    backgroundColor: '#F97316',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  debugButtonSecondary: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  debugButtonDisabled: {
    opacity: 0.6,
  },
  debugButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  debugButtonSecondaryText: {
    color: '#3B82F6',
    fontWeight: '600',
    fontSize: 14,
  },
  debugResultBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  debugResultTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9A3412',
    marginBottom: 4,
  },
  debugResultText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#9A3412',
  },
  toolTraceBox: {
    backgroundColor: '#FFF',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  toolTraceTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
    marginBottom: 6,
  },
  toolTraceItem: {
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#FED7AA',
  },
  toolTraceName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#C2410C',
  },
  toolTraceArgs: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#9A3412',
  },
  toolTraceResult: {
    fontSize: 10,
    color: '#EA580C',
    marginTop: 2,
  },
});

