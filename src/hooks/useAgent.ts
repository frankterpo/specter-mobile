// useAgent Hook - React integration for AI Agent
// Provides easy access to agent functionality in React components

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  dispatch, 
  generateRequestId, 
  getAgentStatus, 
  getQueueLength,
  TriggerType,
  AgentRequest,
  AgentResponse,
  PersonHighlights,
  ScoreResult,
  BulkActionResult,
  DeepDiveResult
} from '../ai/agentOrchestrator';
import { usePersona } from '../context/PersonaContext';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface UseAgentReturn {
  // State
  isProcessing: boolean;
  lastResponse: AgentResponse | null;
  error: string | null;
  queueLength: number;
  
  // UC-1: Score Person
  scorePerson: (person: PersonHighlights) => Promise<ScoreResult | null>;
  
  // UC-2: Suggest Datapoints
  suggestDatapoints: (person: PersonHighlights, action: 'like' | 'dislike') => Promise<{
    suggested: { datapoint: string; weight: number; reason: string }[];
  } | null>;
  
  // UC-3: Deep Dive
  deepDive: (person: PersonHighlights) => Promise<DeepDiveResult | null>;
  
  // UC-4: Bulk Actions
  bulkLike: (entityIds: string[], datapoints: string[], note?: string) => Promise<BulkActionResult | null>;
  bulkDislike: (entityIds: string[], datapoints: string[], note?: string) => Promise<BulkActionResult | null>;
  
  // UC-5: Create Shortlist
  createShortlist: (name: string, entityIds: string[]) => Promise<{ shortlistId: number; name: string; entityCount: number } | null>;
  
  // UC-6: Auto Score
  autoScore: (persons: PersonHighlights[]) => Promise<{
    scores: { personId: string; name: string; score: number; recommendation: string }[];
    summary: { total: number; strongPass: number; softPass: number; borderline: number; pass: number };
  } | null>;
  
  // UC-7: Sort Feed
  sortFeed: (persons: PersonHighlights[]) => Promise<{
    sortedIds: string[];
    scores: any[];
    summary: any;
  } | null>;
  
  // UC-8: Check Alerts
  checkAlerts: (persons: PersonHighlights[], threshold?: number) => Promise<{
    alerts: { person: PersonHighlights; score: number; recommendation: string }[];
    count: number;
  } | null>;
  
  // UC-9: Session Summary
  getSessionSummary: (sessionData: {
    viewed: number;
    liked: string[];
    disliked: string[];
    skipped: number;
    startTime: number;
  }) => Promise<any>;
  
  // UC-11: Natural Search
  naturalSearch: (query: string) => Promise<{
    query: string;
    filters: any;
    results: any[];
    count: number;
  } | null>;
  
  // UC-12: Auto Process
  autoProcess: (persons: PersonHighlights[], likeThreshold?: number, dislikeThreshold?: number) => Promise<{
    total: number;
    autoLiked: number;
    autoDisliked: number;
    needsReview: number;
    autoLikedIds: string[];
    autoDislikedIds: string[];
    reviewQueue: any[];
  } | null>;
  
  // UC-13: Learn Correction
  learnCorrection: (
    person: PersonHighlights,
    aiRecommendation: string,
    userAction: 'like' | 'dislike',
    datapoints: string[]
  ) => Promise<{
    userAgreed: boolean;
    learningInsight: string;
  } | null>;
  
  // Utilities
  clearError: () => void;
}

