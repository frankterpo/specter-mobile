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
import { ANALYSIS_TOOLS, executeAnalysisTool } from './analysisTools';

export interface ToolCallRecord {
  tool: string;
  args: any;
  result: string;
}

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
  toolTrace?: ToolCallRecord[];
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
  onProgress?: (stage: 'downloading' | 'initializing' | 'generating' | 'investigating') => void;
}

export interface AnalysisOptions extends StreamingCallbacks {
  /** User context from AgentContext for personalization */
  userContext?: string;
  /** Auth token for API tools */
  token?: string;
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

      // Force tool usage for companies with IDs (Agentic Trigger)
      if (options?.token) {
        const companyIds = person.experience
          ?.filter(e => e.company_id)
          .map(e => e.company_id)
          .slice(0, 2); // Check top 2 companies

        if (companyIds && companyIds.length > 0) {
          // Append to the last user message to avoid confusing message history state
          const lastMsg = messages[messages.length - 1];
          if (lastMsg && lastMsg.role === 'user') {
            // CRITICAL: Force tool usage with explicit format
            lastMsg.content += `\n\n🚨 CRITICAL: Use 'lookup_company_funding' tool for company IDs: ${companyIds.join(', ')} before generating analysis.`;
          }
        }
      }

    let fullResponse = '';
    let finalResult: CactusCompleteResult | null = null;
    let toolCallsCount = 0;
    const MAX_TOOL_CALLS = 3;
    const toolTrace: ToolCallRecord[] = [];

    // Agentic Loop
    while (toolCallsCount < MAX_TOOL_CALLS) {
      const tools = options?.token ? ANALYSIS_TOOLS : undefined;
      // Minimal logging for performance
      if (__DEV__ && toolCallsCount === 0) {
        logger.debug('FounderAgent', 'Starting analysis', { hasTools: !!tools });
      }

      const result = await client.complete({
        messages,
        options: {
          maxTokens: 400,
          temperature: 0.4,
        },
        tools: options?.token ? ANALYSIS_TOOLS : undefined, // Only use tools if we have a token
        onToken: (token) => {
          // Pass through tokens only if we're not inside a tool call block (hard to detect with stream, 
          // but for now assume first pass is reasoning or final answer)
          // If it's a tool call, the model usually outputs a specific JSON structure which we might leak.
          // For UX, we might want to buffer? 
          // Current implementation of CactusClient just streams raw tokens.
          // We'll just buffer `fullResponse` and stream. If it turns out to be a tool call, 
          // the UI might show some JSON temporarily, which is acceptable for "thinking".
          fullResponse += token;
          options?.onToken?.(token);
        },
      });

      // Log only on tool calls for performance
      if (result.functionCalls?.length && __DEV__) {
        logger.info('FounderAgent', 'Tool calls detected', { count: result.functionCalls.length });
      }

      finalResult = result;
      fullResponse = result.response; // Reset to full response

      // Check if model called tools
      const modelCalledTools = result.functionCalls && result.functionCalls.length > 0;
      
      // FALLBACK: If model didn't call tools but we have company_ids, force tool execution
      if (!modelCalledTools && toolCallsCount === 0 && options?.token) {
        const companyIds = person.experience
          ?.filter(e => e.company_id && e.company_id !== 'REPLACE_WITH_REAL_COMPANY_ID_FROM_POSTGRES')
          .map(e => e.company_id)
          .slice(0, 2);

        if (companyIds && companyIds.length > 0) {
          logger.warn('FounderAgent', 'Model did not call tools, forcing execution', { companyIds });
          console.log('[AGENT_DEBUG] FALLBACK: Forcing tool execution for company_ids:', companyIds);
          
          try {
            // Manually execute tools
            for (const companyId of companyIds) {
              try {
                const toolOutput = await executeAnalysisTool('lookup_company_funding', { company_id: companyId }, options.token);
                toolTrace.push({ 
                  tool: 'lookup_company_funding', 
                  args: { company_id: companyId }, 
                  result: toolOutput 
                });
                
                // Add tool result to history for next iteration
                messages.push({
                  role: 'user',
                  content: `[System] Tool 'lookup_company_funding' was called with company_id="${companyId}". Result: ${toolOutput}\n\nNow generate your analysis using this verified funding data.`,
                });
              } catch (toolError: any) {
                logger.error('FounderAgent', 'Tool execution failed', toolError);
                const errorMsg = `Error calling lookup_company_funding for ${companyId}: ${toolError.message}`;
                toolTrace.push({ 
                  tool: 'lookup_company_funding', 
                  args: { company_id: companyId }, 
                  result: errorMsg 
                });
              }
            }
            
            toolCallsCount++;
            // Continue loop to let model synthesize with tool results
            continue;
          } catch (error: any) {
            logger.error('FounderAgent', 'Fallback tool execution failed', error);
            // Don't crash - just break and use what we have
            break;
          }
        }
      }

      if (modelCalledTools && options?.token) {
        logger.info('FounderAgent', 'Agent triggering tools', { calls: result.functionCalls.length });
        options?.onProgress?.('investigating');

        // Add agent's thought process (response) to history
        messages.push({
          role: 'assistant',
          content: result.response || 'Thinking...',
        });

        // Execute tools
        for (const call of result.functionCalls) {
          const toolOutput = await executeAnalysisTool(call.name, call.arguments, options.token);
          toolTrace.push({ tool: call.name, args: call.arguments, result: toolOutput });
          
          // Add tool result to history
          messages.push({
            role: 'user', // Inject as user message since 'tool' role not supported yet
            content: `[System] Tool '${call.name}' output: ${toolOutput}`,
          });
        }
        
        toolCallsCount++;
        // Loop back to let the agent synthesize the new info
      } else {
        // No tools called and no fallback needed, we are done
        break;
      }
    }

    if (!finalResult) throw new Error("Analysis failed");

    // Parse the response into structured sections
    const parsed = parseAnalysisResponse(finalResult.response || fullResponse);

    logger.info('FounderAgent', 'Analysis complete', {
      personId: person.id,
      summaryPoints: parsed.summary.length,
      strengthsPoints: parsed.strengths.length,
      risksPoints: parsed.risks.length,
      tokensPerSecond: finalResult.tokensPerSecond,
      toolLoops: toolCallsCount,
    });

    return {
      summary: parsed.summary,
      strengths: parsed.strengths,
      risks: parsed.risks,
      rawResponse: finalResult.response || fullResponse,
      generatedAt: new Date().toISOString(),
      stats: {
        tokensPerSecond: finalResult.tokensPerSecond,
        totalTimeMs: finalResult.totalTimeMs,
      },
      toolTrace,
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


