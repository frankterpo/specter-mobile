import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { Card } from "./shadcn/Card";
import { Badge } from "./shadcn/Badge";

interface SignalCardProps {
  type: 'REVENUE' | 'TALENT' | 'STRATEGIC' | 'FUNDING' | 'ACQUISITION' | 'IPO';
  item: any;
  onPress?: () => void;
}

function SignalCard({ type, item, onPress }: SignalCardProps) {
  const name = item.name || item.full_name || item.organization_name || item.company_name || "Unknown";
  const logo = item.logo_url || item.company_logo_url;
  
  const renderRevenueSignal = () => (
    <View style={styles.signalInfo}>
      <View style={styles.metricRow}>
        <Ionicons name="trending-up" size={16} color={colors.primary} />
        <Text style={styles.metricValue}>{item.growth_rate ? `${item.growth_rate}% Growth` : "High Growth"}</Text>
      </View>
      <Text style={styles.metricLabel}>
        Estimated Revenue: {item.revenue_range || item.revenue || "N/A"}
      </Text>
    </View>
  );

  const renderTalentSignal = () => (
    <View style={styles.signalInfo}>
      <View style={styles.metricRow}>
        <Ionicons name="people" size={16} color={colors.primary} />
        <Text style={styles.metricValue}>{item.hiring_surge ? "Hiring Surge" : "Team Growth"}</Text>
      </View>
      <Text style={styles.metricLabel}>
        {item.new_hires_count ? `${item.new_hires_count} new hires` : item.department || "Multiple roles"}
      </Text>
    </View>
  );

  const renderStrategicSignal = () => (
    <View style={styles.signalInfo}>
      <View style={styles.metricRow}>
        <Ionicons name="flash" size={16} color={colors.primary} />
        <Text style={styles.metricValue}>{item.signal_type || "Strategic Move"}</Text>
      </View>
      <Text style={styles.description} numberOfLines={2}>
        {item.description || "Strategic expansion or partnership detected."}
      </Text>
    </View>
  );

  const renderTransactionSignal = () => (
    <View style={styles.signalInfo}>
      <View style={styles.metricRow}>
        <Ionicons name="cash" size={16} color={colors.primary} />
        <Text style={styles.metricValue}>
          {item.amount_usd ? `$${(item.amount_usd / 1e6).toFixed(1)}M` : item.deal_type || "New Transaction"}
        </Text>
      </View>
      <Text style={styles.metricLabel}>
        {item.series || item.stage || "Deal"} • {item.date || "Recent"}
      </Text>
    </View>
  );

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.logoWrapper}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logo} contentFit="contain" />
          ) : (
            <View style={[styles.logo, styles.logoPlaceholder]}>
              <Text style={styles.logoLetter}>{name.charAt(0)}</Text>
            </View>
          )}
        </View>
        <View style={styles.titleInfo}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.industry}>{item.industry || item.industries?.[0] || "Technology"}</Text>
        </View>
        <Badge variant="outline" size="sm">
          <Text style={styles.badgeText}>{type}</Text>
        </Badge>
      </View>

      <View style={styles.content}>
        {type === 'REVENUE' && renderRevenueSignal()}
        {type === 'TALENT' && renderTalentSignal()}
        {type === 'STRATEGIC' && renderStrategicSignal()}
        {(type === 'FUNDING' || type === 'ACQUISITION' || type === 'IPO') && renderTransactionSignal()}
      </View>

      {item.location && (
        <View style={styles.footer}>
          <Ionicons name="location-outline" size={12} color={colors.text.tertiary} />
          <Text style={styles.locationText}>{item.location}</Text>
        </View>
      )}
    </Card>
  );
}

export default memo(SignalCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.content.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoWrapper: {
    marginRight: 12,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.content.bgSecondary,
  },
  logoPlaceholder: {
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  titleInfo: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  industry: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  content: {
    backgroundColor: colors.content.bg,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  signalInfo: {
    gap: 4,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  metricLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  description: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
});
