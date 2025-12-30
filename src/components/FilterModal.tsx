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
import { colors } from "../theme/colors";

export interface FilterOptions {
  // General
  seniority?: string[];
  yearsOfExperience?: {
    min?: number;
    max?: number;
  };
  location?: string[];
  
  // Experience
  department?: string[];
  hasCurrentPosition?: boolean;
  
  // Companies
  companyIndustries?: string[];
  companySize?: string[];
  companyGrowthStage?: string[];
  
  // Revenue
  minRevenue?: number;
  minGrowthRate?: number;

  // Education
  educationLevel?: string[];
  fieldOfStudy?: string[];
  
  // People Highlights
  highlights?: string[];
  
  // Social
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

type FilterSection = "general" | "experience" | "companies" | "revenue" | "education" | "social";

// Filter Options (matching backend format)
const SENIORITY_OPTIONS = [
  { label: "Entry Level", value: "entry_level" },
  { label: "Mid Level", value: "mid_level" },
  { label: "Senior", value: "senior" },
  { label: "Lead", value: "lead" },
  { label: "Principal", value: "principal" },
  { label: "Director", value: "director" },
  { label: "VP", value: "vp" },
  { label: "C-Level", value: "c_level" },
  { label: "Executive Level", value: "executive_level" },
];

const DEPARTMENT_OPTIONS = [
  { label: "Engineering", value: "engineering" },
  { label: "Product", value: "product" },
  { label: "Design", value: "design" },
  { label: "Sales", value: "sales" },
  { label: "Marketing", value: "marketing" },
  { label: "Operations", value: "operations" },
  { label: "Finance", value: "finance" },
  { label: "Legal", value: "legal" },
  { label: "HR", value: "hr" },
  { label: "Customer Success", value: "customer_success" },
];

const INDUSTRY_OPTIONS = [
  { label: "SaaS", value: "saas" },
  { label: "Fintech", value: "fintech" },
  { label: "Healthcare", value: "healthcare" },
  { label: "E-commerce", value: "ecommerce" },
  { label: "Enterprise Software", value: "enterprise_software" },
  { label: "Consumer", value: "consumer" },
  { label: "AI/ML", value: "ai_ml" },
  { label: "Biotech", value: "biotech" },
  { label: "Hardware", value: "hardware" },
];

const COMPANY_SIZE_OPTIONS = [
  { label: "1-10", value: "1-10" },
  { label: "11-50", value: "11-50" },
  { label: "51-200", value: "51-200" },
  { label: "201-500", value: "201-500" },
  { label: "501-1000", value: "501-1000" },
  { label: "1000+", value: "1000+" },
];

const GROWTH_STAGE_OPTIONS = [
  { label: "Pre-Seed", value: "pre_seed" },
  { label: "Seed", value: "seed" },
  { label: "Series A", value: "series_a" },
  { label: "Series B", value: "series_b" },
  { label: "Series C+", value: "series_c_plus" },
  { label: "Public", value: "public" },
];

const REVENUE_RANGE_OPTIONS = [
  { label: "$0 - $1M", value: 1000000 },
  { label: "$1M - $10M", value: 10000000 },
  { label: "$10M - $50M", value: 50000000 },
  { label: "$50M+", value: 100000000 },
];

const GROWTH_RATE_OPTIONS = [
  { label: "10%+", value: 10 },
  { label: "25%+", value: 25 },
  { label: "50%+", value: 50 },
  { label: "100%+", value: 100 },
];

const EDUCATION_LEVEL_OPTIONS = [
  { label: "High School", value: "high_school" },
  { label: "Bachelor's", value: "bachelors" },
  { label: "Master's", value: "masters" },
  { label: "MBA", value: "mba" },
  { label: "PhD", value: "phd" },
];

const FIELD_OF_STUDY_OPTIONS = [
  { label: "Computer Science", value: "computer_science" },
  { label: "Engineering", value: "engineering" },
  { label: "Business", value: "business" },
  { label: "Design", value: "design" },
  { label: "Economics", value: "economics" },
  { label: "Mathematics", value: "mathematics" },
];

const HIGHLIGHT_OPTIONS = [
  { label: "Fortune 500", value: "fortune_500_experience" },
  { label: "Unicorn Experience", value: "unicorn_experience" },
  { label: "VC Backed Founder", value: "vc_backed_founder" },
  { label: "Serial Founder", value: "serial_founder" },
  { label: "Successful Exit", value: "successful_exit" },
  { label: "IPO Experience", value: "ipo_experience" },
  { label: "YC Alumni", value: "yc_alumni" },
];

export default function FilterModal({
  visible,
  onClose,
  onApply,
  currentFilters,
}: FilterModalProps) {
  const [filters, setFilters] = useState<FilterOptions>(currentFilters);
  const [expandedSections, setExpandedSections] = useState<Set<FilterSection>>(
    new Set(["general"])
  );

  const toggleSection = (section: FilterSection) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleApply = () => {
    if (__DEV__) {
      console.log("🔍 Applying filters:", filters);
    }
    onApply(filters);
    onClose();
  };

  const handleReset = () => {
    const emptyFilters: FilterOptions = {};
    setFilters(emptyFilters);
    onApply(emptyFilters);
  };

  const toggleArrayFilter = (key: keyof FilterOptions, value: string) => {
    const current = (filters[key] as string[]) || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setFilters({ ...filters, [key]: updated.length > 0 ? updated : undefined });
  };

  const renderAccordionSection = (
    section: FilterSection,
    title: string,
    count: number,
    content: React.ReactNode
  ) => (
    <View key={section} style={styles.accordionSection}>
      <Pressable
        onPress={() => toggleSection(section)}
        style={styles.accordionHeader}
      >
        <View style={styles.accordionHeaderLeft}>
          <Text style={styles.accordionTitle}>{title}</Text>
          {count > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{count}</Text>
            </View>
          )}
        </View>
        <Ionicons
          name={expandedSections.has(section) ? "chevron-up" : "chevron-down"}
          size={20}
          color="#4B5563"
        />
      </Pressable>
      {expandedSections.has(section) && (
        <View style={styles.accordionContent}>{content}</View>
      )}
    </View>
  );