// ═══════════════════════════════════════════════════════════════════
// HOOK IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export function useAgent(): UseAgentReturn {
  const { activePersona, getLearnedWeights, submitFeedback } = usePersona();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState<AgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queueLength, setQueueLength] = useState(0);
  
  // Track mounted state to prevent state updates after unmount
  const isMounted = useRef(true);
  
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Helper to dispatch requests
  const dispatchRequest = useCallback(async (
    trigger: TriggerType,
    payload: any,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<AgentResponse | null> => {
    if (!activePersona) {
      setError('No active persona selected');
      return null;
    }
    
    setIsProcessing(true);
    setError(null);
    
    const request: AgentRequest = {
      id: generateRequestId(),
      trigger,
      payload,
      personaId: activePersona.id,
      timestamp: Date.now(),
      priority
    };
    
    try {
      const response = await dispatch(request);
      
      if (isMounted.current) {
        setLastResponse(response);
        setQueueLength(getQueueLength());
        
        if (!response.success && response.error !== 'QUEUED') {
          setError(response.error || 'Unknown error');
        }
      }
      
      return response;
    } catch (err: any) {
      if (isMounted.current) {
        setError(err.message);
      }
      return null;
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
      }
    }
  }, [activePersona]);
  
  // UC-1: Score Person
  const scorePerson = useCallback(async (person: PersonHighlights): Promise<ScoreResult | null> => {
    const weights = await getLearnedWeights();
    const learnedWeights: Record<string, number> = {};
    weights.forEach(w => { learnedWeights[w.datapoint] = w.weight; });
    
    const response = await dispatchRequest('SCORE_PERSON', { person, learnedWeights }, 'high');
    return response?.success ? response.data : null;
  }, [dispatchRequest, getLearnedWeights]);
  
  // UC-2: Suggest Datapoints
  const suggestDatapoints = useCallback(async (
    person: PersonHighlights, 
    action: 'like' | 'dislike'
  ) => {
    const response = await dispatchRequest('SUGGEST_DATAPOINTS', { person, action });
    return response?.success ? response.data : null;
  }, [dispatchRequest]);
  
  // UC-3: Deep Dive
  const deepDive = useCallback(async (person: PersonHighlights): Promise<DeepDiveResult | null> => {
    // In real implementation, pass actual fetch functions
    const response = await dispatchRequest('DEEP_DIVE', { 
      person,
      // These would be real API calls in production
      fetchPerson: undefined,
      fetchCompany: undefined,
      fetchFunding: undefined
    });
    return response?.success ? response.data : null;
  }, [dispatchRequest]);
  
  // UC-4: Bulk Like
  const bulkLike = useCallback(async (
    entityIds: string[], 
    datapoints: string[], 
    note?: string
  ): Promise<BulkActionResult | null> => {
    const saveFeedback = async (feedback: any) => {
      await submitFeedback({
        entityId: feedback.entity_id,
        entityType: feedback.entity_type,
        action: 'like',
        datapoints: feedback.datapoints,
        note: feedback.note,
        aiScore: feedback.ai_score,
        userAgreed: feedback.user_agreed
      });
    };
    
    const response = await dispatchRequest('BULK_LIKE', { 
      entityIds, 
      datapoints, 
      note,
      saveFeedback 
    });
    return response?.success ? response.data : null;
  }, [dispatchRequest, submitFeedback]);
  
  // UC-4b: Bulk Dislike
  const bulkDislike = useCallback(async (
    entityIds: string[], 
    datapoints: string[], 
    note?: string
  ): Promise<BulkActionResult | null> => {
    const saveFeedback = async (feedback: any) => {
      await submitFeedback({
        entityId: feedback.entity_id,
        entityType: feedback.entity_type,
        action: 'dislike',
        datapoints: feedback.datapoints,
        note: feedback.note,
        aiScore: feedback.ai_score,
        userAgreed: feedback.user_agreed
      });
    };
    
    const response = await dispatchRequest('BULK_DISLIKE', { 
      entityIds, 
      datapoints, 
      note,
      saveFeedback 
    });
    return response?.success ? response.data : null;
  }, [dispatchRequest, submitFeedback]);
  
  // UC-5: Create Shortlist
  const createShortlist = useCallback(async (name: string, entityIds: string[]) => {
    const response = await dispatchRequest('CREATE_SHORTLIST', { 
      name, 
      entityIds,
      // Would pass actual save function in production
      saveShortlist: undefined
    });
    return response?.success ? response.data : null;
  }, [dispatchRequest]);
  
  // UC-6: Auto Score
  const autoScore = useCallback(async (persons: PersonHighlights[]) => {
    const weights = await getLearnedWeights();
    const learnedWeights: Record<string, number> = {};
    weights.forEach(w => { learnedWeights[w.datapoint] = w.weight; });
    
    const response = await dispatchRequest('AUTO_SCORE', { persons, learnedWeights });
    return response?.success ? response.data : null;
  }, [dispatchRequest, getLearnedWeights]);
  
  // UC-7: Sort Feed
  const sortFeed = useCallback(async (persons: PersonHighlights[]) => {
    const weights = await getLearnedWeights();
    const learnedWeights: Record<string, number> = {};
    weights.forEach(w => { learnedWeights[w.datapoint] = w.weight; });
    
    const response = await dispatchRequest('SORT_FEED', { persons, learnedWeights });
    return response?.success ? response.data : null;
  }, [dispatchRequest, getLearnedWeights]);
  
  // UC-8: Check Alerts
  const checkAlerts = useCallback(async (persons: PersonHighlights[], threshold = 90) => {
    const weights = await getLearnedWeights();
    const learnedWeights: Record<string, number> = {};
    weights.forEach(w => { learnedWeights[w.datapoint] = w.weight; });
    
    const response = await dispatchRequest('CHECK_ALERTS', { persons, threshold, learnedWeights });
    return response?.success ? response.data : null;
  }, [dispatchRequest, getLearnedWeights]);
  
  // UC-9: Session Summary
  const getSessionSummary = useCallback(async (sessionData: {
    viewed: number;
    liked: string[];
    disliked: string[];
    skipped: number;
    startTime: number;
  }) => {
    const response = await dispatchRequest('SESSION_SUMMARY', { sessionData });
    return response?.success ? response.data : null;
  }, [dispatchRequest]);
  
  // UC-11: Natural Search
  const naturalSearch = useCallback(async (query: string) => {
    const response = await dispatchRequest('NATURAL_SEARCH', { 
      query,
      // Would pass actual search function in production
      searchFn: undefined
    });
    return response?.success ? response.data : null;
  }, [dispatchRequest]);
  
  // UC-12: Auto Process
  const autoProcess = useCallback(async (
    persons: PersonHighlights[], 
    likeThreshold = 85, 
    dislikeThreshold = 20
  ) => {
    const weights = await getLearnedWeights();
    const learnedWeights: Record<string, number> = {};
    weights.forEach(w => { learnedWeights[w.datapoint] = w.weight; });
    
    const saveFeedback = async (feedback: any) => {
      await submitFeedback({
        entityId: feedback.entity_id,
        entityType: feedback.entity_type,
        action: feedback.action,
        datapoints: feedback.datapoints,
        note: feedback.note,
        aiScore: feedback.ai_score,
        userAgreed: feedback.user_agreed
      });
    };
    
    const response = await dispatchRequest('AUTO_PROCESS', { 
      persons, 
      likeThreshold, 
      dislikeThreshold,
      learnedWeights,
      saveFeedback
    });
    return response?.success ? response.data : null;
  }, [dispatchRequest, getLearnedWeights, submitFeedback]);
  
  // UC-13: Learn Correction
  const learnCorrection = useCallback(async (
    person: PersonHighlights,
    aiRecommendation: string,
    userAction: 'like' | 'dislike',
    datapoints: string[]
  ) => {
    // Would pass actual weight update function in production
    const response = await dispatchRequest('LEARN_CORRECTION', {
      person,
      aiRecommendation,
      userAction,
      datapoints,
      updateWeight: undefined
    });
    return response?.success ? response.data : null;
  }, [dispatchRequest]);
  
  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  return {
    isProcessing,
    lastResponse,
    error,
    queueLength,
    scorePerson,
    suggestDatapoints,
    deepDive,
    bulkLike,
    bulkDislike,
    createShortlist,
    autoScore,
    sortFeed,
    checkAlerts,
    getSessionSummary,
    naturalSearch,
    autoProcess,
    learnCorrection,
    clearError
  };
}

export default useAgent;

