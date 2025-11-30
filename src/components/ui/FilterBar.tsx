import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";

interface FilterOption {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  count?: number;
}

interface SortOption {
  id: string;
  label: string;
}

interface FilterBarProps {
  sortBy?: string;
  sortOptions?: SortOption[];
  onSortChange?: (sortId: string) => void;
  activeFilters?: string[];
  filterOptions?: FilterOption[];
  onFilterPress?: (filterId: string) => void;
  onAddFilter?: () => void;
  onClearFilters?: () => void;
}

export default function FilterBar({
  sortBy = "rank",
  sortOptions = [
    { id: "rank", label: "Rank" },
    { id: "date", label: "Date" },
    { id: "name", label: "Name" },
    { id: "funding", label: "Funding" },
  ],
  onSortChange,
  activeFilters = [],
  filterOptions = [],
  onFilterPress,
  onAddFilter,
  onClearFilters,
}: FilterBarProps) {
  const currentSort = sortOptions.find((s) => s.id === sortBy);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Sort dropdown */}
        <Pressable
          style={styles.sortButton}
          onPress={() => {
            // Cycle through sort options
            const currentIdx = sortOptions.findIndex((s) => s.id === sortBy);
            const nextIdx = (currentIdx + 1) % sortOptions.length;
            onSortChange?.(sortOptions[nextIdx].id);
          }}
        >
          <Ionicons name="swap-vertical" size={14} color={colors.text.secondary} />
          <Text style={styles.sortLabel}>Sorted by</Text>
          <Text style={styles.sortValue}>{currentSort?.label || "Rank"}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.text.tertiary} />
        </Pressable>

        {/* Active filters */}
        {activeFilters.map((filterId) => {
          const filter = filterOptions.find((f) => f.id === filterId);
          if (!filter) return null;
          return (
            <Pressable
              key={filterId}
              style={[styles.filterChip, styles.filterChipActive]}
              onPress={() => onFilterPress?.(filterId)}
            >
              {filter.icon && (
                <Ionicons name={filter.icon} size={14} color={colors.brand.green} />
              )}
              <Text style={styles.filterChipTextActive}>{filter.label}</Text>
              {filter.count !== undefined && (
                <View style={styles.filterCount}>
                  <Text style={styles.filterCountText}>{filter.count}</Text>
                </View>
              )}
              <Ionicons name="close-circle" size={16} color={colors.brand.green} />
            </Pressable>
          );
        })}

        {/* Status filter */}
        <Pressable
          style={styles.filterChip}
          onPress={() => onFilterPress?.("status")}
        >
          <Ionicons name="flag-outline" size={14} color={colors.text.secondary} />
          <Text style={styles.filterChipText}>Status</Text>
        </Pressable>

        {/* Add filter button */}
        <Pressable style={styles.addFilterBtn} onPress={onAddFilter}>
          <Ionicons name="add" size={16} color={colors.brand.blue} />
          <Text style={styles.addFilterText}>Add Filter</Text>
        </Pressable>

        {/* Clear all */}
        {activeFilters.length > 0 && (
          <Pressable style={styles.clearBtn} onPress={onClearFilters}>
            <Ionicons name="close" size={14} color={colors.error} />
            <Text style={styles.clearText}>Clear all</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.content.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.border,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.content.bgSecondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.content.border,
  },
  sortLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  sortValue: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.primary,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.content.bgSecondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.content.border,
  },
  filterChipActive: {
    backgroundColor: colors.brand.green + "10",
    borderColor: colors.brand.green,
  },
  filterChipText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.brand.green,
  },
  filterCount: {
    backgroundColor: colors.brand.green,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.text.inverse,
  },
  addFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.brand.blue,
    borderStyle: "dashed",
  },
  addFilterText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.brand.blue,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  clearText: {
    fontSize: 12,
    color: colors.error,
  },
});

