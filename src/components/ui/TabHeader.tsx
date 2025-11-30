import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";

interface BreadcrumbItem {
  label: string;
  onPress?: () => void;
}

interface ViewOption {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface TabHeaderProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  viewOptions?: ViewOption[];
  activeView?: string;
  onViewChange?: (viewId: string) => void;
  totalCount?: number;
  isLoading?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  onLeftPress?: () => void;
  rightAction?: React.ReactNode;
}

export default function TabHeader({
  title,
  breadcrumbs = [],
  viewOptions = [
    { id: "feed", label: "Feed", icon: "grid-outline" },
    { id: "table", label: "Table", icon: "list-outline" },
  ],
  activeView = "feed",
  onViewChange,
  totalCount,
  isLoading = false,
  leftIcon,
  onLeftPress,
  rightAction,
}: TabHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* Breadcrumbs row */}
      <View style={styles.breadcrumbRow}>
        {leftIcon && (
          <Pressable onPress={onLeftPress} hitSlop={8} style={styles.leftBtn}>
            <Ionicons name={leftIcon} size={22} color={colors.brand.green} />
          </Pressable>
        )}
        
        <View style={styles.breadcrumbs}>
          {breadcrumbs.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <Text style={styles.breadcrumbSep}>/</Text>}
              <Pressable onPress={item.onPress}>
                <Text
                  style={[
                    styles.breadcrumbText,
                    idx === breadcrumbs.length - 1 && styles.breadcrumbActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            </React.Fragment>
          ))}
        </View>

        {/* Count / Loading */}
        <View style={styles.countContainer}>
          {isLoading ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : totalCount !== undefined ? (
            <Text style={styles.countText}>{totalCount.toLocaleString()} results</Text>
          ) : null}
        </View>
      </View>

      {/* Title + View toggle row */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>

        <View style={styles.rightSection}>
          {/* View toggle */}
          {viewOptions.length > 0 && (
            <View style={styles.viewToggle}>
              {viewOptions.map((option) => (
                <Pressable
                  key={option.id}
                  style={[
                    styles.viewOption,
                    activeView === option.id && styles.viewOptionActive,
                  ]}
                  onPress={() => onViewChange?.(option.id)}
                >
                  <Ionicons
                    name={option.icon}
                    size={16}
                    color={
                      activeView === option.id
                        ? colors.brand.blue
                        : colors.text.tertiary
                    }
                  />
                  <Text
                    style={[
                      styles.viewOptionText,
                      activeView === option.id && styles.viewOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {rightAction}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.content.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.border,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  breadcrumbRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  leftBtn: {
    marginRight: 12,
  },
  breadcrumbs: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  breadcrumbText: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  breadcrumbActive: {
    color: colors.text.secondary,
    fontWeight: "500",
  },
  breadcrumbSep: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginHorizontal: 6,
  },
  countContainer: {
    marginLeft: "auto",
  },
  loadingText: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
  countText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text.primary,
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: colors.content.bgSecondary,
    borderRadius: 8,
    padding: 2,
  },
  viewOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewOptionActive: {
    backgroundColor: colors.content.bg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  viewOptionText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  viewOptionTextActive: {
    color: colors.brand.blue,
    fontWeight: "500",
  },
});

