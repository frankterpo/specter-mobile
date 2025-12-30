import React, { memo } from 'react';
import { StyleSheet, View, Text, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../theme';
import { Company } from '../../../api/specter';
import { Avatar } from '../shadcn/Avatar';
import { Badge } from '../shadcn/Badge';
import { GlassCard } from '../glass/GlassCard';
import { GlassButton } from '../glass/GlassButton';
import { SwipeActionCard } from '../SwipeActionCard';

interface CompanyCardV2Props {
  company: Company;
  onPress?: () => void;
  onLike?: () => void;
  onDislike?: () => void;
  onAddToList?: () => void;
}

const formatAmount = (num?: number) => {
  if (!num) return '$0';
  if (num >= 1000000000) return `$${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `$${(num / 1000000).toFixed(0)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
  return `$${num}`;
};

const CompanyCardV2 = memo(({ company, onPress, onLike, onDislike, onAddToList }: CompanyCardV2Props) => {
  const { colors, typography, spacing } = theme;
  
  const name = company.name || (company as any).organization_name || 'Unknown';
  const rank = company.rank;
  const rankDelta = (company as any).rank_delta;
  const growth = company.employee3moGrowthPct;
  const webGrowth = (company as any).webVisits3moGrowthPct;
  const webVisits = (company as any).webVisits;
  const revenue = (company as any).revenue_range || (company as any).estimated_annual_revenue;
  const trafficGrowth = (company as any).traffic_growth_pct;
  const alexaRank = (company as any).alexa_rank;
  const isHiring = (company as any).hiring_active;
  const teamActivity = company.teamEntityStatuses || [];
  const status = company.entity_status?.status;

  return (
    <SwipeActionCard onLike={onLike} onDislike={onDislike}>
      <GlassCard onPress={onPress} style={styles.card}>
      {/* ... existing header ... */}
      <View style={styles.header}>
        <Avatar 
          src={company.logoUrl || (company as any).logo_url} 
          fallback={name} 
          size={56} 
          style={styles.logo}
        />
        <View style={styles.headerInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            {company.operatingStatus === 'active' && (
              <View style={styles.activeDot} />
            )}
            {company.rank <= 100 && (
              <Ionicons name="sparkles" size={14} color="#FFD700" style={{ marginLeft: 2 }} />
            )}
          </View>
          <Text style={styles.description} numberOfLines={1}>
            {company.descriptionShort || company.tagline || 'No description available'}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {company.industry?.[0] || 'Technology'} • {company.hqRegion || company.location || 'Global'}
            </Text>
            {company.b2x && (
              <Badge variant="secondary" style={styles.b2xBadge}>
                <Text style={styles.badgeText}>{company.b2x.toUpperCase()}</Text>
              </Badge>
            )}
          </View>
        </View>
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>#{rank || 'N/A'}</Text>
          {rankDelta !== undefined && (
            <View style={styles.deltaContainer}>
              <Ionicons 
                name={rankDelta >= 0 ? "caret-up" : "caret-down"} 
                size={10} 
                color={rankDelta >= 0 ? colors.success : colors.destructive} 
              />
              <Text style={[
                styles.rankDelta, 
                { color: rankDelta >= 0 ? colors.success : colors.destructive }
              ]}>
                {Math.abs(rankDelta).toLocaleString()}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatAmount(company.totalFundingAmount || (company as any).funding?.total_funding_usd)}</Text>
          <Text style={styles.statLabel}>Funding</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{company.employeeCount || 'N/A'}</Text>
          <Text style={styles.statLabel}>Employees</Text>
          {growth && growth > 0 && (
            <Text style={[styles.statGrowth, { color: colors.success }]}>+{growth.toFixed(0)}%</Text>
          )}
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue} numberOfLines={1}>{company.lastFundingType || 'Seed'}</Text>
          <Text style={styles.statLabel}>Stage</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{webVisits ? formatAmount(webVisits).replace('$', '') : 'N/A'}</Text>
          <Text style={styles.statLabel}>Visits</Text>
          {webGrowth && webGrowth > 0 && (
            <Text style={[styles.statGrowth, { color: colors.success }]}>+{webGrowth.toFixed(0)}%</Text>
          )}
        </View>
      </View>

      {/* Team Activity */}
      {teamActivity.length > 0 && (
        <View style={styles.teamActivity}>
          <View style={styles.avatarStack}>
            {teamActivity.slice(0, 3).map((item, i) => (
              <Avatar 
                key={i}
                src={item.user.avatar}
                fallback={item.user.first_name?.[0] || '?'}
                size={20}
                style={[styles.stackAvatar, { left: i * 14, zIndex: 3 - i }]}
              />
            ))}
          </View>
          <Text style={styles.teamText}>
            {teamActivity[0].user.first_name} {teamActivity.length > 1 ? `& ${teamActivity.length - 1} others` : ''} {teamActivity[0].status}
          </Text>
        </View>
      )}

      {/* Secondary Data Bar */}
      <View style={styles.secondaryBar}>
        {trafficGrowth !== undefined && (
          <View style={styles.dataPoint}>
            <Ionicons name="stats-chart" size={12} color={colors.primary} />
            <Text style={styles.dataPointText}>{trafficGrowth > 0 ? '+' : ''}{trafficGrowth.toFixed(1)}% Traffic</Text>
          </View>
        )}
        {alexaRank && (
          <View style={styles.dataPoint}>
            <Ionicons name="globe" size={12} color={colors.text.tertiary} />
            <Text style={styles.dataPointText}>Alexa: {alexaRank.toLocaleString()}</Text>
          </View>
        )}
        {isHiring && (
          <View style={styles.dataPoint}>
            <View style={styles.hiringDot} />
            <Text style={[styles.dataPointText, { color: colors.success, fontWeight: '700' }]}>Hiring</Text>
          </View>
        )}
      </View>

      {/* Highlights */}
      <View style={styles.highlights}>
        {growth && growth > 0 && (
          <Badge variant="default" style={styles.growthBadge}>
            <Ionicons name="trending-up" size={12} color="#FFF" />
            <Text style={styles.growthText}>{growth.toFixed(1)}% HC</Text>
          </Badge>
        )}
        {company.highlights?.slice(0, 3).map((h, i) => (
          <Badge key={i} variant="outline" style={styles.highlightBadge}>
            <Text style={styles.highlightText}>{h.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</Text>
          </Badge>
        ))}
      </View>

      {/* Footer / Actions */}
      <View style={styles.footer}>
        <View style={styles.statusIndicator}>
          <View style={[
            styles.statusDot, 
            { backgroundColor: status === 'liked' ? colors.success : status === 'disliked' ? colors.destructive : colors.text.tertiary }
          ]} />
          <Text style={styles.statusLabelText}>
            {status === 'liked' ? 'Liked' : status === 'disliked' ? 'Passed' : 'Not viewed'}
          </Text>
        </View>
        <View style={styles.actions}>
          <GlassButton icon="close" onPress={onDislike} variant="destructive" style={styles.actionBtn} />
          <GlassButton icon="heart" onPress={onLike} variant="primary" style={styles.actionBtn} />
          <GlassButton icon="add" onPress={onAddToList} style={styles.actionBtn} />
          <GlassButton icon="chevron-forward" onPress={onPress} variant="primary" style={styles.detailsBtn} />
        </View>
      </View>
    </GlassCard>
    </SwipeActionCard>
  );
});

export default CompanyCardV2;

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    gap: 12,
  },
  logo: {
    borderRadius: 12,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
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
  description: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  b2xBadge: {
    height: 18,
    paddingHorizontal: 6,
  },
  rankBadge: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rankText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  deltaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rankDelta: {
    fontSize: 11,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  statLabel: {
    fontSize: 10,
    color: theme.colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statGrowth: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  teamActivity: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  avatarStack: {
    flexDirection: 'row',
    height: 20,
    width: 50,
  },
  stackAvatar: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  teamText: {
    fontSize: 11,
    color: theme.colors.text.tertiary,
    fontStyle: 'italic',
  },
  secondaryBar: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  dataPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dataPointText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  hiringDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
  },
  highlights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 16,
  },
  growthBadge: {
    backgroundColor: theme.colors.destructive,
    gap: 4,
    paddingHorizontal: 8,
    height: 24,
  },
  growthText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  highlightBadge: {
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    height: 24,
  },
  highlightText: {
    fontSize: 11,
    color: theme.colors.text.secondary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statusLabelText: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
  },
  socials: {
    flexDirection: 'row',
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  detailsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
});