  // Count active filters per section
  const generalCount =
    (filters.seniority?.length || 0) +
    (filters.location?.length || 0) +
    (filters.yearsOfExperience ? 1 : 0);
  const experienceCount =
    (filters.department?.length || 0) + (filters.hasCurrentPosition ? 1 : 0);
  const companiesCount =
    (filters.companyIndustries?.length || 0) +
    (filters.companySize?.length || 0) +
    (filters.companyGrowthStage?.length || 0);
  const educationCount =
    (filters.educationLevel?.length || 0) + (filters.fieldOfStudy?.length || 0);
  const revenueCount =
    (filters.minRevenue ? 1 : 0) + (filters.minGrowthRate ? 1 : 0);
  const socialCount =
    (filters.hasLinkedIn ? 1 : 0) +
    (filters.hasTwitter ? 1 : 0) +
    (filters.hasGitHub ? 1 : 0);

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
              <Ionicons name="close" size={24} color="#111827" />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* General Section */}
            {renderAccordionSection(
              "general",
              "General",
              generalCount,
              <>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Seniority Level</Text>
                  <View style={styles.optionsGrid}>
                    {SENIORITY_OPTIONS.map((option) => (
                      <Pressable
                        key={option.value}
                        onPress={() => toggleArrayFilter("seniority", option.value)}
                        style={[
                          styles.optionChip,
                          filters.seniority?.includes(option.value) &&
                            styles.optionChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            filters.seniority?.includes(option.value) &&
                              styles.optionChipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            )}

            {/* Experience Section */}
            {renderAccordionSection(
              "experience",
              "Experience",
              experienceCount,
              <>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Department</Text>
                  <View style={styles.optionsGrid}>
                    {DEPARTMENT_OPTIONS.map((option) => (
                      <Pressable
                        key={option.value}
                        onPress={() => toggleArrayFilter("department", option.value)}
                        style={[
                          styles.optionChip,
                          filters.department?.includes(option.value) &&
                            styles.optionChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            filters.department?.includes(option.value) &&
                              styles.optionChipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Has Current Position</Text>
                  <Switch
                    value={filters.hasCurrentPosition || false}
                    onValueChange={(value) =>
                      setFilters({
                        ...filters,
                        hasCurrentPosition: value || undefined,
                      })
                    }
                    trackColor={{ false: "#E5E7EB", true: "#4299E1" }}
                    thumbColor="white"
                  />
                </View>
              </>
            )}

            {/* Companies Section */}
            {renderAccordionSection(
              "companies",
              "Companies",
              companiesCount,
              <>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Industry</Text>
                  <View style={styles.optionsGrid}>
                    {INDUSTRY_OPTIONS.map((option) => (
                      <Pressable
                        key={option.value}
                        onPress={() =>
                          toggleArrayFilter("companyIndustries", option.value)
                        }
                        style={[
                          styles.optionChip,
                          filters.companyIndustries?.includes(option.value) &&
                            styles.optionChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            filters.companyIndustries?.includes(option.value) &&
                              styles.optionChipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Company Size</Text>
                  <View style={styles.optionsGrid}>
                    {COMPANY_SIZE_OPTIONS.map((option) => (
                      <Pressable
                        key={option.value}
                        onPress={() => toggleArrayFilter("companySize", option.value)}
                        style={[
                          styles.optionChip,
                          filters.companySize?.includes(option.value) &&
                            styles.optionChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            filters.companySize?.includes(option.value) &&
                              styles.optionChipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Growth Stage</Text>
                  <View style={styles.optionsGrid}>
                    {GROWTH_STAGE_OPTIONS.map((option) => (
                      <Pressable
                        key={option.value}
                        onPress={() =>
                          toggleArrayFilter("companyGrowthStage", option.value)
                        }
                        style={[
                          styles.optionChip,
                          filters.companyGrowthStage?.includes(option.value) &&
                            styles.optionChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            filters.companyGrowthStage?.includes(option.value) &&
                              styles.optionChipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            )}

            {/* Revenue Section */}
            {renderAccordionSection(
              "revenue",
              "Revenue & Growth",
              revenueCount,
              <>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Min Revenue</Text>
                  <View style={styles.optionsGrid}>
                    {REVENUE_RANGE_OPTIONS.map((option) => (
                      <Pressable
                        key={option.value}
                        onPress={() => setFilters({ ...filters, minRevenue: filters.minRevenue === option.value ? undefined : option.value })}
                        style={[
                          styles.optionChip,
                          filters.minRevenue === option.value && styles.optionChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            filters.minRevenue === option.value && styles.optionChipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Min Growth Rate</Text>
                  <View style={styles.optionsGrid}>
                    {GROWTH_RATE_OPTIONS.map((option) => (
                      <Pressable
                        key={option.value}
                        onPress={() => setFilters({ ...filters, minGrowthRate: filters.minGrowthRate === option.value ? undefined : option.value })}
                        style={[
                          styles.optionChip,
                          filters.minGrowthRate === option.value && styles.optionChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            filters.minGrowthRate === option.value && styles.optionChipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            )}

            {/* Education Section */}
            {renderAccordionSection(
              "education",
              "Education",
              educationCount,
              <>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Education Level</Text>
                  <View style={styles.optionsGrid}>
                    {EDUCATION_LEVEL_OPTIONS.map((option) => (
                      <Pressable
                        key={option.value}
                        onPress={() =>
                          toggleArrayFilter("educationLevel", option.value)
                        }
                        style={[
                          styles.optionChip,
                          filters.educationLevel?.includes(option.value) &&
                            styles.optionChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            filters.educationLevel?.includes(option.value) &&
                              styles.optionChipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Field of Study</Text>
                  <View style={styles.optionsGrid}>
                    {FIELD_OF_STUDY_OPTIONS.map((option) => (
                      <Pressable
                        key={option.value}
                        onPress={() =>
                          toggleArrayFilter("fieldOfStudy", option.value)
                        }
                        style={[
                          styles.optionChip,
                          filters.fieldOfStudy?.includes(option.value) &&
                            styles.optionChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            filters.fieldOfStudy?.includes(option.value) &&
                              styles.optionChipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            )}

            {/* Social Section */}
            {renderAccordionSection(
              "social",
              "Social & Highlights",
              socialCount + (filters.highlights?.length || 0),
              <>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>People Highlights</Text>
                  <View style={styles.optionsGrid}>
                    {HIGHLIGHT_OPTIONS.map((option) => (
                      <Pressable
                        key={option.value}
                        onPress={() => toggleArrayFilter("highlights", option.value)}
                        style={[
                          styles.optionChip,
                          filters.highlights?.includes(option.value) &&
                            styles.optionChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            filters.highlights?.includes(option.value) &&
                              styles.optionChipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Social Profiles</Text>
                  <View style={styles.switchRow}>
                    <View style={styles.switchItem}>
                      <Ionicons name="logo-linkedin" size={20} color="#0077b5" />
                      <Text style={styles.switchLabel}>Has LinkedIn</Text>
                    </View>
                    <Switch
                      value={filters.hasLinkedIn || false}
                      onValueChange={(value) =>
                        setFilters({ ...filters, hasLinkedIn: value || undefined })
                      }
                      trackColor={{ false: "#E5E7EB", true: "#4299E1" }}
                      thumbColor="white"
                    />
                  </View>
                  <View style={styles.switchRow}>
                    <View style={styles.switchItem}>
                      <Ionicons name="logo-twitter" size={20} color="#1da1f2" />
                      <Text style={styles.switchLabel}>Has Twitter</Text>
                    </View>
                    <Switch
                      value={filters.hasTwitter || false}
                      onValueChange={(value) =>
                        setFilters({ ...filters, hasTwitter: value || undefined })
                      }
                      trackColor={{ false: "#E5E7EB", true: "#4299E1" }}
                      thumbColor="white"
                    />
                  </View>
                  <View style={styles.switchRow}>
                    <View style={styles.switchItem}>
                      <Ionicons name="logo-github" size={20} color="#333333" />
                      <Text style={styles.switchLabel}>Has GitHub</Text>
                    </View>
                    <Switch
                      value={filters.hasGitHub || false}
                      onValueChange={(value) =>
                        setFilters({ ...filters, hasGitHub: value || undefined })
                      }
                      trackColor={{ false: "#E5E7EB", true: "#4299E1" }}
                      thumbColor="white"
                    />
                  </View>
                </View>
              </>
            )}
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
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 0,
    paddingVertical: 8,
  },
  accordionSection: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "white",
  },
  accordionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  accordionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  countBadge: {
    backgroundColor: "#4299E1",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "white",
  },
  accordionContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#F9FAFB",
  },
  filterGroup: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
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
    borderRadius: 8,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  optionChipActive: {
    backgroundColor: "#4299E1",
    borderColor: "#4299E1",
  },
  optionChipText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  optionChipTextActive: {
    color: "white",
    fontWeight: "600",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    backgroundColor: "white",
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  switchItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  switchLabel: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "white",
  },
  resetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  applyButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#4299E1",
    alignItems: "center",
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});
