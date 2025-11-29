import { useAuth } from '@clerk/clerk-expo';

interface AIInsightsCardProps {
  person: Person;
  cachedAnalysis?: FounderAnalysisResult | null;
  onAnalysisComplete?: (analysis: FounderAnalysisResult) => void;
}

type Stage = 'idle' | 'downloading' | 'initializing' | 'generating' | 'investigating' | 'complete' | 'error';

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
  const [isOffline, setIsOffline] = useState(false);
  
  // Use pre-warmed model status from AgentContext
  const { status: modelStatus, progress: modelProgress, isReady: modelReady, warmUp } = useModelStatus();
  const { getFullContextForLLM } = useAgent();
  const { getToken } = useAuth();
  
  const isGenerating = useRef(false); // <-- Lock for preventing race conditions
  
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const badgeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (stage === 'complete') {
      Animated.spring(badgeAnim, {
        toValue: 1,
        friction: 4,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }
  }, [stage]);

  useEffect(() => {
    if (stage === 'generating' || stage === 'investigating') {
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
    if (isGenerating.current) return; // <-- Prevent duplicate calls
    isGenerating.current = true;

    setStreamingText('');
    setError(null);

    try {
      // If model is already ready from pre-warming, skip to generating
      if (modelReady) {
        setStage('generating');
        logger.info('AIInsightsCard', 'Using pre-warmed model');
      } else if (modelStatus === 'downloading') {
        setStage('downloading');
        // Wait for model to be ready
        await warmUp();
        setStage('generating');
      } else if (modelStatus === 'initializing') {
        setStage('initializing');
        await warmUp();
        setStage('generating');
      } else {
        // Model not started, trigger warmup
        setStage('downloading');
        await warmUp();
        setStage('generating');
      }
      
      const agent = getFounderAgent();
      const token = await getToken();
      
      // Get full memory context for personalized analysis
      const memoryContext = getFullContextForLLM();
      const agentMemoryContext = getAgentMemory().buildFullContext();
      const fullUserContext = [memoryContext, agentMemoryContext].filter(Boolean).join('\n\n');
      
      const result = await agent.analyzeFounder(person, {
        userContext: fullUserContext, // Inject memory context for personalization
        token: token || undefined,
        onProgress: (progressStage) => {
          // Only update stage if not already generating (model was pre-warmed)
          if (progressStage === 'generating' || progressStage === 'investigating') {
            setStage(progressStage);
          }
        },
        onToken: (token) => {
          setStreamingText(prev => prev + token);
        },
      });

      setAnalysis(result);
      setStage('complete');
      onAnalysisComplete?.(result);
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      logger.info('AIInsightsCard', 'Analysis complete', {
        personId: person.id,
        tokensPerSecond: result.stats.tokensPerSecond,
        preWarmed: modelReady,
      });
    } catch (err: any) {
      logger.error('AIInsightsCard', 'Analysis failed', err);
      setError(err.message || 'Failed to generate analysis');
      setStage('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      isGenerating.current = false; // <-- Release lock
    }
  }, [person, onAnalysisComplete, modelReady, modelStatus, warmUp, getToken]);

  const askFollowUp = useCallback(async () => {
    if (!followUpQuestion.trim() || !analysis) return;

    setIsAskingFollowUp(true);
    setFollowUpResponse('');

    try {
      const agent = getFounderAgent();
      
      // Get full memory context for personalized follow-up
      const memoryContext = getFullContextForLLM();
      const agentMemoryContext = getAgentMemory().buildFullContext();
      const fullUserContext = [memoryContext, agentMemoryContext].filter(Boolean).join('\n\n');
      
      const result = await agent.askFollowUp(
        person,
        analysis.rawResponse,
        followUpQuestion,
        {
          userContext: fullUserContext, // Inject memory context
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
  }, [followUpQuestion, analysis, person, getFullContextForLLM]);

  useEffect(() => {
    if (!cachedAnalysis && stage === 'idle') {
      // Auto-generate if we haven't started yet
      if (!isGenerating.current) {
        const timer = setTimeout(generateAnalysis, 500);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const getStageText = () => {
    switch (stage) {
      case 'downloading': 
        return modelProgress > 0 
          ? `Downloading Neural Engine... ${modelProgress}%` 
          : 'Downloading Neural Engine...';
      case 'initializing': return 'Initializing Cortex...';
      case 'generating': return 'Analyzing Founder Data...';
      case 'investigating': return 'Investigating (using Specter API)...';
      default: return '';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="sparkles" size={18} color="#38BDF8" />
          <Text style={styles.title}>Specter AI</Text>
        </View>
        <Animated.View 
          style={[
            styles.badge,
            stage === 'complete' && {
              transform: [{ scale: badgeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }) }],
            },
          ]}
        >
          <View style={[styles.badgeDot, isOffline && styles.badgeDotOffline]} />
          <Text style={styles.badgeText}>
            {isOffline ? 'Offline Mode' : 'On-Device • Private'}
          </Text>
        </Animated.View>
      </View>

      {(stage === 'downloading' || stage === 'initializing' || stage === 'generating') && (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingHeader}>
            <ActivityIndicator size="small" color="#38BDF8" />
            <Text style={styles.loadingText}>{getStageText()}</Text>
          </View>
          
          {streamingText && (
            <Animated.View style={[styles.streamingBox, { opacity: pulseAnim }]}>
              <Text style={styles.streamingText}>{streamingText}</Text>
              <View style={styles.cursor} />
            </Animated.View>
          )}
        </View>
      )}

      {stage === 'error' && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <Pressable onPress={generateAnalysis} style={styles.retryButton}>
            <Ionicons name="refresh" size={16} color="#F8FAFC" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {stage === 'complete' && analysis && (
        <View style={styles.analysisContainer}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Executive Summary</Text>
            {analysis.summary.map((point, idx) => (
              <View key={idx} style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{point}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="trending-up" size={16} color="#22C55E" />
              <Text style={[styles.sectionTitle, { color: '#22C55E' }]}>Key Signals</Text>
            </View>
            {analysis.strengths.map((point, idx) => (
              <View key={idx} style={styles.bulletItem}>
                <Text style={[styles.bullet, { color: '#22C55E' }]}>+</Text>
                <Text style={styles.bulletText}>{point}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="alert-circle-outline" size={16} color="#F59E0B" />
              <Text style={[styles.sectionTitle, { color: '#F59E0B' }]}>Risk Factors</Text>
            </View>
            {analysis.risks.map((point, idx) => (
              <View key={idx} style={styles.bulletItem}>
                <Text style={[styles.bullet, { color: '#F59E0B' }]}>!</Text>
                <Text style={styles.bulletText}>{point}</Text>
              </View>
            ))}
          </View>

          <View style={styles.statsRow}>
            <Text style={styles.statsText}>
              ⚡ {analysis.stats.tokensPerSecond.toFixed(1)} tok/s
            </Text>
            <Text style={styles.statsText}>
              ⏱️ {(analysis.stats.totalTimeMs / 1000).toFixed(1)}s
            </Text>
          </View>

          {followUpResponse && (
            <View style={styles.followUpResponse}>
              <Text style={styles.followUpResponseText}>{followUpResponse}</Text>
            </View>
          )}

          <View style={styles.askContainer}>
            <TextInput
              style={styles.askInput}
              placeholder="Ask Specter AI..."
              placeholderTextColor="#64748B"
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
                <ActivityIndicator size="small" color="#0F172A" />
              ) : (
                <Ionicons name="arrow-up" size={20} color="#0F172A" />
              )}
            </Pressable>
          </View>

          <Pressable onPress={generateAnalysis} style={styles.regenerateButton}>
            <Ionicons name="refresh" size={14} color="#64748B" />
            <Text style={styles.regenerateText}>Regenerate Analysis</Text>
          </Pressable>
        </View>
      )}

      {stage === 'idle' && (
        <View>
          {/* Show model pre-warming status */}
          {modelStatus === 'downloading' && (
            <View style={styles.preWarmStatus}>
              <ActivityIndicator size="small" color="#38BDF8" />
              <Text style={styles.preWarmText}>
                Pre-loading AI... {modelProgress > 0 ? `${modelProgress}%` : ''}
              </Text>
            </View>
          )}
          {modelStatus === 'initializing' && (
            <View style={styles.preWarmStatus}>
              <ActivityIndicator size="small" color="#38BDF8" />
              <Text style={styles.preWarmText}>Initializing AI Engine...</Text>
            </View>
          )}
          {modelStatus === 'ready' && (
            <View style={styles.preWarmStatus}>
              <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
              <Text style={[styles.preWarmText, { color: '#22C55E' }]}>AI Ready</Text>
            </View>
          )}
          <Pressable onPress={generateAnalysis} style={styles.generateButton}>
            <Ionicons name="sparkles" size={18} color="#0F172A" />
            <Text style={styles.generateButtonText}>
              {modelReady ? 'Generate AI Analysis' : 'Generate AI Analysis'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 20,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  badgeDotOffline: {
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
  },
  badgeText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
  },
  loadingContainer: {
    gap: 16,
  },
  loadingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  streamingBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#38BDF8',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  streamingText: {
    fontSize: 14,
    color: '#E2E8F0',
    lineHeight: 22,
  },
  cursor: {
    width: 2,
    height: 18,
    backgroundColor: '#38BDF8',
    marginLeft: 4,
  },
  errorContainer: {
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorText: {
    fontSize: 14,
    color: '#F87171',
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: 14,
  },
  analysisContainer: {
    gap: 20,
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bulletItem: {
    flexDirection: 'row',
    gap: 10,
    paddingLeft: 4,
  },
  bullet: {
    fontSize: 14,
    color: '#64748B',
    width: 12,
    fontWeight: '700',
  },
  bulletText: {
    fontSize: 15,
    color: '#CBD5E1',
    flex: 1,
    lineHeight: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  statsText: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'monospace',
  },
  followUpResponse: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#38BDF8',
  },
  followUpResponseText: {
    fontSize: 14,
    color: '#E0F2FE',
    lineHeight: 22,
  },
  askContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  askInput: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  askButton: {
    backgroundColor: '#38BDF8',
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askButtonDisabled: {
    backgroundColor: '#334155',
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  regenerateText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#38BDF8',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  generateButtonText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 16,
  },
  preWarmStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  preWarmText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
