import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { Company } from "../../api/specter";

interface CompanyCardProps {
  company: Company;
  onPress?: () => void;
  onLike?: () => void;
  onDislike?: () => void;
  onSave?: () => void;
}

export default function CompanyCard({
  company,
  onPress,
  onLike,
  onDislike,
  onSave,
}: CompanyCardProps) {
  const name = company.name || company.organization_name || "Unknown Company";
  const description = company.description || company.tagline || "";
  const industries = company.industries?.slice(0, 2) || [];
  const location = company.hq
    ? [company.hq.city, company.hq.country].filter(Boolean).join(", ")
    : "";
  const stage = company.growth_stage || "";
  const funding = company.funding?.total_funding_usd;
  const employeeCount = company.employee_count_range || company.employee_count;

  const formatFunding = (amount?: number) => {
    if (!amount) return null;
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
    return `$${amount}`;
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      {/* Header: Logo + Name + Actions */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          {company.logo_url ? (
            <Image
              source={{ uri: company.logo_url }}
              style={styles.logo}
              contentFit="contain"
            />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>
                {name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color={colors.text.tertiary} />
              <Text style={styles.locationText}>{location}</Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {onSave && (
            <Pressable style={styles.actionBtn} onPress={onSave} hitSlop={8}>
              <Ionicons name="bookmark-outline" size={18} color={colors.text.secondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Description */}
      {description && (
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>
      )}

      {/* Tags row */}
      <View style={styles.tagsRow}>
        {industries.map((industry, idx) => (
          <View key={idx} style={[styles.tag, styles.tagBlue]}>
            <Text style={styles.tagTextBlue}>{industry}</Text>
          </View>
        ))}
        {stage && (
          <View style={[styles.tag, styles.tagPurple]}>
            <Text style={styles.tagTextPurple}>{stage}</Text>
          </View>
        )}
      </View>

      {/* Metrics row */}
      <View style={styles.metricsRow}>
        {funding && (
          <View style={styles.metric}>
            <MaterialCommunityIcons name="cash-multiple" size={14} color={colors.brand.green} />
            <Text style={styles.metricValue}>{formatFunding(funding)}</Text>
            <Text style={styles.metricLabel}>raised</Text>
          </View>
        )}
        {employeeCount && (
          <View style={styles.metric}>
            <Ionicons name="people-outline" size={14} color={colors.brand.blue} />
            <Text style={styles.metricValue}>
              {typeof employeeCount === "number" ? employeeCount : employeeCount}
            </Text>
            <Text style={styles.metricLabel}>employees</Text>
          </View>
        )}
        {company.founded_year && (
          <View style={styles.metric}>
            <Ionicons name="calendar-outline" size={14} color={colors.text.tertiary} />
            <Text style={styles.metricValue}>{company.founded_year}</Text>
            <Text style={styles.metricLabel}>founded</Text>
          </View>
        )}
      </View>

      {/* Highlights */}
      {company.highlights && company.highlights.length > 0 && (
        <View style={styles.highlightsRow}>
          {company.highlights.slice(0, 3).map((highlight, idx) => (
            <View key={idx} style={styles.highlightBadge}>
              <Text style={styles.highlightText}>{formatHighlight(highlight)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Footer actions */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.footerBtn, styles.footerBtnDislike]}
          onPress={onDislike}
        >
          <Ionicons name="close" size={18} color={colors.error} />
          <Text style={[styles.footerBtnText, { color: colors.error }]}>Pass</Text>
        </Pressable>

        <Pressable
          style={[styles.footerBtn, styles.footerBtnLike]}
          onPress={onLike}
        >
          <Ionicons name="heart" size={18} color={colors.brand.green} />
          <Text style={[styles.footerBtnText, { color: colors.brand.green }]}>Like</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function formatHighlight(highlight: string): string {
  return highlight
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardPressed: {
    backgroundColor: colors.content.bgSecondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  logoContainer: {
    marginRight: 12,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.content.bgSecondary,
  },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.brand.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: colors.text.inverse,
    fontSize: 18,
    fontWeight: "600",
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    padding: 6,
  },
  description: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagBlue: {
    backgroundColor: colors.tag.blue.bg,
  },
  tagTextBlue: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.tag.blue.text,
  },
  tagPurple: {
    backgroundColor: colors.tag.purple.bg,
  },
  tagTextPurple: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.tag.purple.text,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  metric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.primary,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  highlightsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  highlightBadge: {
    backgroundColor: colors.tag.orange.bg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  highlightText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.tag.orange.text,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.content.border,
  },
  footerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  footerBtnDislike: {
    backgroundColor: colors.tag.red.bg,
  },
  footerBtnLike: {
    backgroundColor: colors.tag.green.bg,
  },
  footerBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
});

