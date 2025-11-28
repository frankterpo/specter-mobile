// Cactus Client - Type definitions and platform bridge
// Metro resolves to .native.ts or .web.ts at runtime

import { Platform } from 'react-native';

// Types exported for all platforms
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

export interface CactusClientState {
  model: string;
  downloadState: 'idle' | 'downloading' | 'downloaded';
  downloadProgress: number;
  initState: 'idle' | 'initializing' | 'ready';
  isReady: boolean;
}

export interface ICactusClient {
  download(onProgress?: (progress: number) => void): Promise<void>;
  init(): Promise<void>;
  ensureReady(): Promise<void>;
  complete(params: CactusCompleteParams): Promise<CactusCompleteResult>;
  embed(text: string): Promise<number[]>;
  stop(): Promise<void>;
  reset(): Promise<void>;
  destroy(): Promise<void>;
  getModels(): Promise<any[]>;
  getState(): CactusClientState;
}

// Lazy import platform-specific implementation
let _clientModule: any = null;

function getClientModule() {
  if (!_clientModule) {
    if (Platform.OS === 'web') {
      _clientModule = require('./cactusClient.web');
    } else {
      _clientModule = require('./cactusClient.native');
    }
  }
  return _clientModule;
}

export function getCactusClient(config?: CactusClientConfig): ICactusClient {
  return getClientModule().getCactusClient(config);
}

export function resetCactusClient(): Promise<void> {
  return getClientModule().resetCactusClient();
}

