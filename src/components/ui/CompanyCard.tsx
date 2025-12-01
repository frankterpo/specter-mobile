import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { Company } from "../../api/specter";

interface CompanyCardProps {
  company: Company;
  onPress?: () => void;
  onLike?: () => void;
  onDislike?: () => void;
  onAddToList?: () => void;
}

export default function CompanyCard({
  company,
  onPress,
  onLike,
  onDislike,
  onAddToList,
}: CompanyCardProps) {
  const name = company.name || company.organization_name || "Unknown";
  const industry = company.industries?.[0] || "";
  const funding = company.funding?.total_funding_usd;
  const employees = company.employee_count || company.employee_count_range;
  
  // Get status from entity_status if available
  const status = (company as any).entity_status?.status as string | undefined;

  const formatFunding = (amount?: number) => {
    if (!amount) return null;
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
    return `$${amount}`;
  };

  const getStatusColor = () => {
    switch (status) {
      case "liked": return colors.status.liked;
      case "disliked": return colors.status.disliked;
      case "viewed": return colors.status.viewed;
      default: return null;
    }
  };

  const statusColor = getStatusColor();

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      {/* Logo */}
      <View style={styles.logoContainer}>
        {company.logo_url ? (
          <Image
            source={{ uri: company.logo_url }}
            style={styles.logo}
            contentFit="contain"
          />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoText}>{name.charAt(0)}</Text>
          </View>
        )}
        {statusColor && <View style={[styles.statusDot, { backgroundColor: statusColor }]} />}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {industry && (
            <>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.industry} numberOfLines={1}>{industry}</Text>
            </>
          )}
        </View>
        <View style={styles.metricsRow}>
          {funding && (
            <Text style={styles.metric}>{formatFunding(funding)}</Text>
          )}
          {funding && employees && <Text style={styles.metricSep}>|</Text>}
          {employees && (
            <Text style={styles.metric}>
              {typeof employees === "number" ? `${employees} emp` : employees}
            </Text>
          )}
          {!funding && !employees && company.founded_year && (
            <Text style={styles.metric}>Est. {company.founded_year}</Text>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionBtn, status === "disliked" && styles.actionActive]}
          onPress={onDislike}
          hitSlop={6}
        >
          <Ionicons
            name="close"
            size={18}
            color={status === "disliked" ? colors.error : colors.text.tertiary}
          />
        </Pressable>
        <Pressable
          style={[styles.actionBtn, status === "liked" && styles.actionActive]}
          onPress={onLike}
          hitSlop={6}
        >
          <Ionicons
            name="heart"
            size={16}
            color={status === "liked" ? colors.brand.green : colors.text.tertiary}
          />
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onAddToList} hitSlop={6}>
          <Ionicons name="add" size={18} color={colors.text.tertiary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card.bg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.borderLight,
  },
  cardPressed: {
    backgroundColor: colors.content.bgSecondary,
  },
  logoContainer: {
    position: "relative",
    marginRight: 10,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.content.bgSecondary,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.brand.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: "600",
  },
  statusDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.card.bg,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
    flexShrink: 1,
  },
  separator: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginHorizontal: 6,
  },
  industry: {
    fontSize: 12,
    color: colors.text.secondary,
    flexShrink: 1,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metric: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  metricSep: {
    fontSize: 12,
    color: colors.text.muted,
    marginHorizontal: 6,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionActive: {
    backgroundColor: colors.content.bgTertiary,
  },
});
