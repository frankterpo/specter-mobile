// Feedback Sheet Component
// Bottom sheet for providing like/dislike feedback with datapoints

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { usePersona } from '../context/PersonaContext';

interface FeedbackSheetProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  entity: {
    id: string;
    type: 'person' | 'company';
    name: string;
    highlights?: string[];
  } | null;
  aiScore?: number;
  aiRecommendation?: string;
  onComplete?: () => void;
}

export function FeedbackSheet({
  bottomSheetRef,
  entity,
  aiScore,
  aiRecommendation,
  onComplete
}: FeedbackSheetProps) {
  const { activePersona, submitFeedback, getRecipe } = usePersona();
  const [selectedAction, setSelectedAction] = useState<'like' | 'dislike' | null>(null);
  const [selectedDatapoints, setSelectedDatapoints] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const snapPoints = useMemo(() => ['70%'], []);
  const recipe = getRecipe();

  // Get available datapoints from entity highlights and recipe
  const availableDatapoints = useMemo(() => {
    const entityHighlights = entity?.highlights || [];
    const recipeHighlights = recipe ? [
      ...recipe.positiveHighlights,
      ...recipe.negativeHighlights,
      ...recipe.redFlags
    ] : [];
    
    // Combine and dedupe
    const all = [...new Set([...entityHighlights, ...recipeHighlights])];
    return all.map(h => ({
      id: h,
      label: h.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      isPositive: recipe?.positiveHighlights.includes(h),
      isNegative: recipe?.negativeHighlights.includes(h),
      isRedFlag: recipe?.redFlags.includes(h),
      isFromEntity: entityHighlights.includes(h)
    }));
  }, [entity, recipe]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  const toggleDatapoint = useCallback((datapoint: string) => {
    setSelectedDatapoints(prev => 
      prev.includes(datapoint)
        ? prev.filter(d => d !== datapoint)
        : [...prev, datapoint]
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!entity || !selectedAction || !activePersona) return;
    
    setIsSubmitting(true);
    
    try {
      const userAgreed = aiRecommendation 
        ? (selectedAction === 'like' && aiRecommendation.includes('PASS')) ||
          (selectedAction === 'dislike' && !aiRecommendation.includes('PASS'))
        : undefined;
      
      await submitFeedback({
        entityId: entity.id,
        entityType: entity.type,
        action: selectedAction,
        datapoints: selectedDatapoints,
        note: note || undefined,
        aiScore,
        aiRecommendation,
        userAgreed
      });
      
      // Reset state
      setSelectedAction(null);
      setSelectedDatapoints([]);
      setNote('');
      
      bottomSheetRef.current?.close();
      onComplete?.();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [entity, selectedAction, selectedDatapoints, note, aiScore, aiRecommendation, activePersona, submitFeedback, bottomSheetRef, onComplete]);

  if (!entity) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetView style={styles.contentContainer}>
        <Text style={styles.title}>Provide Feedback</Text>
        <Text style={styles.entityName}>{entity.name}</Text>
        
        {/* AI Recommendation */}
        {aiScore !== undefined && (
          <View style={styles.aiSection}>
            <Text style={styles.aiLabel}>AI Assessment</Text>
            <View style={styles.aiRow}>
              <Text style={styles.aiScore}>{aiScore}/100</Text>
              <Text style={[
                styles.aiRecommendation,
                aiRecommendation?.includes('STRONG') && styles.aiStrong,
                aiRecommendation?.includes('PASS') && !aiRecommendation?.includes('STRONG') && styles.aiSoft,
                aiRecommendation?.includes('BORDERLINE') && styles.aiBorderline,
                !aiRecommendation?.includes('PASS') && !aiRecommendation?.includes('BORDERLINE') && styles.aiPass
              ]}>
                {aiRecommendation}
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.likeButton,
              selectedAction === 'like' && styles.likeButtonActive
            ]}
            onPress={() => setSelectedAction('like')}
          >
            <Text style={styles.actionEmoji}>👍</Text>
            <Text style={[
              styles.actionText,
              selectedAction === 'like' && styles.actionTextActive
            ]}>Like</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.dislikeButton,
              selectedAction === 'dislike' && styles.dislikeButtonActive
            ]}
            onPress={() => setSelectedAction('dislike')}
          >
            <Text style={styles.actionEmoji}>👎</Text>
            <Text style={[
              styles.actionText,
              selectedAction === 'dislike' && styles.actionTextActive
            ]}>Dislike</Text>
          </TouchableOpacity>
        </View>

        {/* Datapoints */}
        <Text style={styles.sectionTitle}>Select Datapoints (Why?)</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.datapointsScroll}
          contentContainerStyle={styles.datapointsContainer}
        >
          {availableDatapoints.slice(0, 12).map((dp) => (
            <TouchableOpacity
              key={dp.id}
              style={[
                styles.datapointChip,
                dp.isPositive && styles.datapointPositive,
                dp.isNegative && styles.datapointNegative,
                dp.isRedFlag && styles.datapointRedFlag,
                dp.isFromEntity && styles.datapointFromEntity,
                selectedDatapoints.includes(dp.id) && styles.datapointSelected
              ]}
              onPress={() => toggleDatapoint(dp.id)}
            >
              <Text style={[
                styles.datapointText,
                selectedDatapoints.includes(dp.id) && styles.datapointTextSelected
              ]}>
                {dp.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Note */}
        <Text style={styles.sectionTitle}>Note (Optional)</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="Add a note about your decision..."
          placeholderTextColor="#666688"
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={2}
        />

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedAction || isSubmitting) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!selectedAction || isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Saving...' : 'Submit Feedback'}
          </Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: '#4a4a6a',
    width: 40,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  entityName: {
    fontSize: 16,
    color: '#aaaacc',
    marginBottom: 16,
  },
  aiSection: {
    backgroundColor: '#252540',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  aiLabel: {
    fontSize: 12,
    color: '#8888aa',
    marginBottom: 4,
  },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiScore: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  aiRecommendation: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiStrong: {
    backgroundColor: colors.primary + '33',
    color: colors.primary,
  },
  aiSoft: {
    backgroundColor: colors.warning + '33',
    color: colors.warning,
  },
  aiBorderline: {
    backgroundColor: '#f9731633',
    color: '#f97316',
  },
  aiPass: {
    backgroundColor: colors.destructive + '33',
    color: colors.destructive,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  likeButton: {
    backgroundColor: colors.primary + '11',
    borderColor: colors.primary + '44',
  },
  likeButtonActive: {
    backgroundColor: colors.primary + '33',
    borderColor: colors.primary,
  },
  dislikeButton: {
    backgroundColor: colors.destructive + '11',
    borderColor: colors.destructive + '44',
  },
  dislikeButtonActive: {
    backgroundColor: colors.destructive + '33',
    borderColor: colors.destructive,
  },
  actionEmoji: {
    fontSize: 24,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888899',
  },
  actionTextActive: {
    color: '#ffffff',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8888aa',
    marginBottom: 8,
  },
  datapointsScroll: {
    marginBottom: 16,
  },
  datapointsContainer: {
    gap: 8,
    paddingRight: 20,
  },
  datapointChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#252540',
    borderWidth: 1,
    borderColor: '#3a3a5a',
  },
  datapointPositive: {
    borderColor: colors.primary + '44',
  },
  datapointNegative: {
    borderColor: '#eab30844',
  },
  datapointRedFlag: {
    borderColor: '#ef444444',
  },
  datapointFromEntity: {
    backgroundColor: '#2a2a4a',
  },
  datapointSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  datapointText: {
    fontSize: 13,
    color: '#aaaacc',
  },
  datapointTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  noteInput: {
    backgroundColor: '#252540',
    borderRadius: 12,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 20,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#4a4a6a',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

