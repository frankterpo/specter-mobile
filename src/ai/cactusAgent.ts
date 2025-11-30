// Cactus AI Agent Integration
// On-device LLM with tool calling for Specter deal sourcing

import { CactusLM } from 'cactus-react-native';

// Types from Cactus SDK
interface Message {
  role: 'user' | 'assistant' | 'system';
  content?: string;
  images?: string[];
}

interface CactusLMCompleteResult {
  success: boolean;
  response: string;
  functionCalls?: { name: string; arguments: Record<string, any> }[];
  timeToFirstTokenMs: number;
  totalTimeMs: number;
  tokensPerSecond: number;
  prefillTokens: number;
  decodeTokens: number;
  totalTokens: number;
}

// Tool definitions for the agent
export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

// Tool execution result
export interface ToolResult {
  tool: string;
  result: any;
  error?: string;
}

// Agent tools for Specter
export const AGENT_TOOLS: Tool[] = [
  {
    name: 'get_person',
    description: 'Get detailed information about a person by their ID',
    parameters: {
      type: 'object',
      properties: {
        person_id: {
          type: 'string',
          description: 'The Specter person ID (e.g., per_xxx)'
        }
      },
      required: ['person_id']
    }
  },
  {
    name: 'get_company',
    description: 'Get detailed information about a company by its ID',
    parameters: {
      type: 'object',
      properties: {
        company_id: {
          type: 'string',
          description: 'The Specter company ID (e.g., com_xxx)'
        }
      },
      required: ['company_id']
    }
  },
  {
    name: 'score_candidate',
    description: 'Score a candidate against the current persona recipe',
    parameters: {
      type: 'object',
      properties: {
        highlights: {
          type: 'string',
          description: 'Comma-separated list of candidate highlights'
        }
      },
      required: ['highlights']
    }
  },
  {
    name: 'bulk_like',
    description: 'Like multiple entities with datapoints',
    parameters: {
      type: 'object',
      properties: {
        entity_ids: {
          type: 'string',
          description: 'Comma-separated list of entity IDs to like'
        },
        datapoints: {
          type: 'string',
          description: 'Comma-separated list of datapoints justifying the like'
        },
        note: {
          type: 'string',
          description: 'Optional note explaining the decision'
        }
      },
      required: ['entity_ids', 'datapoints']
    }
  },
  {
    name: 'bulk_dislike',
    description: 'Dislike multiple entities with datapoints',
    parameters: {
      type: 'object',
      properties: {
        entity_ids: {
          type: 'string',
          description: 'Comma-separated list of entity IDs to dislike'
        },
        datapoints: {
          type: 'string',
          description: 'Comma-separated list of datapoints justifying the dislike'
        },
        note: {
          type: 'string',
          description: 'Optional note explaining the decision'
        }
      },
      required: ['entity_ids', 'datapoints']
    }
  },
  {
    name: 'create_shortlist',
    description: 'Create a shortlist of entities',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name for the shortlist'
        },
        entity_ids: {
          type: 'string',
          description: 'Comma-separated list of entity IDs to include'
        }
      },
      required: ['name', 'entity_ids']
    }
  },
  {
    name: 'get_learned_weights',
    description: 'Get the top learned weights for the current persona',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'string',
          description: 'Number of weights to return (default: 10)'
        }
      },
      required: []
    }
  },
  {
    name: 'switch_persona',
    description: 'Switch to a different investor persona',
    parameters: {
      type: 'object',
      properties: {
        persona_id: {
          type: 'string',
          description: 'The persona ID to switch to',
          enum: ['early', 'growth', 'pe', 'ib']
        }
      },
      required: ['persona_id']
    }
  }
];

// Completion parameters type
export interface CompletionParams {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
}

// Default config for Qwen 3B
export const DEFAULT_MODEL_PATH = 'qwen2.5-3b-instruct-q4_k_m.gguf';

// Agent state
let cactusLM: CactusLM | null = null;
let isInitialized = false;

/**
 * Initialize Cactus with model
 */
export async function initAgent(modelName: string = DEFAULT_MODEL_PATH): Promise<void> {
  if (isInitialized) return;
  
  try {
    console.log('🌵 Initializing Cactus agent...');
    
    // Create CactusLM instance with model name
    cactusLM = new CactusLM({ model: modelName });
    
    // Download model if needed
    console.log('📥 Downloading model if needed...');
    await cactusLM.download({
      onProgress: (progress) => {
        console.log(`   Download: ${Math.round(progress * 100)}%`);
      }
    });
    
    // Initialize the model
    console.log('🔧 Initializing model...');
    await cactusLM.init();
    
    isInitialized = true;
    console.log('✅ Cactus agent initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Cactus:', error);
    throw error;
  }
}

