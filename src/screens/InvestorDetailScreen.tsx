import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors } from "../theme/colors";
import { specterPublicAPI } from "../api/public-client";
import { InvestorsStackParamList } from "../types/navigation";
import { useClerkToken } from "../hooks/useClerkToken";
import { Badge } from "../components/ui/shadcn/Badge";
import { Avatar } from "../components/ui/shadcn/Avatar";
import { GlassCard } from "../components/ui/glass/GlassCard";
import { GlassButton } from "../components/ui/glass/GlassButton";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useLikeMutation } from "../hooks/useMutations";

type RouteProps = RouteProp<InvestorsStackParamList, "InvestorDetail">;
const { width } = Dimensions.get('window');

const TabButton = ({ label, active, onPress }: { label: string, active: boolean, onPress: () => void }) => (
  <Pressable onPress={onPress} style={[styles.tabButton, active && styles.activeTabButton]}>
    <Text style={[styles.tabLabel, active && styles.activeTabLabel]}>{label}</Text>
    {active && <View style={styles.tabIndicator} />}
  </Pressable>
);

export default function InvestorDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { getAuthToken } = useClerkToken();

  const { investorId } = route.params;
  const [investor, setInvestor] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Overview' | 'Portfolio' | 'Funds' | 'Distributions'>('Overview');
  const [error, setError] = useState<string | null>(null);

  const likeMutation = useLikeMutation();

  const handleLike = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    likeMutation.mutate({ id, type: 'investors', status: 'liked' });
  };

  const handleDislike = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    likeMutation.mutate({ id, type: 'investors', status: 'disliked' });
  };

  const handleView = (id: string) => {
    likeMutation.mutate({ id, type: 'investors', status: 'viewed' });
  };

  useEffect(() => {
    loadInvestorData();
    if (investorId) {
      handleView(investorId);
    }
  }, [investorId]);

  const loadInvestorData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");

      // In a real app, we'd fetch specific detail. For now, we search signals for this ID or use passed data.
      // Assuming getSignals with ID filter or similar if available. 
      // For this build, I'll assume we fetch from signals or a dedicated endpoint.
      const data = await specterPublicAPI.investors.getSignals({ id: investorId }, 0, 1, token);
      if (data.items?.[0]) {
        setInvestor(data.items[0]);
      } else {
        throw new Error("Investor not found");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load investor details");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !investor) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle" size={48} color={colors.destructive} />
        <Text style={styles.errorText}>{error || "Investor not found"}</Text>
        <GlassButton label="Retry" onPress={loadInvestorData} style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hero Section */}
      <View style={styles.hero}>
        <LinearGradient
          colors={[colors.sidebar.bg, colors.primary + '20', colors.background]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.navHeader, { paddingTop: insets.top }]}>
          <GlassButton icon="arrow-back" onPress={() => navigation.goBack()} />
          <View style={styles.headerActions}>
            <GlassButton icon="logo-linkedin" onPress={() => investor.linkedinUrl && Linking.openURL(investor.linkedinUrl)} />
            <GlassButton icon="share-outline" />
          </View>
        </View>

        <Animated.View entering={FadeInUp.delay(200)} style={styles.heroContent}>
          <Avatar src={investor.logoUrl} fallback={investor.name} size={80} style={styles.heroLogo} />
          <Text style={styles.name}>{investor.name}</Text>
          <Text style={styles.heroMeta}>{investor.HQLocation}</Text>
          <View style={styles.typeBadgeRow}>
            {investor.types?.map((t: string, i: number) => (
              <Badge key={i} variant="secondary">{t.replace(/_/g, ' ')}</Badge>
            ))}
            <Badge variant="default" style={styles.rankBadge}>#{investor.rank}</Badge>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{investor.nInvestments?.toLocaleString() || '0'}</Text>
              <Text style={styles.statLabel}>Investments</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{investor.nLeadInvestments?.toLocaleString() || '0'}</Text>
              <Text style={styles.statLabel}>Lead</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{investor.nExits || '0'}</Text>
              <Text style={styles.statLabel}>Exits</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{investor.nFunds || '0'}</Text>
              <Text style={styles.statLabel}>Funds</Text>
            </View>
          </View>

          <View style={styles.heroHighlights}>
            {investor.InvestorHighlights?.slice(0, 3).map((h: any, i: number) => (
              <Badge key={i} variant="outline" style={styles.highlightBadge}>
                {h.highlight.replace(/_/g, ' ').toUpperCase()}
              </Badge>
            ))}
          </View>
        </Animated.View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {(['Overview', 'Portfolio', 'Funds', 'Distributions'] as const).map(tab => (
            <TabButton 
              key={tab} 
              label={tab} 
              active={activeTab === tab} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab);
              }} 
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(400)}>
          {activeTab === 'Overview' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Investor Profile</Text>
              <Text style={styles.aboutText}>{investor.description || `Leading ${investor.types?.[0]?.replace(/_/g, ' ') || 'investment firm'} based in ${investor.HQRegion}.`}</Text>
              
              <View style={styles.linksGrid}>
                {investor.crunchbaseUrl && (
                  <GlassCard style={styles.linkCard} onPress={() => Linking.openURL(investor.crunchbaseUrl)}>
                    <Ionicons name="link-outline" size={20} color={colors.primary} />
                    <Text style={styles.linkText}>Crunchbase</Text>
                  </GlassCard>
                )}
                {investor.linkedinUrl && (
                  <GlassCard style={styles.linkCard} onPress={() => Linking.openURL(investor.linkedinUrl)}>
                    <Ionicons name="logo-linkedin" size={20} color="#0077b5" />
                    <Text style={styles.linkText}>LinkedIn</Text>
                  </GlassCard>
                )}
              </View>
            </View>
          )}

          {activeTab === 'Portfolio' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <Text style={styles.emptyText}>Portfolio data loading...</Text>
            </View>
          )}

          {activeTab === 'Funds' && (
            <View style={styles.tabContent}>
              {investor.funds?.map((fund: any, i: number) => (
                <GlassCard key={i} style={styles.fundCard}>
                  <Text style={styles.fundName}>{fund.name}</Text>
                  <View style={styles.fundMeta}>
                    <View style={styles.fundMetaItem}>
                      <Text style={styles.fundMetaLabel}>Announced</Text>
                      <Text style={styles.fundMetaVal}>{new Date(fund.announced_on).toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.fundMetaItem}>
                      <Text style={styles.fundMetaLabel}>Raised</Text>
                      <Text style={styles.fundMetaVal}>{fund.raised_amount_usd !== 'N/A' ? `$${(parseInt(fund.raised_amount_usd) / 1e6).toFixed(0)}M` : 'N/A'}</Text>
                    </View>
                  </View>
                </GlassCard>
              ))}
            </View>
          )}

          {activeTab === 'Distributions' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>By Region</Text>
              <GlassCard style={styles.distCard}>
                {investor.regionDistribution?.map((rd: any, i: number) => (
                  <View key={i} style={styles.distItem}>
                    <View style={styles.distHeader}>
                      <Text style={styles.distLabel}>{rd.region}</Text>
                      <Text style={styles.distVal}>{rd.count} companies</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${(rd.count / investor.nInvestments * 100).toFixed(0)}%` }]} />
                    </View>
                  </View>
                ))}
              </GlassCard>

              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>By Industry</Text>
              <GlassCard style={styles.distCard}>
                {investor.industryDistribution?.slice(0, 5).map((id: any, i: number) => (
                  <View key={i} style={styles.distItem}>
                    <View style={styles.distHeader}>
                      <Text style={styles.distLabel}>{id.industry}</Text>
                      <Text style={styles.distVal}>{id.count}</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${(id.count / investor.nInvestments * 100).toFixed(0)}%`, backgroundColor: colors.primary }]} />
                    </View>
                  </View>
                ))}
              </GlassCard>
            </View>
          )}
        </Animated.View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Bar */}
      <View style={[styles.floatingActions, { paddingBottom: insets.bottom + 10 }]}>
        <GlassButton icon="close" onPress={() => handleDislike(investor.id)} variant="destructive" style={styles.mainAction} />
        <GlassButton label="Add to List" icon="add" style={styles.listAction} />
        <GlassButton icon="heart" onPress={() => handleLike(investor.id)} variant="primary" style={styles.mainAction} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  hero: {
    height: 440,
    width: '100%',
    paddingHorizontal: 20,
  },
  navHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  heroContent: {
    alignItems: 'center',
    marginTop: 10,
  },
  heroLogo: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 20,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text.primary,
    marginTop: 16,
  },
  heroMeta: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
  },
  typeBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  rankBadge: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 16,
    marginTop: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: 8,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'center',
  },
  heroHighlights: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 16,
  },
  highlightBadge: {
    fontSize: 9,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  tabsContainer: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  tabsScroll: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 24,
  },
  tabButton: {
    paddingVertical: 8,
    position: 'relative',
  },
  activeTabButton: {},
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  activeTabLabel: {
    color: colors.primary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 12,
  },
  aboutText: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  linksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 20,
  },
  linkCard: {
    width: (width - 52) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginVertical: 0,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  fundCard: {
    marginBottom: 12,
  },
  fundName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  fundMeta: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 32,
  },
  fundMetaItem: {
    gap: 2,
  },
  fundMetaLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },
  fundMetaVal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  distCard: {
    padding: 20,
  },
  distItem: {
    marginBottom: 16,
  },
  distHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  distLabel: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '600',
  },
  distVal: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primaryLight,
    borderRadius: 3,
  },
  errorText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: 20,
  },
  floatingActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    gap: 12,
  },
  mainAction: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  listAction: {
    flex: 1,
    height: 56,
    borderRadius: 28,
  },
});
