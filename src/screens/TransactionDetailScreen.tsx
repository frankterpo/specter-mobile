import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge } from "../components/ui/shadcn/Badge";
import { GlassCard } from "../components/ui/glass/GlassCard";
import { GlassButton } from "../components/ui/glass/GlassButton";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { format } from "date-fns";

export default function TransactionDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { type, item } = route.params || {};

  const name = item.companyName || item.acquiredName || item.organization_name || item.name || "Transaction Detail";
  const date = item.announcedOn || item.acquiredOn || item.wentPublicOn || item.date;
  const amount = item.raisedAmount || item.acquisitionPrice || item.sharePrice || item.amount_usd;

  const formatCurrency = (val?: number) => {
    if (!val) return "Undisclosed";
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    return `$${val.toLocaleString()}`;
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.sidebar.bg, colors.primary + '30', colors.background]}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <GlassButton icon="arrow-back" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle} numberOfLines={1}>Transaction</Text>
        <GlassButton icon="share-outline" />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.delay(200)} style={styles.hero}>
          <Badge variant="default" style={styles.typeBadge}>{type}</Badge>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.amount}>{formatCurrency(amount)}</Text>
          <Text style={styles.date}>
            {date ? format(new Date(date), 'MMMM d, yyyy') : 'Recently'}
          </Text>
        </Animated.View>

        <View style={styles.statsGrid}>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statLabel}>Status</Text>
            <Text style={styles.statValue}>{item.status || "Completed"}</Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statLabel}>Series</Text>
            <Text style={styles.statValue}>{item.series || item.fundingType || item.deal_type || "N/A"}</Text>
          </GlassCard>
        </View>

        <Text style={styles.sectionTitle}>Transaction Details</Text>
        <GlassCard style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Company</Text>
            <Text style={styles.detailValue}>{item.companyName || item.acquiredName || item.name}</Text>
          </View>
          {item.acquirerName && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Acquirer</Text>
              <Text style={styles.detailValue}>{item.acquirerName}</Text>
            </View>
          )}
          {item.stockExchangeSymbol && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Exchange</Text>
              <Text style={styles.detailValue}>{item.stockExchangeSymbol.toUpperCase()}</Text>
            </View>
          )}
          {item.stockSymbol && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Ticker</Text>
              <Text style={styles.detailValue}>{item.stockSymbol}</Text>
            </View>
          )}
        </GlassCard>

        {item.investors && item.investors.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Investors</Text>
            <View style={styles.investorList}>
              {item.investors.map((investor: any, index: number) => (
                <GlassCard key={index} style={styles.investorItem}>
                  <Ionicons name="business-outline" size={18} color={colors.primary} />
                  <Text style={styles.investorName}>{investor.name || investor}</Text>
                </GlassCard>
              ))}
            </View>
          </>
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  content: {
    padding: 20,
  },
  hero: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  typeBadge: {
    marginBottom: 16,
    paddingHorizontal: 12,
    height: 28,
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  amount: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.primary,
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: colors.text.tertiary,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    padding: 16,
    marginVertical: 0,
  },
  statLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 16,
  },
  detailsCard: {
    padding: 0,
    marginBottom: 32,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  detailLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  investorList: {
    gap: 10,
  },
  investorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    marginVertical: 0,
  },
  investorName: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '600',
  },
});
