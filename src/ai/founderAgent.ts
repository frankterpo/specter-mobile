// Founder Agent - On-device AI analysis for investors
// Uses Cactus SDK for local inference

import { getCactusClient, type CactusCompleteResult } from './cactusClient';
import {
  buildFounderSummaryPrompt,
  buildFollowUpPrompt,
  buildMeetingPrepPrompt,
  parseAnalysisResponse,
  type ParsedAnalysis,
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
   */
  async analyzeFounder(
    person: Person,
    callbacks?: StreamingCallbacks
  ): Promise<FounderAnalysisResult> {
    logger.info('FounderAgent', 'Starting founder analysis', {
      personId: person.id,
      name: `${person.first_name} ${person.last_name}`,
    });

    const client = getCactusClient();

    // Download model if needed
    callbacks?.onProgress?.('downloading');
    await client.download();

    // Initialize model
    callbacks?.onProgress?.('initializing');
    await client.ensureReady();

    // Generate analysis
    callbacks?.onProgress?.('generating');
    const messages = buildFounderSummaryPrompt(person);

    let fullResponse = '';
    const result = await client.complete({
      messages,
      options: {
        maxTokens: 400,
        temperature: 0.4, // Lower for more consistent output
      },
      onToken: (token) => {
        fullResponse += token;
        callbacks?.onToken?.(token);
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
   */
  async askFollowUp(
    person: Person,
    previousAnalysis: string,
    question: string,
    callbacks?: StreamingCallbacks
  ): Promise<FollowUpResult> {
    logger.info('FounderAgent', 'Follow-up question', {
      personId: person.id,
      question,
    });

    const client = getCactusClient();

    callbacks?.onProgress?.('generating');
    const messages = buildFollowUpPrompt(person, previousAnalysis, question);

    let fullResponse = '';
    const result = await client.complete({
      messages,
      options: {
        maxTokens: 300,
        temperature: 0.5,
      },
      onToken: (token) => {
        fullResponse += token;
        callbacks?.onToken?.(token);
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
   */
  async prepareMeeting(
    person: Person,
    callbacks?: StreamingCallbacks
  ): Promise<FollowUpResult> {
    logger.info('FounderAgent', 'Meeting prep', {
      personId: person.id,
    });

    const client = getCactusClient();

    callbacks?.onProgress?.('generating');
    const messages = buildMeetingPrepPrompt(person);

    let fullResponse = '';
    const result = await client.complete({
      messages,
      options: {
        maxTokens: 350,
        temperature: 0.4,
      },
      onToken: (token) => {
        fullResponse += token;
        callbacks?.onToken?.(token);
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

