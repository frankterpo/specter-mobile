/**
 * AICommandBar - Unified input bar for text, voice, and quick actions
 * 
 * Features:
 * - Text input with auto-suggestions
 * - Voice input button
 * - Quick action chips
 * - Streaming AI responses
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@clerk/clerk-expo';
import { VoiceInputButton } from './VoiceInputButton';
import { inputManager, VoiceCommand, CommandIntent } from '../ai/inputManager';
import { getFounderAgent } from '../ai/founderAgent';
import { getCactusClient } from '../ai/cactusClient';
import { useAgent, useModelStatus } from '../context/AgentContext';
import { 
  buildAgenticSystemPrompt, 
  parseToolCall, 
  executeToolCall,
  getNativeTools,
  type ToolCall,
} from '../ai/agenticTools';
import { agentMemory, getAgentMemory } from '../ai/agentMemory';
import { logger } from '../utils/logger';
import type { Person } from '../api/specter';

interface AICommandBarProps {
  /** Current person context (if viewing a profile) */
  person?: Person;
  /** Callback when AI generates a response */
  onResponse?: (response: string) => void;
  /** Callback when user issues a command */
  onCommand?: (intent: CommandIntent) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Show quick action chips */
  showQuickActions?: boolean;
  /** Collapsed mode (just the input) */
  collapsed?: boolean;
}

interface QuickAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'summarize', label: 'Summarize', icon: 'document-text-outline', prompt: 'Give me a quick summary' },
  { id: 'strengths', label: 'Strengths', icon: 'trending-up', prompt: 'What are the key strengths?' },
  { id: 'risks', label: 'Risks', icon: 'warning-outline', prompt: 'What are the potential risks?' },
  { id: 'questions', label: 'Questions', icon: 'help-circle-outline', prompt: 'What questions should I ask?' },
  { id: 'compare', label: 'Compare', icon: 'git-compare-outline', prompt: 'How does this compare to others I liked?' },
];

