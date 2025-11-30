import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { SearchBar } from "../components/ui";

type TransactionType = "funding" | "acquisitions" | "ipos";

export default function TransactionsFeedScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TransactionType>("funding");
  const [searchQuery, setSearchQuery] = useState("");

  const tabs: { id: TransactionType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: "funding", label: "Funding Rounds", icon: "cash-outline" },
    { id: "acquisitions", label: "Acquisitions", icon: "business-outline" },
    { id: "ipos", label: "IPOs", icon: "trending-up-outline" },
  ];

  const getEmptyContent = () => {
    switch (activeTab) {
      case "funding":
        return {
          icon: "cash-multiple" as const,
          title: "Funding Rounds",
          subtitle: "Track the latest venture capital funding rounds",
          features: [
            "Filter by round type (Seed, Series A, etc.)",
            "Filter by industry and geography",
            "View investor participation",
          ],
        };
      case "acquisitions":
        return {
          icon: "handshake" as const,
          title: "Acquisitions",
          subtitle: "Monitor M&A activity in your sector",
          features: [
            "Filter by acquisition type",
            "Track strategic acquirers",
            "View deal valuations",
          ],
        };
      case "ipos":
        return {
          icon: "chart-line-variant" as const,
          title: "IPOs",
          subtitle: "Track upcoming and recent public offerings",
          features: [
            "Filter by exchange",
            "View offering details",
            "Track performance metrics",
          ],
        };
    }
  };

  const content = getEmptyContent();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.breadcrumbs}>
          <Ionicons name="cash" size={20} color={colors.brand.green} />
          <Text style={styles.breadcrumbText}>Transactions</Text>
          <Text style={styles.breadcrumbSep}>/</Text>
          <Text style={styles.breadcrumbActive}>
            {tabs.find((t) => t.id === activeTab)?.label}
          </Text>
        </View>
        <Text style={styles.title}>Transactions</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search transactions..."
        />
      </View>

      {/* Tab switcher */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBarScroll}
        contentContainerStyle={styles.tabBar}
      >
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === tab.id ? colors.brand.blue : colors.text.tertiary}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === tab.id && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons
              name={content.icon}
              size={48}
              color={colors.text.tertiary}
            />
          </View>
          <Text style={styles.emptyTitle}>{content.title}</Text>
          <Text style={styles.emptySubtitle}>{content.subtitle}</Text>
          <View style={styles.featureList}>
            {content.features.map((feature, idx) => (
              <View key={idx} style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={18} color={colors.brand.green} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
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
  tabBarScroll: {
    backgroundColor: colors.content.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.border,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
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

