import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface FilterOptions {
  seniority?: string[];
  yearsOfExperience?: {
    min?: number;
    max?: number;
  };
  location?: string[];
  highlights?: string[];
  hasLinkedIn?: boolean;
  hasTwitter?: boolean;
  hasGitHub?: boolean;
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterOptions) => void;
  currentFilters: FilterOptions;
}

const SENIORITY_OPTIONS = [
  "Entry Level",
  "Mid Level",
  "Senior",
  "Lead",
  "Principal",
  "Director",
  "VP",
  "C-Level",
];

const HIGHLIGHT_OPTIONS = [
  "Fortune 500",
  "VC Backed",
  "Serial Founder",
  "Successful Exit",
  "IPO Experience",
  "YC Alumni",
];

export default function FilterModal({
  visible,
  onClose,
  onApply,
  currentFilters,
}: FilterModalProps) {
  const [filters, setFilters] = useState<FilterOptions>(currentFilters);

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleReset = () => {
    const emptyFilters: FilterOptions = {};
    setFilters(emptyFilters);
    onApply(emptyFilters);
  };

  const toggleSeniority = (seniority: string) => {
    const current = filters.seniority || [];
    const updated = current.includes(seniority)
      ? current.filter((s) => s !== seniority)
      : [...current, seniority];
    setFilters({ ...filters, seniority: updated.length > 0 ? updated : undefined });
  };

  const toggleHighlight = (highlight: string) => {
    const current = filters.highlights || [];
    const updated = current.includes(highlight)
      ? current.filter((h) => h !== highlight)
      : [...current, highlight];
    setFilters({ ...filters, highlights: updated.length > 0 ? updated : undefined });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Filters</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#1a365d" />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView style={styles.content}>
            {/* Seniority */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Seniority</Text>
              <View style={styles.optionsGrid}>
                {SENIORITY_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => toggleSeniority(option)}
                    style={[
                      styles.optionChip,
                      filters.seniority?.includes(option) && styles.optionChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        filters.seniority?.includes(option) && styles.optionChipTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Highlights */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Highlights</Text>
              <View style={styles.optionsGrid}>
                {HIGHLIGHT_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => toggleHighlight(option)}
                    style={[
                      styles.optionChip,
                      filters.highlights?.includes(option) && styles.optionChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        filters.highlights?.includes(option) && styles.optionChipTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Social Media */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Social Media</Text>
              <View style={styles.switchRow}>
                <View style={styles.switchItem}>
                  <Ionicons name="logo-linkedin" size={24} color="#0077b5" />
                  <Text style={styles.switchLabel}>Has LinkedIn</Text>
                </View>
                <Switch
                  value={filters.hasLinkedIn || false}
                  onValueChange={(value) => setFilters({ ...filters, hasLinkedIn: value || undefined })}
                  trackColor={{ false: "#cbd5e1", true: "#22c55e" }}
                  thumbColor="white"
                />
              </View>
              <View style={styles.switchRow}>
                <View style={styles.switchItem}>
                  <Ionicons name="logo-twitter" size={24} color="#1da1f2" />
                  <Text style={styles.switchLabel}>Has Twitter</Text>
                </View>
                <Switch
                  value={filters.hasTwitter || false}
                  onValueChange={(value) => setFilters({ ...filters, hasTwitter: value || undefined })}
                  trackColor={{ false: "#cbd5e1", true: "#22c55e" }}
                  thumbColor="white"
                />
              </View>
              <View style={styles.switchRow}>
                <View style={styles.switchItem}>
                  <Ionicons name="logo-github" size={24} color="#333333" />
                  <Text style={styles.switchLabel}>Has GitHub</Text>
                </View>
                <Switch
                  value={filters.hasGitHub || false}
                  onValueChange={(value) => setFilters({ ...filters, hasGitHub: value || undefined })}
                  trackColor={{ false: "#cbd5e1", true: "#22c55e" }}
                  thumbColor="white"
                />
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable onPress={handleReset} style={styles.resetButton}>
              <Text style={styles.resetButtonText}>Reset</Text>
            </Pressable>
            <Pressable onPress={handleApply} style={styles.applyButton}>
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a365d",
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a365d",
    marginBottom: 12,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  optionChipActive: {
    backgroundColor: "#1a365d",
    borderColor: "#1a365d",
  },
  optionChipText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  optionChipTextActive: {
    color: "white",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  switchItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  switchLabel: {
    fontSize: 15,
    color: "#1a365d",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  resetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
  },
  applyButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#1a365d",
    alignItems: "center",
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});
