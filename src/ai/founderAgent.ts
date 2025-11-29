// Founder Agent - On-device AI analysis for investors
// Uses Cactus SDK for local inference

import { getCactusClient, type CactusCompleteResult } from './cactusClient';
import {
  buildFounderSummaryPrompt,
  buildFollowUpPrompt,
  buildMeetingPrepPrompt,
  parseAnalysisResponse,
  type ParsedAnalysis,
  type PromptOptions,
} from './prompts';
import type { Person } from '../api/specter';
import { logger } from '../utils/logger';

export interface FounderAnalysisResult {
  summary: string[];
  strengths: string[];
  risks: string[];
  rawResponse: string;
  generatedAt: string;
  stats: {
    tokensPerSecond: number;
    totalTimeMs: number;
  };
}

export interface FollowUpResult {
  response: string;
  stats: {
    tokensPerSecond: number;
    totalTimeMs: number;
  };
}

export interface StreamingCallbacks {
  onToken?: (token: string) => void;
  onProgress?: (stage: 'downloading' | 'initializing' | 'generating') => void;
}

export interface AnalysisOptions extends StreamingCallbacks {
  /** User context from AgentContext for personalization */
  userContext?: string;
}

/**
 * Founder Agent - Generates AI insights about founders
 * All inference runs locally on-device via Cactus
 */
export class FounderAgent {
  private static instance: FounderAgent | null = null;

  private constructor() {}

  static getInstance(): FounderAgent {
    if (!FounderAgent.instance) {
      FounderAgent.instance = new FounderAgent();
    }
    return FounderAgent.instance;
  }

  /**
   * Generate a comprehensive founder analysis
   * Includes summary, strengths, and risks
   * @param person - The person to analyze
   * @param options - Analysis options including callbacks and user context
   */
  async analyzeFounder(
    person: Person,
    options?: AnalysisOptions
  ): Promise<FounderAnalysisResult> {
    logger.info('FounderAgent', 'Starting founder analysis', {
      personId: person.id,
      name: `${person.first_name} ${person.last_name}`,
      hasUserContext: !!options?.userContext,
    });

    const client = getCactusClient();

    // Download model if needed
    options?.onProgress?.('downloading');
    await client.download();

    // Initialize model
    options?.onProgress?.('initializing');
    await client.ensureReady();

    // Generate analysis with optional user context
    options?.onProgress?.('generating');
    const promptOptions: PromptOptions | undefined = options?.userContext 
      ? { userContext: options.userContext } 
      : undefined;
    const messages = buildFounderSummaryPrompt(person, promptOptions);

    let fullResponse = '';
    const result = await client.complete({
      messages,
      options: {
        maxTokens: 400,
        temperature: 0.4, // Lower for more consistent output
      },
      onToken: (token) => {
        fullResponse += token;
        options?.onToken?.(token);
      },
    });

    // Parse the response into structured sections
    const parsed = parseAnalysisResponse(result.response || fullResponse);

    logger.info('FounderAgent', 'Analysis complete', {
      personId: person.id,
      summaryPoints: parsed.summary.length,
      strengthsPoints: parsed.strengths.length,
      risksPoints: parsed.risks.length,
      tokensPerSecond: result.tokensPerSecond,
    });

    return {
      summary: parsed.summary,
      strengths: parsed.strengths,
      risks: parsed.risks,
      rawResponse: result.response || fullResponse,
      generatedAt: new Date().toISOString(),
      stats: {
        tokensPerSecond: result.tokensPerSecond,
        totalTimeMs: result.totalTimeMs,
      },
    };
  }

  /**
   * Ask a follow-up question about a founder
   * @param person - The person being discussed
   * @param previousAnalysis - The previous AI analysis
   * @param question - The follow-up question
   * @param options - Analysis options including callbacks and user context
   */
  async askFollowUp(
    person: Person,
    previousAnalysis: string,
    question: string,
    options?: AnalysisOptions
  ): Promise<FollowUpResult> {
    logger.info('FounderAgent', 'Follow-up question', {
      personId: person.id,
      question,
    });

    const client = getCactusClient();

    options?.onProgress?.('generating');
    const promptOptions: PromptOptions | undefined = options?.userContext 
      ? { userContext: options.userContext } 
      : undefined;
    const messages = buildFollowUpPrompt(person, previousAnalysis, question, promptOptions);

    let fullResponse = '';
    const result = await client.complete({
      messages,
      options: {
        maxTokens: 300,
        temperature: 0.5,
      },
      onToken: (token) => {
        fullResponse += token;
        options?.onToken?.(token);
      },
    });

    return {
      response: result.response || fullResponse,
      stats: {
        tokensPerSecond: result.tokensPerSecond,
        totalTimeMs: result.totalTimeMs,
      },
    };
  }

  /**
   * Generate meeting prep briefing
   * @param person - The person you're meeting
   * @param options - Analysis options including callbacks and user context
   */
  async prepareMeeting(
    person: Person,
    options?: AnalysisOptions
  ): Promise<FollowUpResult> {
    logger.info('FounderAgent', 'Meeting prep', {
      personId: person.id,
    });

    const client = getCactusClient();

    options?.onProgress?.('generating');
    const promptOptions: PromptOptions | undefined = options?.userContext 
      ? { userContext: options.userContext } 
      : undefined;
    const messages = buildMeetingPrepPrompt(person, promptOptions);

    let fullResponse = '';
    const result = await client.complete({
      messages,
      options: {
        maxTokens: 350,
        temperature: 0.4,
      },
      onToken: (token) => {
        fullResponse += token;
        options?.onToken?.(token);
      },
    });

    return {
      response: result.response || fullResponse,
      stats: {
        tokensPerSecond: result.tokensPerSecond,
        totalTimeMs: result.totalTimeMs,
      },
    };
  }

  /**
   * Check if the model is ready for inference
   */
  async isReady(): Promise<boolean> {
    try {
      const client = getCactusClient();
      const state = client.getState();
      return state.isReady;
    } catch {
      return false;
    }
  }

  /**
   * Pre-warm the model (download + init)
   */
  async warmUp(callbacks?: StreamingCallbacks): Promise<void> {
    logger.info('FounderAgent', 'Warming up model...');
    const client = getCactusClient();

    callbacks?.onProgress?.('downloading');
    await client.download();

    callbacks?.onProgress?.('initializing');
    await client.ensureReady();

    logger.info('FounderAgent', 'Model warmed up and ready');
  }
}

// Export singleton getter
export const getFounderAgent = FounderAgent.getInstance;


