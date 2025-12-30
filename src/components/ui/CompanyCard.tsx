import React, { memo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { Company } from "../../api/specter";
import { Card } from "./shadcn/Card";
import { Badge } from "./shadcn/Badge";
import { Button } from "./shadcn/Button";

interface CompanyCardProps {
  company: Company;
  onPress?: () => void;
  onLike?: () => void;
  onDislike?: () => void;
  onAddToList?: () => void;
}

function CompanyCard({
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
  const logo = company.logo_url;
  
  const status = (company as any).entity_status?.status;

  const formatFunding = (amount?: number) => {
    if (!amount) return null;
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
    return `$${amount}`;
  };

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoWrapper}>
          {logo ? (
            <Image
              source={{
                uri: logo,
                // Enable caching for better performance
                cacheKey: `company-logo-${logo.split('/').pop()}`,
              }}
              style={styles.logo}
              contentFit="contain"
              // Enable disk caching
              cachePolicy="disk"
              // Smooth transition for loading
              transition={200}
            />
          ) : (
            <View style={[styles.logo, styles.logoPlaceholder]}>
              <Text style={styles.logoLetter}>{name.charAt(0)}</Text>
            </View>
          )}
          {status && (
            <View style={[
              styles.statusBadge, 
              status === "liked" ? styles.statusLiked : 
              status === "disliked" ? styles.statusDisliked : styles.statusViewed
            ]}>
              <Ionicons 
                name={status === "liked" ? "heart" : status === "disliked" ? "close" : "eye"} 
                size={10} 
                color="#FFF" 
              />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.topRow}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            {company.operating_status === "Active" ? (
              <View style={styles.activeDot} />
            ) : null}
          </View>
          
          <Text style={styles.industry} numberOfLines={1}>
            {industry || "Technology"}
          </Text>

          <View style={styles.metrics}>
            {funding ? (
              <View style={styles.metricItem}>
                <Ionicons name="cash-outline" size={12} color={colors.text.tertiary} />
                <Text style={styles.metricText}>{formatFunding(funding)}</Text>
              </View>
            ) : null}
            {employees ? (
              <View style={styles.metricItem}>
                <Ionicons name="people-outline" size={12} color={colors.text.tertiary} />
                <Text style={styles.metricText}>
                  {typeof employees === "number" ? employees.toLocaleString() : employees}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            variant="ghost"
            size="icon"
            icon="add"
            onPress={onAddToList}
            style={styles.actionButton}
          />
          <Button
            variant="ghost"
            size="icon"
            icon="chevron-forward"
            style={styles.actionButton}
          />
        </View>
      </View>
      
      {/* Highlights */}
      {company.highlights && company.highlights.length > 0 && (
        <View style={styles.highlights}>
          {company.highlights.slice(0, 2).map((h, i) => (
            <Badge key={i} variant="secondary" size="sm" style={styles.highlightChip}>
              <Text style={styles.highlightText} numberOfLines={1}>{h.replace(/_/g, " ")}</Text>
            </Badge>
          ))}
        </View>
      )}
    </Card>
  );
}

export default memo(CompanyCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    padding: 24,
    gap: 12,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoWrapper: {
    position: "relative",
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.content.bgSecondary,
    borderWidth: 1,
    borderColor: colors.content.borderLight,
  },
  logoPlaceholder: {
    backgroundColor: colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary,
  },
  statusBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  statusLiked: { backgroundColor: colors.success },
  statusDisliked: { backgroundColor: colors.error },
  statusViewed: { backgroundColor: colors.primary },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  industry: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
    fontWeight: "500",
  },
  metrics: {
    flexDirection: "row",
    marginTop: 6,
    gap: 12,
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricText: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionButton: {
    width: 32,
    height: 32,
  },
  highlights: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.content.borderLight,
    paddingTop: 12,
  },
  highlightChip: {
    maxWidth: "48%",
  },
  highlightText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: "600",
    textTransform: "capitalize",
  },
});
