/**
 * InputManager - Multi-Modal Input Handler for Cactus LLM
 * 
 * Captures and processes user input from:
 * 1. Voice (speech-to-text via expo-speech)
 * 2. Text (direct text input)
 * 3. Platform Interactions (likes, dislikes, searches, time spent, scroll depth)
 * 
 * All inputs are normalized and fed into the Cactus LLM context.
 */

import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import type { Person, Company, SavedSearch } from '../api/specter';

// ============================================
// TYPES
// ============================================

export type InputSource = 
  | 'voice'
  | 'text'
  | 'like'
  | 'dislike'
  | 'view'
  | 'search'
  | 'scroll'
  | 'time_spent'
  | 'list_action'
  | 'filter_change'
  | 'follow_up_question'
  | 'meeting_prep_request';

export interface UserInput {
  id: string;
  source: InputSource;
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface VoiceCommand {
  transcript: string;
  confidence: number;
  intent?: CommandIntent;
}

export type CommandIntent = 
  | { type: 'search'; query: string }
  | { type: 'filter'; filters: Record<string, any> }
  | { type: 'action'; action: 'like' | 'dislike' | 'save' | 'skip'; target?: string }
  | { type: 'question'; question: string }
  | { type: 'navigate'; destination: string }
  | { type: 'bulk_action'; action: string; criteria: string }
  | { type: 'unknown'; raw: string };

export interface InteractionSignal {
  entityId: string;
  entityType: 'person' | 'company' | 'search' | 'list';
  signalType: 'view' | 'like' | 'dislike' | 'scroll' | 'time_spent' | 'expand' | 'collapse';
  value?: number; // For time_spent (ms) or scroll (percentage)
  timestamp: string;
}

export interface SessionContext {
  sessionId: string;
  startTime: string;
  inputs: UserInput[];
  interactions: InteractionSignal[];
  currentFocus?: {
    entityId: string;
    entityType: string;
    startTime: string;
  };
}

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEY_INPUTS = '@specter_user_inputs';
const STORAGE_KEY_SESSION = '@specter_session';
const MAX_STORED_INPUTS = 500;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// ============================================
// INPUT MANAGER CLASS
// ============================================

class InputManager {
  private static instance: InputManager | null = null;
  private session: SessionContext | null = null;
  private isRecording: boolean = false;
  private recording: Audio.Recording | null = null;
  private inputListeners: Set<(input: UserInput) => void> = new Set();

  private constructor() {}

  static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  async startSession(): Promise<void> {
    const now = new Date().toISOString();
    
    // Check for existing session
    const existingSession = await this.loadSession();
    if (existingSession) {
      const lastActivity = new Date(existingSession.inputs[existingSession.inputs.length - 1]?.timestamp || existingSession.startTime);
      const timeSinceLastActivity = Date.now() - lastActivity.getTime();
      
      if (timeSinceLastActivity < SESSION_TIMEOUT_MS) {
        this.session = existingSession;
        logger.info('InputManager', 'Resumed existing session', { sessionId: this.session.sessionId });
        return;
      }
    }

    // Create new session
    this.session = {
      sessionId: `session_${Date.now()}`,
      startTime: now,
      inputs: [],
      interactions: [],
    };
    
    await this.saveSession();
    logger.info('InputManager', 'Started new session', { sessionId: this.session.sessionId });
  }

