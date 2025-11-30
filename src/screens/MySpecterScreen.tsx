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
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";

type MySpecterTab = "searches" | "lists" | "landscapes" | "integrations";

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  count?: number;
  onPress?: () => void;
}

function MenuItem({ icon, label, description, count, onPress }: MenuItemProps) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuIconContainer}>
        <Ionicons name={icon} size={22} color={colors.brand.green} />
      </View>
      <View style={styles.menuContent}>
        <View style={styles.menuHeader}>
          <Text style={styles.menuLabel}>{label}</Text>
          {count !== undefined && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{count}</Text>
            </View>
          )}
        </View>
        <Text style={styles.menuDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
    </Pressable>
  );
}

export default function MySpecterScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.breadcrumbs}>
          <Ionicons name="bookmark" size={20} color={colors.brand.green} />
          <Text style={styles.breadcrumbText}>My Specter</Text>
        </View>
        <Text style={styles.title}>My Specter</Text>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.quickActions}>
            <Pressable style={styles.quickAction}>
              <View style={[styles.quickIcon, { backgroundColor: colors.tag.blue.bg }]}>
                <Ionicons name="search" size={20} color={colors.tag.blue.text} />
              </View>
              <Text style={styles.quickLabel}>Searches</Text>
            </Pressable>
            <Pressable style={styles.quickAction}>
              <View style={[styles.quickIcon, { backgroundColor: colors.tag.green.bg }]}>
                <Ionicons name="list" size={20} color={colors.tag.green.text} />
              </View>
              <Text style={styles.quickLabel}>Lists</Text>
            </Pressable>
            <Pressable style={styles.quickAction}>
              <View style={[styles.quickIcon, { backgroundColor: colors.tag.purple.bg }]}>
                <Ionicons name="map-outline" size={20} color={colors.tag.purple.text} />
              </View>
              <Text style={styles.quickLabel}>Landscapes</Text>
            </Pressable>
            <Pressable style={styles.quickAction}>
              <View style={[styles.quickIcon, { backgroundColor: colors.tag.orange.bg }]}>
                <Ionicons name="git-branch-outline" size={20} color={colors.tag.orange.text} />
              </View>
              <Text style={styles.quickLabel}>Integrations</Text>
            </Pressable>
          </View>
        </View>

        {/* Menu items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved Content</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="search-outline"
              label="Saved Searches"
              description="Access your saved company and people searches"
              count={12}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="list-outline"
              label="Lists"
              description="Manage your custom lists of companies and people"
              count={5}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="map-outline"
              label="Landscapes"
              description="View competitive landscape analyses"
              count={3}
            />
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings & Integrations</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="git-branch-outline"
              label="Integrations"
              description="Connect CRM and other tools"
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="notifications-outline"
              label="Notifications"
              description="Manage alert preferences"
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="settings-outline"
              label="Settings"
              description="Account and app settings"
              onPress={() => navigation.navigate("Settings" as never)}
            />
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Activity</Text>
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>247</Text>
              <Text style={styles.statLabel}>Companies Viewed</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>89</Text>
              <Text style={styles.statLabel}>People Liked</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>34</Text>
              <Text style={styles.statLabel}>Added to CRM</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
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
    color: colors.text.secondary,
    fontWeight: "500",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 20,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.tertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  quickAction: {
    flex: 1,
    backgroundColor: colors.card.bg,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.text.secondary,
    textAlign: "center",
  },
  menuCard: {
    backgroundColor: colors.card.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.brand.green + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  menuContent: {
    flex: 1,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
  },
  countBadge: {
    backgroundColor: colors.brand.green,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text.inverse,
  },
  menuDescription: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.content.border,
    marginLeft: 66,
  },
  statsCard: {
    flexDirection: "row",
    backgroundColor: colors.card.bg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.brand.green,
  },
  statLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    textAlign: "center",
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.content.border,
    marginHorizontal: 12,
  },
});

