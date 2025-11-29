/**
 * VoiceInputButton - Voice input control for Cactus LLM
 * 
 * Features:
 * - Push-to-talk recording
 * - Visual feedback during recording
 * - Haptic feedback
 * - Intent detection display
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { inputManager, VoiceCommand, CommandIntent } from '../ai/inputManager';
import { logger } from '../utils/logger';

interface VoiceInputButtonProps {
  onCommand?: (command: VoiceCommand) => void;
  onTranscript?: (transcript: string) => void;
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

export function VoiceInputButton({
  onCommand,
  onTranscript,
  size = 'medium',
  style,
}: VoiceInputButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  // Pulse animation while recording
  React.useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const handlePressIn = useCallback(async () => {
    try {
      setError(null);
      setLastCommand(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      await inputManager.startVoiceRecording();
      setIsRecording(true);
    } catch (err: any) {
      logger.error('VoiceInputButton', 'Failed to start recording', err);
      setError(err.message || 'Failed to start recording');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, []);

  const handlePressOut = useCallback(async () => {
    if (!isRecording) return;

    setIsRecording(false);
    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const command = await inputManager.stopVoiceRecording();
      
      if (command) {
        setLastCommand(command);
        onCommand?.(command);
        onTranscript?.(command.transcript);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      logger.error('VoiceInputButton', 'Failed to process recording', err);
      setError(err.message || 'Failed to process recording');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsProcessing(false);
    }
  }, [isRecording, onCommand, onTranscript]);

  const buttonSizes = {
    small: { button: 40, icon: 20 },
    medium: { button: 56, icon: 24 },
    large: { button: 72, icon: 32 },
  };

  const { button: buttonSize, icon: iconSize } = buttonSizes[size];

  const getIntentLabel = (intent?: CommandIntent): string => {
    if (!intent) return '';
    switch (intent.type) {
      case 'search': return `Search: ${intent.query}`;
      case 'action': return `Action: ${intent.action}`;
      case 'filter': return 'Applying filters...';
      case 'question': return 'Processing question...';
      case 'navigate': return `Go to: ${intent.destination}`;
      case 'bulk_action': return `Bulk ${intent.action}: ${intent.criteria}`;
      default: return 'Processing...';
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: buttonSize + 20,
            height: buttonSize + 20,
            borderRadius: (buttonSize + 20) / 2,
            transform: [{ scale: pulseAnim }],
            opacity: isRecording ? 0.3 : 0,
          },
        ]}
      />
      
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isProcessing}
        style={[
          styles.button,
          {
            width: buttonSize,
            height: buttonSize,
            borderRadius: buttonSize / 2,
          },
          isRecording && styles.buttonRecording,
          isProcessing && styles.buttonProcessing,
        ]}
      >
        {isProcessing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons
            name={isRecording ? 'mic' : 'mic-outline'}
            size={iconSize}
            color="#fff"
          />
        )}
      </Pressable>

      {/* Status Text */}
      {(isRecording || isProcessing || lastCommand || error) && (
        <View style={styles.statusContainer}>
          {isRecording && (
            <Text style={styles.statusText}>Listening...</Text>
          )}
          {isProcessing && (
            <Text style={styles.statusText}>Processing...</Text>
          )}
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}
          {lastCommand && !isRecording && !isProcessing && (
            <View>
              <Text style={styles.transcriptText} numberOfLines={2}>
                "{lastCommand.transcript}"
              </Text>
              {lastCommand.intent && lastCommand.intent.type !== 'unknown' && (
                <Text style={styles.intentText}>
                  {getIntentLabel(lastCommand.intent)}
                </Text>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    backgroundColor: '#3B82F6',
  },
  button: {
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonRecording: {
    backgroundColor: '#EF4444',
  },
  buttonProcessing: {
    backgroundColor: '#64748B',
  },
  statusContainer: {
    marginTop: 12,
    alignItems: 'center',
    maxWidth: 250,
  },
  statusText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
  transcriptText: {
    fontSize: 14,
    color: '#1E293B',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  intentText: {
    fontSize: 12,
    color: '#3B82F6',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
});

export default VoiceInputButton;

