import React, { useState, useEffect, useMemo } from "react";
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
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { theme } from "../theme";
import { specterPublicAPI } from "../api/public-client";
import { CompaniesStackParamList } from "../types/navigation";
import { useClerkToken } from "../hooks/useClerkToken";
import { Badge } from "../components/ui/shadcn/Badge";
import { Avatar } from "../components/ui/shadcn/Avatar";
import { GlassCard } from "../components/ui/glass/GlassCard";
import { GlassButton } from "../components/ui/glass/GlassButton";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { useEntityStatusMutation } from "../hooks/useMutations";
import AddToListSheet from "../components/AddToListSheet";

type RouteProps = RouteProp<CompaniesStackParamList, "CompanyDetail">;
const { width } = Dimensions.get('window');

const TabButton = ({ label, active, onPress }: { label: string, active: boolean, onPress: () => void }) => {
  const { colors } = theme;
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.activeTabButton]}>
      <Text style={[styles.tabLabel, active && styles.activeTabLabel]}>{label}</Text>
      {active && <View style={styles.tabIndicator} />}
    </Pressable>
  );
};

export default function CompanyDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { getAuthToken } = useClerkToken();
  const { colors, spacing, typography } = theme;

  const safeGoBack = React.useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("CompaniesTab");
  }, [navigation]);

  const { companyId, company: companyFromParams } = route.params;
  const company = useMemo(() => companyFromParams ?? null, [companyFromParams]);
  const [activeTab, setActiveTab] = useState<'Overview' | 'Metrics' | 'Team' | 'Funding'>('Overview');
  const [isListSheetVisible, setIsListSheetVisible] = useState(false);

  const statusMutation = useEntityStatusMutation();

  useEffect(() => {
    // Mark as viewed (best-effort)
    if (!companyId) return;
    statusMutation.mutate({ id: companyId, type: 'company', status: 'viewed' });
  }, [companyId, statusMutation]);

  const { data: teamData, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['company_team', companyId],
    queryFn: async () => {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      return specterPublicAPI.companies.browseCompanyTeam(companyId, token, 0, 50);
    }
  });

  const team = teamData?.items || [];
  const teamEntityStatuses = company?.teamEntityStatuses || [];

  const formatAmount = (num?: number) => {
    if (!num) return '$0';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(0)}M`;
    return `$${num.toLocaleString()}`;
  };

  if (!company) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle" size={48} color={colors.destructive} />
        <Text style={styles.errorText}>
          Company details are unavailable. Please go back and open the company again from the feed.
        </Text>
        <GlassButton label="Go Back" onPress={safeGoBack} style={{ marginTop: 20 }} />
      </View>
    );
  }

  const rankDelta = (company as any).rank_delta;
  const alexaRank = (company as any).alexa_rank;
  const webVisits = (company as any).web_visits || (company as any).webVisits;
  const webGrowth = (company as any).webVisits3moGrowthPct;
  const foundedYear = company.foundedYear;
  const growthStage = company.growthStage;
  const integrationInfo = company.integrationInfo;

  return (
    <View style={styles.container}>
      {/* Hero Section */}
      <View style={styles.hero}>
        <LinearGradient
          colors={[colors.sidebar.bg, colors.primary + '20', colors.background]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.navHeader, { paddingTop: insets.top }]}>
          <GlassButton icon="arrow-back" onPress={safeGoBack} />
          <View style={styles.headerActions}>
            <GlassButton icon="globe-outline" onPress={() => company.website && Linking.openURL(company.website)} />
            <GlassButton icon="logo-linkedin" onPress={() => (company.linkedinUrl || (company as any).linkedin_url) && Linking.openURL(`https://${company.linkedinUrl || (company as any).linkedin_url}`)} />
            <GlassButton icon="share-outline" />
          </View>
        </View>

        <Animated.View entering={FadeInUp.delay(200)} style={styles.heroContent}>
          <Avatar 
            src={company.logoUrl || (company as any).logo_url} 
            fallback={company.name || (company as any).organization_name} 
            size={80} 
            style={styles.heroLogo} 
          />
          <View style={styles.titleRow}>
            <Text style={styles.name}>{company.name || (company as any).organization_name}</Text>
            {company.operatingStatus === 'active' && <View style={styles.activeDot} />}
            <Badge variant="secondary" style={styles.rankBadge}>
              <Text style={styles.rankText}>#{company.rank}</Text>
            </Badge>
          </View>
          
          {rankDelta !== undefined && (
            <View style={styles.deltaContainer}>
              <Ionicons 
                name={rankDelta >= 0 ? "caret-up" : "caret-down"} 
                size={12} 
                color={rankDelta >= 0 ? colors.success : colors.destructive} 
              />
              <Text style={[
                styles.rankDelta, 
                { color: rankDelta >= 0 ? colors.success : colors.destructive }
              ]}>
                {Math.abs(rankDelta).toLocaleString()} positions this month
              </Text>
            </View>
          )}

          <Text style={styles.descriptionShort}>{company.descriptionShort || company.tagline}</Text>
          <Text style={styles.heroMeta}>
            {company.industry?.[0] || 'Technology'} • {company.hqRegion || company.location || 'Global'}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatAmount(company.totalFundingAmount || (company as any).funding?.total_funding_usd)}</Text>
              <Text style={styles.statLabel}>Funded</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{company.employeeCount || 'N/A'}</Text>
              <Text style={styles.statLabel}>Employees</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue} numberOfLines={1}>{company.lastFundingType || growthStage || 'Seed'}</Text>
              <Text style={styles.statLabel}>Stage</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{(company as any).revenue_range || 'N/A'}</Text>
              <Text style={styles.statLabel}>Revenue</Text>
            </View>
          </View>

          {/* Team Context */}
          {teamEntityStatuses.length > 0 && (
            <View style={styles.teamContext}>
              <View style={styles.avatarStack}>
                {teamEntityStatuses.slice(0, 3).map((item: any, i: number) => (
                  <Avatar 
                    key={i}
                    src={item.user.avatar}
                    fallback={item.user.first_name?.[0] || '?'}
                    size={24}
                    style={[styles.stackAvatar, { left: i * 16, zIndex: 3 - i }]}
                  />
                ))}
              </View>
              <Text style={styles.teamContextText}>
                {teamEntityStatuses[0].user.first_name} {teamEntityStatuses.length > 1 ? `& ${teamEntityStatuses.length - 1} others` : ''} viewed this
              </Text>
            </View>
          )}

          <View style={styles.heroHighlights}>
            {company.highlights?.slice(0, 3).map((h: string, i: number) => (
              <Badge key={i} variant="outline" style={styles.highlightBadge}>
                <Text style={styles.highlightBadgeText}>{h.replace(/_/g, ' ').toUpperCase()}</Text>
              </Badge>
            ))}
          </View>
        </Animated.View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {(['Overview', 'Metrics', 'Team', 'Funding'] as const).map(tab => (
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
              <Text style={styles.sectionTitle}>About {company.name || (company as any).organization_name}</Text>
              <Text style={styles.aboutText}>{company.description || company.descriptionShort || company.tagline || "No detailed description available."}</Text>
              
              <View style={styles.linksGrid}>
                {(company.linkedinUrl || (company as any).linkedin_url) && (
                  <GlassCard style={styles.linkCard} onPress={() => Linking.openURL(`https://${company.linkedinUrl || (company as any).linkedin_url}`)}>
                    <Ionicons name="logo-linkedin" size={20} color="#0077b5" />
                    <Text style={styles.linkText}>LinkedIn</Text>
                  </GlassCard>
                )}
                {(company as any).twitter_url && (
                  <GlassCard style={styles.linkCard} onPress={() => Linking.openURL((company as any).twitter_url)}>
                    <Ionicons name="logo-twitter" size={20} color="#1DA1F2" />
                    <Text style={styles.linkText}>Twitter</Text>
                  </GlassCard>
                )}
                {company.website && (
                  <GlassCard style={styles.linkCard} onPress={() => Linking.openURL(company.website)}>
                    <Ionicons name="globe-outline" size={20} color={colors.primary} />
                    <Text style={styles.linkText}>Website</Text>
                  </GlassCard>
                )}
              </View>

              {company.awards && company.awards.length > 0 && (
                <View style={{ marginTop: 24 }}>
                  <Text style={styles.sectionTitle}>Awards & Recognition</Text>
                  {company.awards.map((award: any, i: number) => (
                    <GlassCard key={i} style={styles.awardCard}>
                      <View style={styles.awardHeader}>
                        <Ionicons name="trophy" size={24} color="#FFD700" />
                        <View style={styles.awardTitleInfo}>
                          <Text style={styles.awardName}>{award.award_name}</Text>
                          <Text style={styles.awardOrg}>{award.award_org} • {award.award_year}</Text>
                        </View>
                      </View>
                    </GlassCard>
                  ))}
                </View>
              )}
            </View>
          )}

          {activeTab === 'Metrics' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Growth Indicators</Text>
              <GlassCard style={styles.metricGrowthCard}>
                <View style={styles.growthItem}>
                  <View style={styles.growthHeader}>
                    <Text style={styles.growthLabel}>Headcount Growth (3mo)</Text>
                    <Text style={styles.growthValue}>{company.employee3moGrowthPct ? `+${company.employee3moGrowthPct.toFixed(1)}%` : 'N/A'}</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${Math.min(company.employee3moGrowthPct || 0, 100)}%` }]} />
                  </View>
                </View>
                <View style={[styles.growthItem, { marginTop: 20 }]}>
                  <View style={styles.growthHeader}>
                    <Text style={styles.growthLabel}>Web Traffic Growth (3mo)</Text>
                    <Text style={styles.growthValue}>{(company as any).traffic_growth_pct ? `+${(company as any).traffic_growth_pct.toFixed(1)}%` : 'N/A'}</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${Math.min((company as any).traffic_growth_pct || 0, 100)}%`, backgroundColor: colors.primary }]} />
                  </View>
                </View>
              </GlassCard>

              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Reach & Intensity</Text>
              <View style={styles.signalGrid}>
                {(company as any).alexa_rank && (
                  <GlassCard style={styles.signalIntensityCard}>
                    <Text style={styles.intensityVal}>#{(company as any).alexa_rank.toLocaleString()}</Text>
                    <Text style={styles.intensityLabel}>Alexa Rank</Text>
                  </GlassCard>
                )}
                {(company as any).web_visits && (
                  <GlassCard style={styles.signalIntensityCard}>
                    <Text style={styles.intensityVal}>{(company as any).web_visits.toLocaleString()}</Text>
                    <Text style={styles.intensityLabel}>Monthly Visits</Text>
                  </GlassCard>
                )}
              </View>
              
              <View style={[styles.signalGrid, { marginTop: 12 }]}>
                {(company as any).hiring_active && (
                  <GlassCard style={[styles.signalIntensityCard, { borderColor: colors.success + '40' }]}>
                    <Ionicons name="briefcase" size={24} color={colors.success} />
                    <Text style={[styles.intensityLabel, { color: colors.success }]}>Actively Hiring</Text>
                  </GlassCard>
                )}
                <GlassCard style={styles.signalIntensityCard}>
                  <Text style={styles.intensityVal}>{company.employeeCount || 'N/A'}</Text>
                  <Text style={styles.intensityLabel}>Total Employees</Text>
                </GlassCard>
              </View>
            </View>
          )}

          {activeTab === 'Team' && (
            <View style={styles.tabContent}>
              {isLoadingTeam ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <View style={styles.teamGrid}>
                  {team.map((member, i) => (
                    <Pressable 
                      key={i} 
                      style={styles.teamMember}
                      onPress={() => {
                        const personId =
                          (member as any).id ||
                          (member as any).specter_person_id ||
                          (member as any).person_id;
                        if (personId) {
                          navigation.navigate('PeopleTab', { screen: 'PersonDetail', params: { personId } });
                        }
                      }}
                    >
                      <Avatar
                        src={(member as any).profile_image_url || (member as any).profile_picture_url}
                        fallback={member.full_name}
                        size={60}
                      />
                      <Text style={styles.memberName} numberOfLines={1}>{member.full_name}</Text>
                      <Text style={styles.memberRole} numberOfLines={1}>{(member as any).title || 'Team Member'}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {activeTab === 'Funding' && (
            <View style={styles.tabContent}>
              <GlassCard style={styles.fundingSummary}>
                <Text style={styles.fundingTotalLabel}>Total Raised</Text>
                <Text style={styles.fundingTotalVal}>{formatAmount(company.totalFundingAmount || (company as any).funding?.total_funding_usd)}</Text>
              </GlassCard>
              
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Latest Transaction</Text>
              <GlassCard style={styles.roundCard}>
                <View style={styles.roundHeader}>
                  <Badge variant="default">{company.lastFundingType || 'Latest Round'}</Badge>
                  <Text style={styles.roundDate}>{company.lastFundingAt || (company as any).funding?.last_funding_at ? new Date(company.lastFundingAt || (company as any).funding?.last_funding_at).toLocaleDateString() : 'Recent'}</Text>
                </View>
                <Text style={styles.roundAmount}>{formatAmount((company as any).last_funding_amount || company.totalFundingAmount)}</Text>
              </GlassCard>
            </View>
          )}

        </Animated.View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Bar */}
      <View style={[styles.floatingActions, { paddingBottom: insets.bottom + 10 }]}>
        <GlassButton 
          icon="close" 
          variant="destructive" 
          style={styles.mainAction} 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            statusMutation.mutate({ id: companyId, type: 'company', status: 'disliked' });
            safeGoBack();
          }}
        />
        <GlassButton 
          label="Add to List" 
          icon="add" 
          style={styles.listAction} 
          onPress={() => setIsListSheetVisible(true)}
        />
        <GlassButton 
          icon="heart" 
          variant="primary" 
          style={styles.mainAction} 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            statusMutation.mutate({ id: companyId, type: 'company', status: 'liked' });
          }}
        />
      </View>

      <AddToListSheet
        visible={isListSheetVisible}
        onClose={() => setIsListSheetVisible(false)}
        entityId={companyId}
        entityType="company"
        entityName={company.name || (company as any).organization_name}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  hero: {
    paddingBottom: 24,
    width: '100%',
    paddingHorizontal: 20,
  },
  navHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  heroContent: {
    alignItems: 'center',
  },
  heroLogo: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text.primary,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  rankBadge: {
    backgroundColor: theme.colors.primary + '20',
    borderColor: theme.colors.primary,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  deltaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  rankDelta: {
    fontSize: 12,
    fontWeight: '700',
  },
  descriptionShort: {
    fontSize: 15,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  heroMeta: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
    fontWeight: '600',
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 16,
    marginTop: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text.primary,
  },
  statLabel: {
    fontSize: 9,
    color: theme.colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'center',
  },
  heroHighlights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  teamContext: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  avatarStack: {
    flexDirection: 'row',
    height: 24,
    width: 56,
  },
  stackAvatar: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#000',
  },
  teamContextText: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    fontWeight: '600',
  },
  highlightBadge: {
    borderColor: 'rgba(255,255,255,0.1)',
  },
  highlightBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tabsContainer: {
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tabsScroll: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 28,
  },
  tabButton: {
    paddingVertical: 8,
    position: 'relative',
  },
  activeTabButton: {},
  tabLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.tertiary,
  },
  activeTabLabel: {
    color: theme.colors.primary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text.primary,
    marginBottom: 16,
  },
  aboutText: {
    fontSize: 15,
    color: theme.colors.text.secondary,
    lineHeight: 24,
  },
  linksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 24,
  },
  linkCard: {
    width: (width - 52) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    marginVertical: 0,
    borderRadius: 16,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  metricGrowthCard: {
    padding: 24,
    borderRadius: 24,
  },
  growthItem: {
    gap: 10,
  },
  growthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  growthLabel: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontWeight: '600',
  },
  growthValue: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.success,
  },
  progressBarBg: {
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.success,
    borderRadius: 5,
  },
  signalGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  signalIntensityCard: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    gap: 8,
  },
  intensityVal: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text.primary,
  },
  intensityLabel: {
    fontSize: 11,
    color: theme.colors.text.tertiary,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  teamMember: {
    width: (width - 80) / 3,
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  memberRole: {
    fontSize: 11,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
  },
  fundingSummary: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 24,
  },
  fundingTotalLabel: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  fundingTotalVal: {
    fontSize: 36,
    fontWeight: '900',
    color: theme.colors.text.primary,
    marginTop: 8,
  },
  roundCard: {
    padding: 20,
    borderRadius: 20,
  },
  roundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roundDate: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
    fontWeight: '600',
  },
  roundAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.text.primary,
    marginTop: 16,
  },
  awardCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
  },
  awardHeader: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  awardTitleInfo: {
    flex: 1,
  },
  awardName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  awardOrg: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  similarGrid: {
    gap: 12,
  },
  similarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 12,
    marginVertical: 0,
  },
  similarInfo: {
    flex: 1,
  },
  similarName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  similarMeta: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
    marginTop: 2,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  floatingActions: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  mainAction: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  listAction: {
    flex: 1,
    height: 60,
    borderRadius: 30,
  },
});
