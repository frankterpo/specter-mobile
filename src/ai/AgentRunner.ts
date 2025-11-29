/**
 * AgentRunner - Headless agent execution for testing
 * 
 * This module runs the Cactus AI agent with tool calling capabilities
 * without any UI. Perfect for testing the agentic flow in terminal.
 * 
 * Usage (in React Native context):
 *   const runner = new AgentRunner();
 *   await runner.init();
 *   const result = await runner.run("Analyze this founder and check their company's funding");
 */

import { CactusClient, Tool } from './cactusClient';
import { ANALYSIS_TOOLS, executeAnalysisTool } from './analysisTools';
import { getAgentMemory, AgentMemory } from './agentMemory';
import { logger } from '../utils/logger';

// Maximum tool calls per run (prevent infinite loops)
const MAX_TOOL_CALLS = 5;

export interface AgentRunResult {
  success: boolean;
  response: string;
  toolCalls: Array<{
    tool: string;
    args: any;
    result: string;
  }>;
  totalTimeMs: number;
  tokensPerSecond?: number;
}

export interface AgentContext {
  personId?: string;
  personData?: any;
  token?: string; // Auth token for API calls
  memory?: AgentMemory;
}

/**
 * AgentRunner - Executes AI agent with tool calling
 */
export class AgentRunner {
  private client: CactusClient;
  private memory: AgentMemory;
  private isReady: boolean = false;

  constructor(personaId: string = 'global') {
    this.client = new CactusClient();
    this.memory = getAgentMemory(personaId);
  }

  /**
   * Initialize the agent (download model, warm up)
   */
  async init(onProgress?: (progress: number) => void): Promise<void> {
    logger.info('AgentRunner', 'Initializing...');
    
    // Load memory
    await this.memory.load();
    
    // Initialize Cactus client
    await this.client.init(onProgress);
    
    this.isReady = true;
    logger.info('AgentRunner', 'Ready');
  }

  /**
   * Check if agent is ready
   */
  get ready(): boolean {
    return this.isReady;
  }

  /**
   * Run the agent with a user message
   */
  async run(
    userMessage: string,
    context?: AgentContext
  ): Promise<AgentRunResult> {
    if (!this.isReady) {
      throw new Error('Agent not initialized. Call init() first.');
    }

    const startTime = Date.now();
    const toolCalls: AgentRunResult['toolCalls'] = [];
    
    // Build system prompt with memory context
    const systemPrompt = this.buildSystemPrompt(context);
    
    // Build initial messages
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add person context if provided
    if (context?.personData) {
      messages.push({
        role: 'user',
        content: `Here is the person data to analyze:\n${JSON.stringify(context.personData, null, 2)}`,
      });
    }

    // Add user message
    messages.push({ role: 'user', content: userMessage });

    logger.info('AgentRunner', 'Starting agentic loop', { 
      messageCount: messages.length,
      hasTools: true,
      toolCount: ANALYSIS_TOOLS.length,
    });

    // Agentic loop
    let iterations = 0;
    let finalResponse = '';

    while (iterations < MAX_TOOL_CALLS) {
      iterations++;
      
      logger.info('AgentRunner', `Iteration ${iterations}`, {
        messagesCount: messages.length,
      });

      // Call Cactus with tools
      const result = await this.client.complete({
        messages,
        tools: context?.token ? ANALYSIS_TOOLS : undefined, // Only provide tools if we have auth
        maxTokens: 1024,
        temperature: 0.7,
      });

      if (!result.success) {
        logger.error('AgentRunner', 'Completion failed', { error: result.response });
        return {
          success: false,
          response: result.response || 'Agent failed to respond',
          toolCalls,
          totalTimeMs: Date.now() - startTime,
        };
      }

      // Check for tool calls
      if (result.functionCalls && result.functionCalls.length > 0) {
        logger.info('AgentRunner', 'Tool calls detected', { 
          count: result.functionCalls.length,
          tools: result.functionCalls.map(fc => fc.name),
        });

        // Execute each tool call
        for (const fc of result.functionCalls) {
          const toolResult = await executeAnalysisTool(
            fc.name,
            fc.arguments,
            context?.token
          );

          toolCalls.push({
            tool: fc.name,
            args: fc.arguments,
            result: toolResult,
          });

          // Add tool result to conversation
          messages.push({
            role: 'assistant',
            content: `[Tool Call: ${fc.name}]\nArguments: ${JSON.stringify(fc.arguments)}`,
          });
          messages.push({
            role: 'user',
            content: `[Tool Result]\n${toolResult}`,
          });
        }

        // Continue loop to let model synthesize
        continue;
      }

      // No tool calls - this is the final response
      finalResponse = result.response || '';
      
      // Record in memory
      this.memory.recordInteraction('conversation', userMessage, {
        action: 'ai_response',
        importance: 0.5,
      });

      break;
    }

    const totalTimeMs = Date.now() - startTime;

    logger.info('AgentRunner', 'Run complete', {
      iterations,
      toolCallCount: toolCalls.length,
      totalTimeMs,
      responseLength: finalResponse.length,
    });

    return {
      success: true,
      response: finalResponse,
      toolCalls,
      totalTimeMs,
    };
  }

  /**
   * Build system prompt with memory context
   */
  private buildSystemPrompt(context?: AgentContext): string {
    const memoryContext = this.memory.buildFullContext();
    const stats = this.memory.getStats();

    return `You are an AI analyst for venture capital investors using the Specter platform.
Your role is to analyze founders and provide investment-relevant insights.

CAPABILITIES:
- You can use tools to look up real-time data from the Specter database
- You have access to company funding info, investor data, and person details
- Always verify claims by using tools when company_id or person_id is available

GUIDELINES:
- Be concise and direct - investors are busy
- Focus on signals that matter for investment decisions
- Use tools to verify funding status, investors, and company details
- Acknowledge when data is limited - don't hallucinate
- Highlight both opportunities and risks honestly

USER MEMORY (${stats.likedCount} likes, ${stats.dislikedCount} dislikes):
${memoryContext || 'No preferences learned yet.'}

AVAILABLE TOOLS:
- lookup_company_funding: Get funding, investors, employee count for a company
- check_co_investors: Check if top-tier investors are on the cap table
- lookup_person_details: Get detailed info about a person
- search_entity: Search for a company by name

When you see a company_id in the data, USE the lookup_company_funding tool to verify funding status.`;
  }

  /**
   * Score a person against learned preferences
   */
  scoreEntity(entityFeatures: {
    industry?: string;
    seniority?: string;
    region?: string;
    highlights?: string[];
  }): { score: number; reasons: string[]; warnings: string[] } {
    return this.memory.calculateMatchScore(entityFeatures);
  }

  /**
   * Record a like (updates memory)
   */
  async recordLike(entity: { id: string; name: string }, reason?: string): Promise<void> {
    this.memory.recordLike(entity, reason);
    await this.memory.save();
  }

  /**
   * Record a dislike (updates memory)
   */
  async recordDislike(entity: { id: string; name: string }, reason?: string): Promise<void> {
    this.memory.recordDislike(entity, reason);
    await this.memory.save();
  }

  /**
   * Get agent stats
   */
  getStats() {
    return this.memory.getStats();
  }
}

// Singleton instance for convenience
let defaultRunner: AgentRunner | null = null;

export function getAgentRunner(personaId?: string): AgentRunner {
  if (!defaultRunner) {
    defaultRunner = new AgentRunner(personaId);
  }
  return defaultRunner;
}

