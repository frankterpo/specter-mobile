// Cactus On-Device AI Client
// Wrapper around cactus-react-native for local LLM inference

import { Platform } from 'react-native';
import { logger } from '../utils/logger';

// Conditionally import Cactus only on native platforms
// Web will get a mock implementation
let CactusLM: any;
if (Platform.OS !== 'web') {
  CactusLM = require('cactus-react-native').CactusLM;
}

// Re-export types
export type Message = {
  role: 'user' | 'assistant' | 'system';
  content?: string;
  images?: string[];
};

export type CompleteOptions = {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  stopSequences?: string[];
};

export type Tool = {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
};

export interface CactusClientConfig {
  model?: string;
  contextSize?: number;
}

export interface CactusCompleteParams {
  messages: Message[];
  options?: CompleteOptions;
  tools?: Tool[];
  onToken?: (token: string) => void;
}

export interface CactusCompleteResult {
  success: boolean;
  response: string;
  functionCalls?: { name: string; arguments: Record<string, any> }[];
  timeToFirstTokenMs: number;
  totalTimeMs: number;
  tokensPerSecond: number;
}

type DownloadState = 'idle' | 'downloading' | 'downloaded';
type InitState = 'idle' | 'initializing' | 'ready';

/**
 * Singleton wrapper for Cactus on-device LLM
 * Handles model download, initialization, and inference
 */
class CactusClient {
  private static instance: CactusClient | null = null;
  
  private lm: CactusLM;
  private downloadState: DownloadState = 'idle';
  private initState: InitState = 'idle';
  private downloadProgress: number = 0;
  private model: string;