  private async loadSession(): Promise<SessionContext | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_SESSION);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      logger.error('InputManager', 'Failed to load session', error);
      return null;
    }
  }

  private async saveSession(): Promise<void> {
    if (!this.session) return;
    try {
      await AsyncStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(this.session));
    } catch (error) {
      logger.error('InputManager', 'Failed to save session', error);
    }
  }

  // ============================================
  // TEXT INPUT
  // ============================================

  async addTextInput(text: string, metadata?: Record<string, any>): Promise<UserInput> {
    const input: UserInput = {
      id: `input_${Date.now()}`,
      source: 'text',
      content: text,
      timestamp: new Date().toISOString(),
      metadata,
    };

    await this.recordInput(input);
    return input;
  }

  async addFollowUpQuestion(question: string, personId?: string): Promise<UserInput> {
    return this.addTextInput(question, {
      type: 'follow_up_question',
      personId,
    });
  }

  // ============================================
  // VOICE INPUT
  // ============================================

  async startVoiceRecording(): Promise<void> {
    if (this.isRecording) {
      logger.warn('InputManager', 'Already recording');
      return;
    }

    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Microphone permission not granted');
      }

      // Configure audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
      this.isRecording = true;
      logger.info('InputManager', 'Voice recording started');
    } catch (error) {
      logger.error('InputManager', 'Failed to start recording', error);
      throw error;
    }
  }

  async stopVoiceRecording(): Promise<VoiceCommand | null> {
    if (!this.isRecording || !this.recording) {
      logger.warn('InputManager', 'No active recording');
      return null;
    }

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;
      this.isRecording = false;

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      if (!uri) {
        throw new Error('No recording URI');
      }

      // TODO: Send to speech-to-text service
      // For now, we'll use a placeholder
      // In production, integrate with Whisper API or similar
      const transcript = await this.transcribeAudio(uri);
      
      const command: VoiceCommand = {
        transcript,
        confidence: 0.9,
        intent: this.parseVoiceIntent(transcript),
      };

      // Record as input
      await this.recordInput({
        id: `voice_${Date.now()}`,
        source: 'voice',
        content: transcript,
        timestamp: new Date().toISOString(),
        metadata: { confidence: command.confidence, intent: command.intent },
      });

      logger.info('InputManager', 'Voice recording processed', { transcript });
      return command;
    } catch (error) {
      logger.error('InputManager', 'Failed to process recording', error);
      this.isRecording = false;
      this.recording = null;
      return null;
    }
  }

  private async transcribeAudio(uri: string): Promise<string> {
    // Placeholder - integrate with actual speech-to-text service
    // Options: OpenAI Whisper, Google Speech-to-Text, etc.
    logger.info('InputManager', 'Transcribing audio', { uri });
    
    // For now, return a placeholder
    // In production, this would call an API
    return '[Voice input - transcription pending]';
  }

  private parseVoiceIntent(transcript: string): CommandIntent {
    const lower = transcript.toLowerCase();

    // Search patterns
    if (lower.includes('search for') || lower.includes('find') || lower.includes('look for')) {
      const query = lower
        .replace(/search for|find|look for/g, '')
        .trim();
      return { type: 'search', query };
    }

    // Action patterns
    if (lower.includes('like this') || lower.includes('save this')) {
      return { type: 'action', action: 'like' };
    }
    if (lower.includes('skip') || lower.includes('pass') || lower.includes('next')) {
      return { type: 'action', action: 'skip' };
    }
    if (lower.includes('dislike') || lower.includes('not interested')) {
      return { type: 'action', action: 'dislike' };
    }

    // Filter patterns
    if (lower.includes('show me') || lower.includes('filter by') || lower.includes('only')) {
      const criteria = lower
        .replace(/show me|filter by|only/g, '')
        .trim();
      return { type: 'filter', filters: { raw: criteria } };
    }

    // Bulk action patterns
    if (lower.includes('like all') || lower.includes('save all')) {
      const criteria = lower.replace(/like all|save all/g, '').trim();
      return { type: 'bulk_action', action: 'like', criteria };
    }

    // Question patterns
    if (lower.includes('?') || lower.startsWith('what') || lower.startsWith('who') || 
        lower.startsWith('why') || lower.startsWith('how') || lower.startsWith('tell me')) {
      return { type: 'question', question: transcript };
    }

    // Navigation patterns
    if (lower.includes('go to') || lower.includes('open') || lower.includes('show')) {
      const destination = lower.replace(/go to|open|show/g, '').trim();
      return { type: 'navigate', destination };
    }

    return { type: 'unknown', raw: transcript };
  }

  getRecordingStatus(): boolean {
    return this.isRecording;
  }

  // ============================================
  // PLATFORM INTERACTIONS
  // ============================================

  async recordLike(person: Person): Promise<void> {
    await this.recordInteraction({
      entityId: person.id,
      entityType: 'person',
      signalType: 'like',
      timestamp: new Date().toISOString(),
    });

    await this.recordInput({
      id: `like_${Date.now()}`,
      source: 'like',
      content: `Liked ${person.full_name || person.first_name}`,
      timestamp: new Date().toISOString(),
      metadata: {
        personId: person.id,
        industry: person.experience?.find(e => e.is_current)?.industry,
        seniority: person.seniority,
        highlights: person.people_highlights,
      },
    });
  }

  async recordDislike(person: Person): Promise<void> {
    await this.recordInteraction({
      entityId: person.id,
      entityType: 'person',
      signalType: 'dislike',
      timestamp: new Date().toISOString(),
    });

    await this.recordInput({
      id: `dislike_${Date.now()}`,
      source: 'dislike',
      content: `Disliked ${person.full_name || person.first_name}`,
      timestamp: new Date().toISOString(),
      metadata: {
        personId: person.id,
        industry: person.experience?.find(e => e.is_current)?.industry,
        seniority: person.seniority,
      },
    });
  }

  async recordView(entityId: string, entityType: 'person' | 'company', name?: string): Promise<void> {
    // Start tracking time spent
    if (this.session) {
      this.session.currentFocus = {
        entityId,
        entityType,
        startTime: new Date().toISOString(),
      };
    }

    await this.recordInteraction({
      entityId,
      entityType,
      signalType: 'view',
      timestamp: new Date().toISOString(),
    });

    await this.recordInput({
      id: `view_${Date.now()}`,
      source: 'view',
      content: `Viewed ${name || entityId}`,
      timestamp: new Date().toISOString(),
      metadata: { entityId, entityType },
    });
  }

  async recordViewEnd(entityId: string): Promise<void> {
    if (!this.session?.currentFocus || this.session.currentFocus.entityId !== entityId) {
      return;
    }

    const startTime = new Date(this.session.currentFocus.startTime).getTime();
    const endTime = Date.now();
    const timeSpentMs = endTime - startTime;

    await this.recordInteraction({
      entityId,
      entityType: this.session.currentFocus.entityType as 'person' | 'company',
      signalType: 'time_spent',
      value: timeSpentMs,
      timestamp: new Date().toISOString(),
    });

    // If significant time spent, record as strong signal
    if (timeSpentMs > 10000) { // More than 10 seconds
      await this.recordInput({
        id: `time_${Date.now()}`,
        source: 'time_spent',
        content: `Spent ${Math.round(timeSpentMs / 1000)}s viewing ${entityId}`,
        timestamp: new Date().toISOString(),
        metadata: { entityId, timeSpentMs, isSignificant: timeSpentMs > 30000 },
      });
    }

    this.session.currentFocus = undefined;
  }

  async recordScroll(entityId: string, scrollPercentage: number): Promise<void> {
    await this.recordInteraction({
      entityId,
      entityType: 'person',
      signalType: 'scroll',
      value: scrollPercentage,
      timestamp: new Date().toISOString(),
    });

    // Only record deep scrolls as inputs
    if (scrollPercentage > 75) {
      await this.recordInput({
        id: `scroll_${Date.now()}`,
        source: 'scroll',
        content: `Scrolled ${scrollPercentage}% through ${entityId}`,
        timestamp: new Date().toISOString(),
        metadata: { entityId, scrollPercentage },
      });
    }
  }

  async recordSearch(query: string, filters?: Record<string, any>): Promise<void> {
    await this.recordInput({
      id: `search_${Date.now()}`,
      source: 'search',
      content: `Searched: ${query}`,
      timestamp: new Date().toISOString(),
      metadata: { query, filters },
    });
  }

  async recordFilterChange(filters: Record<string, any>): Promise<void> {
    await this.recordInput({
      id: `filter_${Date.now()}`,
      source: 'filter_change',
      content: `Changed filters: ${JSON.stringify(filters)}`,
      timestamp: new Date().toISOString(),
      metadata: { filters },
    });
  }

  async recordListAction(listId: string, listName: string, action: 'add' | 'remove', entityId: string): Promise<void> {
    await this.recordInput({
      id: `list_${Date.now()}`,
      source: 'list_action',
      content: `${action === 'add' ? 'Added to' : 'Removed from'} list "${listName}"`,
      timestamp: new Date().toISOString(),
      metadata: { listId, listName, action, entityId },
    });
  }

  async recordMeetingPrepRequest(personId: string, personName: string): Promise<void> {
    await this.recordInput({
      id: `meeting_${Date.now()}`,
      source: 'meeting_prep_request',
      content: `Requested meeting prep for ${personName}`,
      timestamp: new Date().toISOString(),
      metadata: { personId, personName },
    });
  }

  // ============================================
  // CORE RECORDING
  // ============================================

  private async recordInput(input: UserInput): Promise<void> {
    if (!this.session) {
      await this.startSession();
    }

    this.session!.inputs.push(input);

    // Trim old inputs
    if (this.session!.inputs.length > MAX_STORED_INPUTS) {
      this.session!.inputs = this.session!.inputs.slice(-MAX_STORED_INPUTS);
    }

    await this.saveSession();
    
    // Notify listeners
    this.inputListeners.forEach(listener => listener(input));
    
    logger.debug('InputManager', 'Recorded input', { source: input.source, content: input.content.substring(0, 50) });
  }

  private async recordInteraction(interaction: InteractionSignal): Promise<void> {
    if (!this.session) {
      await this.startSession();
    }

    this.session!.interactions.push(interaction);
    await this.saveSession();
  }

  // ============================================
  // CONTEXT BUILDING FOR CACTUS
  // ============================================

  /**
   * Build a context string from recent inputs for Cactus LLM
   */
  buildContextForLLM(maxInputs: number = 20): string {
    if (!this.session) return '';

    const recentInputs = this.session.inputs.slice(-maxInputs);
    if (recentInputs.length === 0) return '';

    const contextParts: string[] = ['Recent User Activity:'];

    // Group by type
    const likes = recentInputs.filter(i => i.source === 'like');
    const dislikes = recentInputs.filter(i => i.source === 'dislike');
    const searches = recentInputs.filter(i => i.source === 'search');
    const questions = recentInputs.filter(i => i.source === 'text' || i.source === 'voice');
    const timeSpent = recentInputs.filter(i => i.source === 'time_spent');

    if (likes.length > 0) {
      contextParts.push(`- Liked ${likes.length} people recently`);
      // Extract patterns
      const industries = likes
        .map(l => l.metadata?.industry)
        .filter(Boolean);
      if (industries.length > 0) {
        const uniqueIndustries = [...new Set(industries)].slice(0, 3);
        contextParts.push(`  Industries: ${uniqueIndustries.join(', ')}`);
      }
    }

    if (dislikes.length > 0) {
      contextParts.push(`- Passed on ${dislikes.length} people`);
    }

    if (searches.length > 0) {
      const searchQueries = searches.map(s => s.metadata?.query).filter(Boolean);
      contextParts.push(`- Recent searches: ${searchQueries.slice(-3).join(', ')}`);
    }

    if (questions.length > 0) {
      contextParts.push(`- Asked ${questions.length} questions`);
      const lastQuestion = questions[questions.length - 1];
      if (lastQuestion) {
        contextParts.push(`  Last: "${lastQuestion.content.substring(0, 100)}"`);
      }
    }

    if (timeSpent.length > 0) {
      const significantViews = timeSpent.filter(t => t.metadata?.isSignificant);
      if (significantViews.length > 0) {
        contextParts.push(`- Spent significant time on ${significantViews.length} profiles`);
      }
    }

    return contextParts.join('\n');
  }

  /**
   * Get the most recent text/voice inputs for direct LLM processing
   */
  getRecentQuestions(limit: number = 5): UserInput[] {
    if (!this.session) return [];
    
    return this.session.inputs
      .filter(i => i.source === 'text' || i.source === 'voice' || i.source === 'follow_up_question')
      .slice(-limit);
  }

  /**
   * Get interaction patterns for AI personalization
   */
  getInteractionPatterns(): {
    preferredIndustries: string[];
    avoidedIndustries: string[];
    preferredSeniorities: string[];
    averageViewTime: number;
    engagementScore: number;
  } {
    if (!this.session) {
      return {
        preferredIndustries: [],
        avoidedIndustries: [],
        preferredSeniorities: [],
        averageViewTime: 0,
        engagementScore: 0,
      };
    }

    const likes = this.session.inputs.filter(i => i.source === 'like');
    const dislikes = this.session.inputs.filter(i => i.source === 'dislike');
    const timeSpent = this.session.interactions.filter(i => i.signalType === 'time_spent');

    // Extract industries from likes
    const likedIndustries = likes
      .map(l => l.metadata?.industry)
      .filter(Boolean) as string[];
    
    const dislikedIndustries = dislikes
      .map(d => d.metadata?.industry)
      .filter(Boolean) as string[];

    // Extract seniorities
    const likedSeniorities = likes
      .map(l => l.metadata?.seniority)
      .filter(Boolean) as string[];

    // Calculate average view time
    const viewTimes = timeSpent.map(t => t.value || 0);
    const avgViewTime = viewTimes.length > 0 
      ? viewTimes.reduce((a, b) => a + b, 0) / viewTimes.length 
      : 0;

    // Calculate engagement score (0-100)
    const totalInteractions = likes.length + dislikes.length;
    const questionCount = this.session.inputs.filter(i => 
      i.source === 'text' || i.source === 'voice'
    ).length;
    const engagementScore = Math.min(100, totalInteractions * 2 + questionCount * 5);

    return {
      preferredIndustries: [...new Set(likedIndustries)].slice(0, 5),
      avoidedIndustries: [...new Set(dislikedIndustries)].slice(0, 3),
      preferredSeniorities: [...new Set(likedSeniorities)].slice(0, 3),
      averageViewTime: avgViewTime,
      engagementScore,
    };
  }

  // ============================================
  // LISTENERS
  // ============================================

  addInputListener(listener: (input: UserInput) => void): () => void {
    this.inputListeners.add(listener);
    return () => this.inputListeners.delete(listener);
  }

  // ============================================
  // CLEANUP
  // ============================================

  async clearHistory(): Promise<void> {
    this.session = null;
    await AsyncStorage.removeItem(STORAGE_KEY_SESSION);
    await AsyncStorage.removeItem(STORAGE_KEY_INPUTS);
    logger.info('InputManager', 'History cleared');
  }
}

// Export singleton
export const inputManager = InputManager.getInstance();
export const getInputManager = () => InputManager.getInstance();

