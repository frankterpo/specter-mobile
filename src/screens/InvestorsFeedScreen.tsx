import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { SearchBar } from "../components/ui";

export default function InvestorsFeedScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"database" | "signals">("database");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.breadcrumbs}>
          <Ionicons name="trending-up" size={20} color={colors.brand.green} />
          <Text style={styles.breadcrumbText}>Investors</Text>
          <Text style={styles.breadcrumbSep}>/</Text>
          <Text style={styles.breadcrumbActive}>
            {activeTab === "database" ? "Database" : "Interest Signals"}
          </Text>
        </View>
        <Text style={styles.title}>Investors</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search investors..."
        />
      </View>

      {/* Tab switcher */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === "database" && styles.tabActive]}
          onPress={() => setActiveTab("database")}
        >
          <Ionicons
            name="grid-outline"
            size={16}
            color={activeTab === "database" ? colors.brand.blue : colors.text.tertiary}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "database" && styles.tabTextActive,
            ]}
          >
            Database
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "signals" && styles.tabActive]}
          onPress={() => setActiveTab("signals")}
        >
          <Ionicons
            name="pulse-outline"
            size={16}
            color={activeTab === "signals" ? colors.brand.blue : colors.text.tertiary}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "signals" && styles.tabTextActive,
            ]}
          >
            Interest Signals
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name={activeTab === "database" ? "business-outline" : "analytics-outline"}
              size={48}
              color={colors.text.tertiary}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {activeTab === "database" ? "Investor Database" : "Interest Signals"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === "database"
              ? "Browse and search through thousands of investors"
              : "Track investor activity and interest signals"}
          </Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={18} color={colors.brand.green} />
              <Text style={styles.featureText}>Filter by investment stage</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={18} color={colors.brand.green} />
              <Text style={styles.featureText}>Filter by sector focus</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={18} color={colors.brand.green} />
              <Text style={styles.featureText}>View portfolio companies</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.content.bgSecondary,
  },
  header: {
    backgroundColor: colors.content.bg,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.border,
  },
  breadcrumbs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  breadcrumbText: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  breadcrumbSep: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  breadcrumbActive: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: "500",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text.primary,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.content.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.border,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.content.bg,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.border,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.content.bgSecondary,
  },
  tabActive: {
    backgroundColor: colors.brand.blue + "15",
  },
  tabText: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  tabTextActive: {
    color: colors.brand.blue,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    backgroundColor: colors.card.bg,
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.content.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  featureList: {
    gap: 10,
    alignSelf: "stretch",
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
});