  private constructor(config: CactusClientConfig = {}) {
    this.model = config.model ?? 'qwen3-0.6';
    
    // Only initialize CactusLM on native platforms
    if (Platform.OS !== 'web' && CactusLM) {
      this.lm = new CactusLM({
        model: this.model,
        contextSize: config.contextSize ?? 2048,
      });
      logger.info('CactusClient', `Initialized with model: ${this.model}`);
    } else {
      logger.warn('CactusClient', 'Running on web - Cactus AI not available');
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: CactusClientConfig): CactusClient {
    if (!CactusClient.instance) {
      CactusClient.instance = new CactusClient(config);
    }
    return CactusClient.instance;
  }

  /**
   * Reset singleton (useful for changing models)
   */
  static async resetInstance(): Promise<void> {
    if (CactusClient.instance) {
      await CactusClient.instance.destroy();
      CactusClient.instance = null;
    }
  }

  /**
   * Download the model if not already downloaded
   */
  async download(onProgress?: (progress: number) => void): Promise<void> {
    // Web mock - pretend download is instant
    if (Platform.OS === 'web' || !this.lm) {
      onProgress?.(1.0);
      this.downloadState = 'downloaded';
      return;
    }

    if (this.downloadState === 'downloaded') {
      onProgress?.(1.0);
      return;
    }

    if (this.downloadState === 'downloading') {
      throw new Error('Download already in progress');
    }

    this.downloadState = 'downloading';
    logger.info('CactusClient', `Starting download for model: ${this.model}`);

    try {
      await this.lm.download({
        onProgress: (progress: number) => {
          this.downloadProgress = progress;
          onProgress?.(progress);
          if (progress < 1) {
            logger.debug('CactusClient', `Download progress: ${Math.round(progress * 100)}%`);
          }
        },
      });
      this.downloadState = 'downloaded';
      logger.info('CactusClient', 'Model download complete');
    } catch (error) {
      this.downloadState = 'idle';
      logger.error('CactusClient', 'Download failed', error);
      throw error;
    }
  }

  /**
   * Initialize the model for inference
   */
  async init(): Promise<void> {
    // Web mock - instant init
    if (Platform.OS === 'web' || !this.lm) {
      this.initState = 'ready';
      return;
    }

    if (this.initState === 'ready') {
      return;
    }

    if (this.initState === 'initializing') {
      // Wait for initialization to complete
      while (this.initState === 'initializing') {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    // Ensure model is downloaded first
    if (this.downloadState !== 'downloaded') {
      await this.download();
    }

    this.initState = 'initializing';
    logger.info('CactusClient', 'Initializing model...');

    try {
      await this.lm.init();
      this.initState = 'ready';
      logger.info('CactusClient', 'Model ready for inference');
    } catch (error) {
      this.initState = 'idle';
      logger.error('CactusClient', 'Initialization failed', error);
      throw error;
    }
  }

  /**
   * Ensure client is ready for inference
   */
  async ensureReady(): Promise<void> {
    if (this.initState !== 'ready') {
      await this.init();
    }
  }

  /**
   * Run completion with streaming support
   */
  async complete(params: CactusCompleteParams): Promise<CactusCompleteResult> {
    await this.ensureReady();

    // Web mock response
    if (Platform.OS === 'web' || !this.lm) {
      const mockResponse = `**SUMMARY**
• This is a web preview - AI analysis requires iOS/Android
• On-device inference only works on native platforms
• Build and run on a real device to see AI in action

**STRENGTHS**
• Cactus SDK provides fast on-device inference
• No data leaves the device - total privacy

**RISKS**
• Web preview cannot demonstrate AI features
• Please test on iOS simulator or device`;

      // Simulate streaming
      const tokens = mockResponse.split('');
      for (const token of tokens) {
        params.onToken?.(token);
        await new Promise(r => setTimeout(r, 5));
      }

      return {
        success: true,
        response: mockResponse,
        functionCalls: undefined,
        timeToFirstTokenMs: 100,
        totalTimeMs: tokens.length * 5,
        tokensPerSecond: 20,
      };
    }

    logger.info('CactusClient', 'Starting completion', {
      messageCount: params.messages.length,
      hasTools: !!params.tools?.length,
    });

    const startTime = Date.now();

    try {
      const result = await this.lm.complete({
        messages: params.messages,
        options: {
          maxTokens: params.options?.maxTokens ?? 512,
          temperature: params.options?.temperature ?? 0.7,
          ...params.options,
        },
        tools: params.tools,
        onToken: params.onToken,
      });

      logger.info('CactusClient', 'Completion finished', {
        success: result.success,
        totalTimeMs: result.totalTimeMs,
        tokensPerSecond: result.tokensPerSecond,
      });

      return {
        success: result.success,
        response: result.response,
        functionCalls: result.functionCalls,
        timeToFirstTokenMs: result.timeToFirstTokenMs,
        totalTimeMs: result.totalTimeMs,
        tokensPerSecond: result.tokensPerSecond,
      };
    } catch (error) {
      logger.error('CactusClient', 'Completion failed', error);
      throw error;
    }
  }

  /**
   * Generate text embedding
   */
  async embed(text: string): Promise<number[]> {
    if (Platform.OS === 'web' || !this.lm) {
      // Return mock embedding for web
      return new Array(384).fill(0).map(() => Math.random());
    }

    await this.ensureReady();

    logger.debug('CactusClient', 'Generating embedding', { textLength: text.length });

    try {
      const result = await this.lm.embed({ text });
      return result.embedding;
    } catch (error) {
      logger.error('CactusClient', 'Embedding failed', error);
      throw error;
    }
  }

  /**
   * Stop current generation
   */
  async stop(): Promise<void> {
    if (this.lm) {
      await this.lm.stop();
    }
    logger.info('CactusClient', 'Generation stopped');
  }

  /**
   * Reset conversation context
   */
  async reset(): Promise<void> {
    if (this.lm) {
      await this.lm.reset();
    }
    logger.info('CactusClient', 'Context reset');
  }

  /**
   * Destroy client and free resources
   */
  async destroy(): Promise<void> {
    if (this.lm) {
      await this.lm.destroy();
    }
    this.initState = 'idle';
    logger.info('CactusClient', 'Client destroyed');
  }

  /**
   * Get available models
   */
  async getModels() {
    if (!this.lm) {
      return [{ slug: 'qwen3-0.6', name: 'Qwen3 0.6B (Web Preview)', isDownloaded: false }];
    }
    return this.lm.getModels();
  }

  /**
   * Get current state
   */
  getState() {
    return {
      model: this.model,
      downloadState: this.downloadState,
      downloadProgress: this.downloadProgress,
      initState: this.initState,
      isReady: this.initState === 'ready',
    };
  }
}

// Export singleton getter
export const getCactusClient = CactusClient.getInstance;
export const resetCactusClient = CactusClient.resetInstance;

// Re-export types for convenience
export type { Message, CompleteOptions, Tool };

