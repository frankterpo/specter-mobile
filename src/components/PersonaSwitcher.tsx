// Persona Switcher Component
// Bottom sheet for switching between investor personas

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { usePersona } from '../context/PersonaContext';

const { width } = Dimensions.get('window');

interface PersonaSwitcherProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
}

export function PersonaSwitcher({ bottomSheetRef }: PersonaSwitcherProps) {
  const { personas, activePersona, switchPersona } = usePersona();

  const snapPoints = useMemo(() => ['50%'], []);

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

  const handleSelectPersona = useCallback(async (personaId: string) => {
    await switchPersona(personaId);
    bottomSheetRef.current?.close();
  }, [switchPersona, bottomSheetRef]);

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
        <Text style={styles.title}>Select Persona</Text>
        <Text style={styles.subtitle}>
          Each persona has different criteria for evaluating candidates
        </Text>

        <View style={styles.personaList}>
          {personas.map((persona) => {
            const isActive = persona.id === activePersona?.id;
            
            return (
              <TouchableOpacity
                key={persona.id}
                style={[
                  styles.personaCard,
                  isActive && styles.personaCardActive
                ]}
                onPress={() => handleSelectPersona(persona.id)}
                activeOpacity={0.7}
              >
                <View style={styles.personaHeader}>
                  <Text style={styles.personaName}>{persona.name}</Text>
                  {isActive && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.personaDescription}>{persona.description}</Text>
                
                {persona.recipe && (
                  <View style={styles.signalsContainer}>
                    <Text style={styles.signalsLabel}>Key signals:</Text>
                    <Text style={styles.signalsText}>
                      {persona.recipe.positiveHighlights.slice(0, 3).map(h => 
                        h.replace(/_/g, ' ')
                      ).join(', ')}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
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
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8888aa',
    marginBottom: 20,
  },
  personaList: {
    gap: 12,
  },
  personaCard: {
    backgroundColor: '#252540',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  personaCardActive: {
    borderColor: '#6366f1',
    backgroundColor: '#2a2a4a',
  },
  personaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  personaName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  activeBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  personaDescription: {
    fontSize: 14,
    color: '#aaaacc',
    marginBottom: 12,
  },
  signalsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  signalsLabel: {
    fontSize: 12,
    color: '#6666aa',
    marginRight: 4,
  },
  signalsText: {
    fontSize: 12,
    color: '#22c55e',
    flex: 1,
  },
});