export function AICommandBar({
  person,
  onResponse,
  onCommand,
  placeholder = 'Ask anything about this founder...',
  showQuickActions = true,
  collapsed = false,
}: AICommandBarProps) {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isExpanded, setIsExpanded] = useState(!collapsed);
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);
  const { buildSystemPrompt } = useAgent();
  const { status: modelStatus, isReady: modelReady, warmUp } = useModelStatus();
  const { getToken } = useAuth();

  const expandAnim = useRef(new Animated.Value(collapsed ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isExpanded]);

  const handleSubmit = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return;

    // Check if model is ready - if not, show helpful message
    if (!modelReady) {
      if (modelStatus === 'downloading' || modelStatus === 'initializing') {
        setStreamingText('⏳ AI is still loading... Please wait a moment.');
        return;
      } else if (modelStatus === 'error') {
        setStreamingText('❌ AI failed to load. Please restart the app.');
        return;
      } else {
        // Try to warm up the model
        setStreamingText('⏳ Starting AI...');
        try {
          await warmUp();
        } catch (e) {
          setStreamingText('❌ Failed to start AI. Please try again.');
          return;
        }
      }
    }

    setIsProcessing(true);
    setStreamingText('');
    setToolsUsed([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Initialize memory
    const memory = getAgentMemory();
    await memory.load();

    try {
      // Get auth token for API calls
      const token = await getToken();
      if (!token) {
        setStreamingText('❌ Not authenticated. Please sign in again.');
        setIsProcessing(false);
        return;
      }

      // Record the input in memory
      memory.addConversationTurn({ role: 'user', content: text });
      await inputManager.addTextInput(text, {
        personId: person?.id,
        type: 'question',
      });

      // Get context
      const userContext = buildSystemPrompt();
      const inputContext = inputManager.buildContextForLLM();
      const fullContext = [userContext, inputContext].filter(Boolean).join('\n\n');

      // Build messages for Cactus with MEMORY-FIRST agentic system prompt
      const client = getCactusClient();
      
      // Double-check model is ready
      const state = client.getState();
      if (!state.isReady) {
        setStreamingText('⏳ AI is initializing... Please wait.');
        setIsProcessing(false);
        return;
      }

      // Use agentic system prompt with tool definitions and MEMORY
      const agenticPrompt = buildAgenticSystemPrompt(fullContext);

      const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        {
          role: 'system',
          content: agenticPrompt,
        },
      ];

      // Add person context if available
      if (person) {
        const personContext = formatPersonContext(person);
        const memoryStatus = memory.isLiked(person.id) ? 'LIKED' : 
                            memory.isDisliked(person.id) ? 'DISLIKED' : 'NEW';
        messages.push({
          role: 'user',
          content: `Context about the current founder [${memoryStatus}]:\n${personContext}\n\nUser question: ${text}`,
        });
      } else {
        messages.push({
          role: 'user',
          content: text,
        });
      }

      // NATIVE CACTUS TOOL CALLING
      // First pass with tools enabled for native function calling
      let fullResponse = '';
      setStreamingText('🧠 Thinking with memory...');
      
      const nativeTools = getNativeTools();
      
      const result = await client.complete({
        messages,
        tools: nativeTools, // NATIVE CACTUS TOOLS!
        options: {
          maxTokens: 500,
          temperature: 0.3,
        },
        onToken: (token) => {
          fullResponse += token;
        },
      });

      const firstResponse = result.response || fullResponse;
      
      // Check for NATIVE function calls from Cactus
      if (result.functionCalls && result.functionCalls.length > 0) {
        // Process all function calls
        for (const funcCall of result.functionCalls) {
          const toolCall: ToolCall = {
            name: funcCall.name,
            arguments: funcCall.arguments,
          };
          
          setStreamingText(`🔧 Using ${toolCall.name.replace(/_/g, ' ')}...`);
          setToolsUsed(prev => [...prev, toolCall.name]);
          
          logger.info('AICommandBar', 'Native Cactus tool call', toolCall);
          
          const toolResult = await executeToolCall(toolCall, token);
          
          // Record tool call in memory
          memory.recordToolCall(toolCall.name, toolResult.data);
          
          if (toolResult.success) {
            // Add tool result to conversation
            messages.push({
              role: 'assistant',
              content: firstResponse,
            });
            messages.push({
              role: 'user',
              content: `Tool result for ${toolCall.name}:\n${typeof toolResult.data === 'string' ? toolResult.data : JSON.stringify(toolResult.data, null, 2)}\n\nNow provide a helpful, personalized analysis based on this data and the user's memory/preferences.`,
            });
          }
        }

        // Final pass with tool results
        let finalResponse = '';
        setStreamingText('');
        
        const finalResult = await client.complete({
          messages,
          options: {
            maxTokens: 500,
            temperature: 0.5,
          },
          onToken: (token) => {
            finalResponse += token;
            setStreamingText(finalResponse);
          },
        });

        // Record assistant response in memory
        memory.addConversationTurn({ role: 'assistant', content: finalResult.response || finalResponse });
        
        onResponse?.(finalResult.response || finalResponse);
        
        logger.info('AICommandBar', 'Agentic response with native tools', {
          toolsUsed: toolsUsed,
          tokensPerSecond: finalResult.tokensPerSecond,
        });
      } else {
        // Fallback: Check for JSON tool calls (non-native)
        const toolCall = parseToolCall(firstResponse);
        
        if (toolCall) {
          setStreamingText(`🔧 Using ${toolCall.name.replace(/_/g, ' ')}...`);
          setToolsUsed(prev => [...prev, toolCall.name]);
          
          logger.info('AICommandBar', 'Fallback JSON tool call', toolCall);
          
          const toolResult = await executeToolCall(toolCall, token);
          memory.recordToolCall(toolCall.name, toolResult.data);
          
          if (toolResult.success) {
            messages.push({
              role: 'assistant',
              content: firstResponse,
            });
            messages.push({
              role: 'user',
              content: `Tool result for ${toolCall.name}:\n${typeof toolResult.data === 'string' ? toolResult.data : JSON.stringify(toolResult.data, null, 2)}\n\nNow provide a helpful analysis based on this data.`,
            });

            let finalResponse = '';
            setStreamingText('');
            
            const finalResult = await client.complete({
              messages,
              options: {
                maxTokens: 500,
                temperature: 0.5,
              },
              onToken: (token) => {
                finalResponse += token;
                setStreamingText(finalResponse);
              },
            });

            memory.addConversationTurn({ role: 'assistant', content: finalResult.response || finalResponse });
            onResponse?.(finalResult.response || finalResponse);
          } else {
            setStreamingText(`❌ Failed to get data: ${toolResult.error}`);
          }
        } else {
          // No tool needed - show direct response
          setStreamingText(firstResponse);
          memory.addConversationTurn({ role: 'assistant', content: firstResponse });
          onResponse?.(firstResponse);
          
          logger.info('AICommandBar', 'Direct response generated', {
            tokensPerSecond: result.tokensPerSecond,
          });
        }
      }

      setInputText('');

    } catch (error: any) {
      logger.error('AICommandBar', 'Failed to process', error);
      
      // Record error in memory
      memory.recordInteraction('interaction', `AI Error: ${error.message}`, {
        action: 'error',
        importance: 0.2,
      });
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to process your request';
      if (error.message?.includes('already in progress')) {
        errorMessage = 'AI is busy. Please wait a moment and try again.';
      } else if (error.message?.includes('already generating')) {
        errorMessage = 'AI is still generating. Please wait for it to finish.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setStreamingText(`❌ ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  }, [person, isProcessing, buildSystemPrompt, onResponse, modelReady, modelStatus, warmUp, getToken, toolsUsed]);

  const handleVoiceCommand = useCallback((command: VoiceCommand) => {
    if (command.intent) {
      onCommand?.(command.intent);
      
      // Handle different intents
      switch (command.intent.type) {
        case 'question':
          handleSubmit(command.intent.question);
          break;
        case 'search':
          // Let parent handle search
          break;
        case 'action':
          // Let parent handle action
          break;
        default:
          // For unknown intents, treat as question
          handleSubmit(command.transcript);
      }
    } else {
      handleSubmit(command.transcript);
    }
  }, [handleSubmit, onCommand]);

  const handleQuickAction = useCallback((action: QuickAction) => {
    Haptics.selectionAsync();
    handleSubmit(action.prompt);
  }, [handleSubmit]);

  const toggleExpand = useCallback(() => {
    setIsExpanded(!isExpanded);
    Haptics.selectionAsync();
  }, [isExpanded]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <View style={styles.container}>
        {/* Collapsed Toggle */}
        {collapsed && (
          <Pressable style={styles.expandToggle} onPress={toggleExpand}>
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-up'}
              size={20}
              color="#64748B"
            />
            <Text style={styles.expandText}>
              {isExpanded ? 'Collapse' : 'Ask AI'}
            </Text>
          </Pressable>
        )}

        <Animated.View
          style={[
            styles.expandableContent,
            {
              maxHeight: expandAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 400],
              }),
              opacity: expandAnim,
            },
          ]}
        >
          {/* Quick Actions */}
          {showQuickActions && person && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickActionsContainer}
            >
              {QUICK_ACTIONS.map((action) => (
                <Pressable
                  key={action.id}
                  style={styles.quickActionChip}
                  onPress={() => handleQuickAction(action)}
                  disabled={isProcessing}
                >
                  <Ionicons name={action.icon} size={14} color="#3B82F6" />
                  <Text style={styles.quickActionText}>{action.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Streaming Response */}
          {streamingText && (
            <View style={styles.responseContainer}>
              <View style={styles.responseHeader}>
                <Ionicons name="sparkles" size={14} color="#3B82F6" />
                <Text style={styles.responseLabel}>AI Response</Text>
                {isProcessing && (
                  <ActivityIndicator size="small" color="#3B82F6" style={styles.responseSpinner} />
                )}
              </View>
              
              {/* Tools Used Indicator */}
              {toolsUsed.length > 0 && (
                <View style={styles.toolsUsedContainer}>
                  <Ionicons name="construct-outline" size={12} color="#8B5CF6" />
                  <Text style={styles.toolsUsedText}>
                    Used: {toolsUsed.map(t => t.replace(/_/g, ' ')).join(', ')}
                  </Text>
                </View>
              )}
              
              <Text style={styles.responseText}>{streamingText}</Text>
            </View>
          )}

          {/* AI Status Indicator */}
          {!modelReady && (
            <View style={styles.aiStatusBar}>
              <ActivityIndicator size="small" color="#3B82F6" />
              <Text style={styles.aiStatusText}>
                {modelStatus === 'downloading' ? 'Downloading AI...' :
                 modelStatus === 'initializing' ? 'Initializing AI...' :
                 modelStatus === 'error' ? 'AI unavailable' : 'Loading AI...'}
              </Text>
            </View>
          )}

          {/* Input Row */}
          <View style={styles.inputRow}>
            <View style={styles.textInputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder={modelReady ? placeholder : 'AI is loading...'}
                placeholderTextColor="#94A3B8"
                multiline
                maxLength={500}
                editable={!isProcessing}
                onSubmitEditing={() => handleSubmit(inputText)}
                returnKeyType="send"
              />
              
              {inputText.length > 0 && (
                <Pressable
                  style={styles.sendButton}
                  onPress={() => handleSubmit(inputText)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={18} color="#fff" />
                  )}
                </Pressable>
              )}
            </View>

            <VoiceInputButton
              size="medium"
              onCommand={handleVoiceCommand}
              style={styles.voiceButton}
            />
          </View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

function formatPersonContext(person: Person): string {
  const lines: string[] = [];
  
  const fullName = person.full_name || `${person.first_name} ${person.last_name}`;
  lines.push(`Name: ${fullName}`);
  
  if (person.tagline) lines.push(`Tagline: ${person.tagline}`);
  if (person.location) lines.push(`Location: ${person.location}`);
  if (person.seniority) lines.push(`Seniority: ${person.seniority}`);
  
  const currentJob = person.experience?.find(e => e.is_current);
  if (currentJob) {
    lines.push(`Current: ${currentJob.title} at ${currentJob.company_name}`);
  }
  
  if (person.people_highlights?.length) {
    lines.push(`Highlights: ${person.people_highlights.join(', ')}`);
  }
  
  return lines.join('\n');
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  expandText: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 4,
    fontWeight: '500',
  },
  expandableContent: {
    overflow: 'hidden',
  },
  quickActionsContainer: {
    paddingBottom: 12,
    gap: 8,
  },
  quickActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 4,
  },
  quickActionText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '500',
  },
  responseContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  responseLabel: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
    marginLeft: 4,
  },
  responseSpinner: {
    marginLeft: 8,
  },
  responseText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F1F5F9',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
    maxHeight: 120,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    maxHeight: 100,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  voiceButton: {
    marginBottom: 4,
  },
  aiStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  aiStatusText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '500',
  },
  toolsUsedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
    gap: 4,
  },
  toolsUsedText: {
    fontSize: 11,
    color: '#8B5CF6',
    fontWeight: '500',
  },
});

export default AICommandBar;

