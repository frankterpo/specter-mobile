// Web-only mock Cactus implementation
// Shows preview message on web platform

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

/**
 * Web mock implementation of CactusClient
 * Shows helpful preview message for developers
 */
class CactusClient {
  private static instance: CactusClient | null = null;
  
  private downloadState: DownloadState = 'idle';
  private initState: InitState = 'idle';
  private downloadProgress: number = 0;
  private model: string;

  private constructor(config: CactusClientConfig = {}) {
    this.model = config.model ?? 'qwen3-0.6';
    logger.warn('CactusClient', 'Running on web - using mock implementation');
  }

  static getInstance(config?: CactusClientConfig): CactusClient {
    if (!CactusClient.instance) {
      CactusClient.instance = new CactusClient(config);
    }
    return CactusClient.instance;
  }

  static async resetInstance(): Promise<void> {
    CactusClient.instance = null;
  }

  async download(onProgress?: (progress: number) => void): Promise<void> {
    // Simulate download on web
    for (let i = 0; i <= 100; i += 20) {
      onProgress?.(i / 100);
      await new Promise(r => setTimeout(r, 100));
    }
    this.downloadState = 'downloaded';
    this.downloadProgress = 1;
  }

  async init(): Promise<void> {
    this.initState = 'ready';
  }

  async ensureReady(): Promise<void> {
    if (this.downloadState !== 'downloaded') {
      await this.download();
    }
    if (this.initState !== 'ready') {
      await this.init();
    }
  }

  async complete(params: CactusCompleteParams): Promise<CactusCompleteResult> {
    await this.ensureReady();

    const mockResponse = `**SUMMARY**
• This is a web preview - AI analysis requires iOS/Android
• On-device inference runs locally with Cactus SDK
• No data ever leaves your device - total privacy

**STRENGTHS**
• Fast on-device inference (~20 tok/sec on iPhone)
• Works completely offline after model download
• Zero latency, zero API costs

**RISKS**
• Web preview cannot run native AI models
• Build and test on iOS simulator or physical device
• Use \`npx expo run:ios\` for full experience`;

    // Simulate streaming with delays
    const tokens = mockResponse.split('');
    let response = '';
    for (const token of tokens) {
      response += token;
      params.onToken?.(token);
      await new Promise(r => setTimeout(r, 8));
    }

    return {
      success: true,
      response,
      functionCalls: undefined,
      timeToFirstTokenMs: 150,
      totalTimeMs: tokens.length * 8,
      tokensPerSecond: 15,
    };
  }

  async embed(text: string): Promise<number[]> {
    // Return mock embedding
    return new Array(384).fill(0).map(() => Math.random());
  }

  async stop(): Promise<void> {
    logger.info('CactusClient', 'Stop called (web mock)');
  }

  async reset(): Promise<void> {
    logger.info('CactusClient', 'Reset called (web mock)');
  }

  async destroy(): Promise<void> {
    this.initState = 'idle';
    logger.info('CactusClient', 'Destroyed (web mock)');
  }

  async getModels() {
    return [
      { slug: 'qwen3-0.6', name: 'Qwen3 0.6B', isDownloaded: true },
      { slug: 'gemma2-2b', name: 'Gemma2 2B', isDownloaded: false },
    ];
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

