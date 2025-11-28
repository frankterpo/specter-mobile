// Native-only Cactus implementation
// This file is only used on iOS/Android

import { CactusLM } from 'cactus-react-native';
import { logger } from '../utils/logger';

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

class CactusClient {
  private static instance: CactusClient | null = null;
  
  private lm: CactusLM;
  private downloadState: DownloadState = 'idle';
  private initState: InitState = 'idle';
  private downloadProgress: number = 0;
  private model: string;

  private constructor(config: CactusClientConfig = {}) {
    this.model = config.model ?? 'qwen3-0.6';
    this.lm = new CactusLM({
      model: this.model,
      contextSize: config.contextSize ?? 2048,
    });
    logger.info('CactusClient', `Initialized with model: ${this.model}`);
  }

  static getInstance(config?: CactusClientConfig): CactusClient {
    if (!CactusClient.instance) {
      CactusClient.instance = new CactusClient(config);
    }
    return CactusClient.instance;
  }

  static async resetInstance(): Promise<void> {
    if (CactusClient.instance) {
      await CactusClient.instance.destroy();
      CactusClient.instance = null;
    }
  }

  async download(onProgress?: (progress: number) => void): Promise<void> {
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

  async init(): Promise<void> {
    if (this.initState === 'ready') {
      return;
    }

    if (this.initState === 'initializing') {
      while (this.initState === 'initializing') {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

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

  async ensureReady(): Promise<void> {
    if (this.initState !== 'ready') {
      await this.init();
    }
  }

  async complete(params: CactusCompleteParams): Promise<CactusCompleteResult> {
    await this.ensureReady();

    logger.info('CactusClient', 'Starting completion', {
      messageCount: params.messages.length,
      hasTools: !!params.tools?.length,
    });

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

  async embed(text: string): Promise<number[]> {
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

  async stop(): Promise<void> {
    await this.lm.stop();
    logger.info('CactusClient', 'Generation stopped');
  }

  async reset(): Promise<void> {
    await this.lm.reset();
    logger.info('CactusClient', 'Context reset');
  }

  async destroy(): Promise<void> {
    await this.lm.destroy();
    this.initState = 'idle';
    logger.info('CactusClient', 'Client destroyed');
  }

  async getModels() {
    return this.lm.getModels();
  }

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

export const getCactusClient = CactusClient.getInstance;
export const resetCactusClient = CactusClient.resetInstance;


