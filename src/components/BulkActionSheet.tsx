/**
 * BulkActionSheet - Bottom sheet for bulk action preview and confirmation
 * 
 * This component displays:
 * - Initial prompt before bulk action
 * - Post-bulk action shortlisting of entities
 * - Entity list with checkboxes and match scores
 * - Active persona badge
 * - Confirm/Cancel buttons with selected count
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  PanResponder,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { getAgentMemory, InvestmentPersona, EntityFeatures } from '../ai/agentMemory';
import { Person, Company } from '../api/specter';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.75;
const SHEET_MIN_HEIGHT = 200;
const DRAG_THRESHOLD = 50;

export interface BulkActionEntity {
  id: string;
  name: string;
  type: 'person' | 'company';
  subtitle?: string;
  imageUrl?: string;
  matchScore?: number; // 0-1 score from persona matching
  matchReasons?: string[];
  features?: EntityFeatures;
}

export interface BulkActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selectedIds: string[], action: 'like' | 'dislike') => void;
  entities: BulkActionEntity[];
  actionType: 'like' | 'dislike';
  isProcessing?: boolean;
  initialPrompt?: string;
}

export default function BulkActionSheet({
  visible,
  onClose,
  onConfirm,
  entities,
  actionType,
  isProcessing = false,
  initialPrompt,
}: BulkActionSheetProps) {
  // Animation values
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  
  // State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activePersona, setActivePersona] = useState<InvestmentPersona | null>(null);
  const [promptInput, setPromptInput] = useState(initialPrompt || '');
  const [showPrompt, setShowPrompt] = useState(!!initialPrompt);
  const [sheetHeight, setSheetHeight] = useState(SHEET_MAX_HEIGHT);

  // Load active persona
  useEffect(() => {
    const memory = getAgentMemory();
    memory.load().then(() => {
      setActivePersona(memory.getActivePersona());
    });
  }, []);

  // Initialize all entities as selected
  useEffect(() => {
    if (entities.length > 0) {
      const allIds = new Set(entities.map(e => e.id));
      setSelectedIds(allIds);
    }
  }, [entities]);

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      // Show sheet
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Hide sheet
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Pan responder for drag gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > DRAG_THRESHOLD) {
          // Dismiss
          handleClose();
        } else {
          // Snap back
          Animated.spring(translateY, {
            toValue: 0,
            friction: 8,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm(Array.from(selectedIds), actionType);
  };

  const toggleSelection = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds(new Set(entities.map(e => e.id)));
  };

  const deselectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds(new Set());
  };

  const getActionColor = () => {
    return actionType === 'like' ? '#22C55E' : '#EF4444';
  };

  const getActionIcon = () => {
    return actionType === 'like' ? 'star-outline' : 'close-circle-outline';
  };

  const getActionLabel = () => {
    return actionType === 'like' ? 'Like' : 'Pass';
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* Overlay */}
      <Animated.View 
        style={[styles.overlay, { opacity: overlayOpacity }]}
      >
        <Pressable style={styles.overlayTouchable} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Drag Handle */}
        <View {...panResponder.panHandlers} style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.actionIconContainer, { backgroundColor: getActionColor() + '20' }]}>
              <Ionicons name={getActionIcon()} size={20} color={getActionColor()} />
            </View>
            <View>
              <Text style={styles.headerTitle}>
                Bulk {getActionLabel()} Preview
              </Text>
              <Text style={styles.headerSubtitle}>
                {selectedIds.size} of {entities.length} selected
              </Text>
            </View>
          </View>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#64748B" />
          </Pressable>
        </View>

        {/* Active Persona Badge */}
        {activePersona && (
          <View style={styles.personaBadgeContainer}>
            <View style={styles.personaBadge}>
              <View style={styles.personaBadgeDot} />
              <Text style={styles.personaBadgeText}>{activePersona.name}</Text>
            </View>
            <Text style={styles.personaBadgeSubtext}>
              Scoring based on this persona's criteria
            </Text>
          </View>
        )}

        {/* Initial Prompt (if provided) */}
        {showPrompt && (
          <View style={styles.promptContainer}>
            <Text style={styles.promptLabel}>Refine selection (optional):</Text>
            <TextInput
              style={styles.promptInput}
              value={promptInput}
              onChangeText={setPromptInput}
              placeholder="e.g., Focus on AI companies only..."
              placeholderTextColor="#94A3B8"
              multiline
            />
          </View>
        )}

        {/* Selection Actions */}
        <View style={styles.selectionActions}>
          <Pressable onPress={selectAll} style={styles.selectionButton}>
            <Ionicons name="checkbox" size={16} color="#3B82F6" />
            <Text style={styles.selectionButtonText}>Select All</Text>
          </Pressable>
          <Pressable onPress={deselectAll} style={styles.selectionButton}>
            <Ionicons name="square-outline" size={16} color="#64748B" />
            <Text style={[styles.selectionButtonText, { color: '#64748B' }]}>Deselect All</Text>
          </Pressable>
        </View>

        {/* Entity List */}
        <ScrollView style={styles.entityList} showsVerticalScrollIndicator={false}>
          {entities.map((entity, index) => {
            const isSelected = selectedIds.has(entity.id);
            const matchPercent = entity.matchScore ? Math.round(entity.matchScore * 100) : null;
            
            return (
              <Pressable
                key={entity.id}
                onPress={() => toggleSelection(entity.id)}
                style={[
                  styles.entityItem,
                  isSelected && styles.entityItemSelected,
                ]}
              >
                {/* Checkbox */}
                <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                  {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>

                {/* Avatar/Logo */}
                {entity.imageUrl ? (
                  <Image
                    source={{ uri: entity.imageUrl }}
                    style={styles.entityImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.entityImage, styles.entityImagePlaceholder]}>
                    <Ionicons 
                      name={entity.type === 'company' ? 'business' : 'person'} 
                      size={16} 
                      color="#64748B" 
                    />
                  </View>
                )}

                {/* Info */}
                <View style={styles.entityInfo}>
                  <Text style={styles.entityName} numberOfLines={1}>{entity.name}</Text>
                  {entity.subtitle && (
                    <Text style={styles.entitySubtitle} numberOfLines={1}>{entity.subtitle}</Text>
                  )}
                  {entity.matchReasons && entity.matchReasons.length > 0 && (
                    <View style={styles.matchReasons}>
                      {entity.matchReasons.slice(0, 2).map((reason, i) => (
                        <Text key={i} style={styles.matchReason}>{reason}</Text>
                      ))}
                    </View>
                  )}
                </View>

                {/* Match Score */}
                {matchPercent !== null && (
                  <View style={[
                    styles.matchScoreBadge,
                    matchPercent >= 70 && styles.matchScoreHigh,
                    matchPercent >= 40 && matchPercent < 70 && styles.matchScoreMedium,
                    matchPercent < 40 && styles.matchScoreLow,
                  ]}>
                    <Text style={[
                      styles.matchScoreText,
                      matchPercent >= 70 && styles.matchScoreTextHigh,
                      matchPercent >= 40 && matchPercent < 70 && styles.matchScoreTextMedium,
                      matchPercent < 40 && styles.matchScoreTextLow,
                    ]}>
                      {matchPercent}%
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <Pressable onPress={handleClose} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            disabled={selectedIds.size === 0 || isProcessing}
            style={[
              styles.confirmButton,
              { backgroundColor: getActionColor() },
              (selectedIds.size === 0 || isProcessing) && styles.confirmButtonDisabled,
            ]}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name={getActionIcon()} size={18} color="#FFF" />
                <Text style={styles.confirmButtonText}>
                  {getActionLabel()} {selectedIds.size} {selectedIds.size === 1 ? 'item' : 'items'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlayTouchable: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personaBadgeContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  personaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  personaBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  personaBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  personaBadgeSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
  },
  promptContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  promptLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  promptInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  selectionActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  selectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectionButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3B82F6',
  },
  entityList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  entityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginVertical: 4,
    gap: 12,
  },
  entityItemSelected: {
    backgroundColor: '#F0FDF4',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  entityImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  entityImagePlaceholder: {
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entityInfo: {
    flex: 1,
  },
  entityName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  entitySubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  matchReasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  matchReason: {
    fontSize: 10,
    color: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  matchScoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  matchScoreHigh: {
    backgroundColor: '#DCFCE7',
  },
  matchScoreMedium: {
    backgroundColor: '#FEF3C7',
  },
  matchScoreLow: {
    backgroundColor: '#FEE2E2',
  },
  matchScoreText: {
    fontSize: 12,
    fontWeight: '700',
  },
  matchScoreTextHigh: {
    color: '#166534',
  },
  matchScoreTextMedium: {
    color: '#B45309',
  },
  matchScoreTextLow: {
    color: '#991B1B',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFF',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
});