/**
 * Generate system prompt with tools
 */
export function generateSystemPrompt(personaPrompt: string): string {
  const toolDescriptions = AGENT_TOOLS.map(tool => 
    `- ${tool.name}: ${tool.description}`
  ).join('\n');
  
  return `${personaPrompt}

You have access to the following tools:
${toolDescriptions}

To use a tool, respond with:
<tool>tool_name</tool>
<args>{"param": "value"}</args>

After receiving tool results, provide your final analysis.`;
}

/**
 * Parse tool call from model response
 */
export function parseToolCall(response: string): { tool: string; args: Record<string, any> } | null {
  const toolMatch = response.match(/<tool>(\w+)<\/tool>/);
  const argsMatch = response.match(/<args>([\s\S]*?)<\/args>/);
  
  if (!toolMatch) return null;
  
  const tool = toolMatch[1];
  let args: Record<string, any> = {};
  
  if (argsMatch) {
    try {
      args = JSON.parse(argsMatch[1]);
    } catch {
      // Try to parse as key=value pairs
      const pairs = argsMatch[1].split(',').map(p => p.trim());
      pairs.forEach(pair => {
        const [key, value] = pair.split('=').map(s => s.trim());
        if (key && value) args[key] = value;
      });
    }
  }
  
  return { tool, args };
}

/**
 * Run completion with Cactus
 */
export async function complete(
  prompt: string,
  options?: Partial<CompletionParams>
): Promise<string> {
  if (!cactusLM) {
    throw new Error('Cactus not initialized. Call initAgent() first.');
  }
  
  // Convert prompt to messages format
  const messages: Message[] = [
    { role: 'user', content: prompt }
  ];
  
  const result: CactusLMCompleteResult = await cactusLM.complete({
    messages,
    options: {
      maxTokens: options?.maxTokens || 512,
      temperature: options?.temperature || 0.7,
      topP: options?.topP || 0.9,
      stopSequences: options?.stopSequences || ['</tool>', '</args>', '\n\nHuman:'],
    }
  });
  
  return result.response;
}

/**
 * Run agentic loop with tool execution
 */
export async function runAgentLoop(
  userMessage: string,
  systemPrompt: string,
  toolExecutor: (tool: string, args: Record<string, any>) => Promise<any>,
  maxSteps: number = 3
): Promise<{ response: string; toolCalls: ToolResult[] }> {
  if (!cactusLM) {
    throw new Error('Cactus not initialized. Call initAgent() first.');
  }
  
  const toolCalls: ToolResult[] = [];
  let conversation = `${systemPrompt}\n\nUser: ${userMessage}\n\nAssistant: `;
  
  for (let step = 0; step < maxSteps; step++) {
    // Get model response
    const response = await complete(conversation);
    conversation += response;
    
    // Check for tool call
    const toolCall = parseToolCall(response);
    
    if (!toolCall) {
      // No tool call, return final response
      return { response, toolCalls };
    }
    
    // Execute tool
    console.log(`🔧 Executing tool: ${toolCall.tool}`);
    
    try {
      const result = await toolExecutor(toolCall.tool, toolCall.args);
      toolCalls.push({ tool: toolCall.tool, result });
      
      // Add tool result to conversation
      conversation += `\n\nTool Result: ${JSON.stringify(result)}\n\nAssistant: `;
    } catch (error: any) {
      toolCalls.push({ tool: toolCall.tool, result: null, error: error.message });
      conversation += `\n\nTool Error: ${error.message}\n\nAssistant: `;
    }
  }
  
  // Max steps reached, get final response
  const finalResponse = await complete(conversation + '\n\nProvide your final analysis:');
  return { response: finalResponse, toolCalls };
}

/**
 * Check if agent is initialized
 */
export function isAgentReady(): boolean {
  return isInitialized && cactusLM !== null;
}

/**
 * Cleanup agent resources
 */
export async function cleanupAgent(): Promise<void> {
  if (cactusLM) {
    // Cactus cleanup if available
    cactusLM = null;
    isInitialized = false;
  }
}

