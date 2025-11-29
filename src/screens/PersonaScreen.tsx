import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { getAgentMemory, InvestmentPersona, PersonaCriteria, DEFAULT_PERSONAS } from '../ai/agentMemory';
import { logger } from '../utils/logger';

// Available options for criteria
const STAGE_OPTIONS = ['stealth', 'pre-seed', 'seed', 'series_a', 'series_b', 'growth', 'late_stage'];
const SIGNAL_OPTIONS = ['new_founder', 'spinout', 'repeat_founder', 'yc_alum', 'acquisition', 'ipo', 'layoff'];
const SENIORITY_OPTIONS = ['C-Level', 'VP', 'Director', 'Founder', 'Manager', 'Individual Contributor'];
const REGION_OPTIONS = ['North America', 'Europe', 'Asia', 'LATAM', 'Middle East', 'Africa'];

export default function PersonaScreen() {
  const navigation = useNavigation();
  const [personas, setPersonas] = useState<InvestmentPersona[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPersona, setEditingPersona] = useState<InvestmentPersona | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStages, setFormStages] = useState<string[]>([]);
  const [formSignals, setFormSignals] = useState<string[]>([]);
  const [formIndustries, setFormIndustries] = useState('');
  const [formSeniority, setFormSeniority] = useState<string[]>([]);
  const [formRegions, setFormRegions] = useState<string[]>([]);
  const [formCustomCriteria, setFormCustomCriteria] = useState('');
  const [formAutoSourceLimit, setFormAutoSourceLimit] = useState('20');
  const [formConfidenceThreshold, setFormConfidenceThreshold] = useState('50');

  const loadPersonas = useCallback(async () => {
    const memory = getAgentMemory();
    await memory.load();
    setPersonas(memory.getPersonas());
    setActivePersonaId(memory.getActivePersona()?.id || null);
  }, []);

  useEffect(() => {
    loadPersonas();
  }, [loadPersonas]);

  const handleSetActive = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const memory = getAgentMemory();
    memory.setActivePersona(id);
    setActivePersonaId(id);
    logger.info('PersonaScreen', 'Set active persona', { id });
  };

  const handleDelete = (persona: InvestmentPersona) => {
    Alert.alert(
      'Delete Persona',
      `Are you sure you want to delete "${persona.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const memory = getAgentMemory();
            memory.deletePersona(persona.id);
            await loadPersonas();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleEdit = (persona: InvestmentPersona) => {
    setEditingPersona(persona);
    setFormName(persona.name);
    setFormDescription(persona.description);
    setFormStages(persona.criteria.preferredStages);
    setFormSignals(persona.criteria.preferredSignals);
    setFormIndustries(persona.criteria.industryFocus.join(', '));
    setFormSeniority(persona.criteria.seniorityPreference);
    setFormRegions(persona.criteria.regionFocus);
    setFormCustomCriteria(persona.criteria.customCriteria);
    setFormAutoSourceLimit(persona.bulkActionSettings.autoSourceLimit.toString());
    setFormConfidenceThreshold((persona.bulkActionSettings.confidenceThreshold * 100).toString());
    setIsEditing(true);
  };

  const handleCreate = () => {
    setEditingPersona(null);
    setFormName('');
    setFormDescription('');
    setFormStages([]);
    setFormSignals([]);
    setFormIndustries('');
    setFormSeniority([]);
    setFormRegions([]);
    setFormCustomCriteria('');
    setFormAutoSourceLimit('20');
    setFormConfidenceThreshold('50');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('Error', 'Please enter a name for the persona');
      return;
    }

    const memory = getAgentMemory();
    const criteria: PersonaCriteria = {
      preferredStages: formStages,
      preferredSignals: formSignals,
      industryFocus: formIndustries.split(',').map(s => s.trim()).filter(Boolean),
      seniorityPreference: formSeniority,
      regionFocus: formRegions,
      customCriteria: formCustomCriteria,
    };

    const bulkSettings = {
      autoSourceLimit: parseInt(formAutoSourceLimit) || 20,
      confidenceThreshold: (parseInt(formConfidenceThreshold) || 50) / 100,
      defaultAction: 'stage_only' as const,
      createListsAutomatically: true,
    };

    if (editingPersona) {
      memory.updatePersona(editingPersona.id, {
        name: formName,
        description: formDescription,
        criteria,
        bulkActionSettings: bulkSettings,
      });
    } else {
      memory.createPersona(formName, formDescription, criteria, bulkSettings);
    }

    await loadPersonas();
    setIsEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleInitDefaults = async () => {
    const memory = getAgentMemory();
    memory.initializeDefaultPersonas();
    await loadPersonas();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const toggleArrayItem = (array: string[], item: string, setter: (arr: string[]) => void) => {
    if (array.includes(item)) {
      setter(array.filter(i => i !== item));
    } else {
      setter([...array, item]);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const ChipSelector = ({
    label,
    options,
    selected,
    onToggle,
    color = '#3B82F6',
  }: {
    label: string;
    options: string[];
    selected: string[];
    onToggle: (item: string) => void;
    color?: string;
  }) => (
    <View style={styles.chipSection}>
      <Text style={styles.chipLabel}>{label}</Text>
      <View style={styles.chipContainer}>
        {options.map((option) => (
          <Pressable
            key={option}
            onPress={() => onToggle(option)}
            style={[
              styles.chip,
              selected.includes(option) && { backgroundColor: color + '20', borderColor: color },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                selected.includes(option) && { color },
              ]}
            >
              {option}
            </Text>
            {selected.includes(option) && (
              <Ionicons name="checkmark" size={14} color={color} />
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#1E293B" />
          </Pressable>
          <Text style={styles.title}>Investment Personas</Text>
        </View>
        <Pressable onPress={handleCreate} style={styles.addButton}>
          <Ionicons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {personas.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Personas Yet</Text>
            <Text style={styles.emptySubtitle}>
              Create investment personas to customize how the AI evaluates signals for different investment theses.
            </Text>
            <Pressable onPress={handleInitDefaults} style={styles.initButton}>
              <Ionicons name="flash" size={20} color="#FFF" />
              <Text style={styles.initButtonText}>Load Default Personas</Text>
            </Pressable>
            <Pressable onPress={handleCreate} style={styles.createButton}>
              <Ionicons name="add-circle-outline" size={20} color="#3B82F6" />
              <Text style={styles.createButtonText}>Create Custom Persona</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {personas.map((persona) => (
              <Pressable
                key={persona.id}
                onPress={() => handleSetActive(persona.id)}
                onLongPress={() => handleEdit(persona)}
                style={[
                  styles.personaCard,
                  persona.id === activePersonaId && styles.personaCardActive,
                ]}
              >
                <View style={styles.personaHeader}>
                  <View style={styles.personaHeaderLeft}>
                    {persona.id === activePersonaId && (
                      <View style={styles.activeIndicator} />
                    )}
                    <Text style={[
                      styles.personaName,
                      persona.id === activePersonaId && styles.personaNameActive,
                    ]}>
                      {persona.name}
                    </Text>
                  </View>
                  <View style={styles.personaActions}>
                    <Pressable onPress={() => handleEdit(persona)} style={styles.actionButton}>
                      <Ionicons name="pencil" size={18} color="#64748B" />
                    </Pressable>
                    <Pressable onPress={() => handleDelete(persona)} style={styles.actionButton}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
                
                <Text style={styles.personaDescription} numberOfLines={2}>
                  {persona.description}
                </Text>

                <View style={styles.criteriaPreview}>
                  {persona.criteria.preferredStages.length > 0 && (
                    <View style={styles.criteriaTag}>
                      <Text style={styles.criteriaTagText}>
                        {persona.criteria.preferredStages.slice(0, 2).join(', ')}
                        {persona.criteria.preferredStages.length > 2 && ` +${persona.criteria.preferredStages.length - 2}`}
                      </Text>
                    </View>
                  )}
                  {persona.criteria.preferredSignals.length > 0 && (
                    <View style={[styles.criteriaTag, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[styles.criteriaTagText, { color: '#B45309' }]}>
                        {persona.criteria.preferredSignals.slice(0, 2).join(', ')}
                        {persona.criteria.preferredSignals.length > 2 && ` +${persona.criteria.preferredSignals.length - 2}`}
                      </Text>
                    </View>
                  )}
                </View>

                {persona.id === activePersonaId && (
                  <View style={styles.activeLabel}>
                    <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                    <Text style={styles.activeLabelText}>Active</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={isEditing} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setIsEditing(false)} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#64748B" />
            </Pressable>
            <Text style={styles.modalTitle}>
              {editingPersona ? 'Edit Persona' : 'New Persona'}
            </Text>
            <Pressable onPress={handleSave} style={styles.modalSaveButton}>
              <Text style={styles.modalSaveButtonText}>Save</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Name */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Name *</Text>
              <TextInput
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g., Stealth Founder Hunter"
                style={styles.textInput}
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Description */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Investment Thesis</Text>
              <TextInput
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder="Describe what you're looking for with this persona..."
                style={[styles.textInput, styles.textArea]}
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Stages */}
            <ChipSelector
              label="Preferred Stages"
              options={STAGE_OPTIONS}
              selected={formStages}
              onToggle={(item) => toggleArrayItem(formStages, item, setFormStages)}
              color="#22C55E"
            />

            {/* Signals */}
            <ChipSelector
              label="Signal Types"
              options={SIGNAL_OPTIONS}
              selected={formSignals}
              onToggle={(item) => toggleArrayItem(formSignals, item, setFormSignals)}
              color="#F59E0B"
            />

            {/* Seniority */}
            <ChipSelector
              label="Seniority Preference"
              options={SENIORITY_OPTIONS}
              selected={formSeniority}
              onToggle={(item) => toggleArrayItem(formSeniority, item, setFormSeniority)}
              color="#8B5CF6"
            />

            {/* Regions */}
            <ChipSelector
              label="Region Focus"
              options={REGION_OPTIONS}
              selected={formRegions}
              onToggle={(item) => toggleArrayItem(formRegions, item, setFormRegions)}
              color="#EC4899"
            />

            {/* Industries */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Industries (comma-separated)</Text>
              <TextInput
                value={formIndustries}
                onChangeText={setFormIndustries}
                placeholder="e.g., AI, Fintech, Healthcare"
                style={styles.textInput}
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Custom Criteria */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Custom Criteria</Text>
              <TextInput
                value={formCustomCriteria}
                onChangeText={setFormCustomCriteria}
                placeholder="Any additional criteria or notes..."
                style={[styles.textInput, styles.textArea]}
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Bulk Action Settings */}
            <View style={styles.bulkSettingsSection}>
              <Text style={styles.bulkSettingsTitle}>Bulk Action Settings</Text>
              
              <View style={styles.bulkSettingsRow}>
                <View style={styles.bulkSettingInput}>
                  <Text style={styles.bulkSettingLabel}>Max Signals per Run</Text>
                  <TextInput
                    value={formAutoSourceLimit}
                    onChangeText={setFormAutoSourceLimit}
                    keyboardType="number-pad"
                    style={styles.numberInput}
                  />
                </View>
                <View style={styles.bulkSettingInput}>
                  <Text style={styles.bulkSettingLabel}>Confidence Threshold %</Text>
                  <TextInput
                    value={formConfidenceThreshold}
                    onChangeText={setFormConfidenceThreshold}
                    keyboardType="number-pad"
                    style={styles.numberInput}
                  />
                </View>
              </View>
            </View>

            <View style={{ height: 50 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  initButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  initButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 12,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
  },
  personaCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  personaCardActive: {
    borderColor: '#22C55E',
    backgroundColor: '#F0FDF4',
  },
  personaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  personaHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  activeIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
  },
  personaName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1E293B',
  },
  personaNameActive: {
    color: '#166534',
  },
  personaActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  personaDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  criteriaPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  criteriaTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  criteriaTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
  },
  activeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#BBF7D0',
  },
  activeLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22C55E',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1E293B',
  },
  modalSaveButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalSaveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  chipSection: {
    marginBottom: 20,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  bulkSettingsSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bulkSettingsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  bulkSettingsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bulkSettingInput: {
    flex: 1,
  },
  bulkSettingLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  numberInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
});

