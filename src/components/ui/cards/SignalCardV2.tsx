import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { Badge } from '../shadcn/Badge';
import { GlassCard } from '../glass/GlassCard';
import { GlassButton } from '../glass/GlassButton';
import { Avatar } from '../shadcn/Avatar';
import { SwipeActionCard } from '../SwipeActionCard';

interface SignalCardProps {
  type: 'REVENUE' | 'TALENT' | 'STRATEGIC' | 'FUNDING' | 'ACQUISITION' | 'IPO';
  item: any;
  onPress?: () => void;
  onLike?: () => void;
  onDislike?: () => void;
  onAddToList?: () => void;
}

const SignalCardV2 = ({ type, item, onPress, onLike, onDislike, onAddToList }: SignalCardProps) => {
  const name = item.name || item.full_name || item.organization_name || item.company_name || 'Unknown';
  const logo = item.logo_url || item.company_logo_url || item.logoUrl;
  const status = item.entity_status?.status;

  const getSignalConfig = () => {
    switch (type) {
      case 'REVENUE':
        return {
          icon: 'trending-up',
          color: colors.success,
          label: 'Revenue Signal',
          gradient: [colors.success + '26', colors.success + '0D']
        };
      case 'TALENT':
        return {
          icon: 'people',
          color: '#8b5cf6', // Purple
          label: 'Talent Signal',
          gradient: ['rgba(139, 92, 246, 0.15)', 'rgba(139, 92, 246, 0.05)']
        };
      case 'STRATEGIC':
        return {
          icon: 'flash',
          color: '#3b82f6', // Blue
          label: 'Strategic Move',
          gradient: ['rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0.05)']
        };
      case 'FUNDING':
        return {
          icon: 'cash',
          color: '#f59e0b', // Amber/Gold
          label: 'Funding Round',
          gradient: ['rgba(245, 158, 11, 0.15)', 'rgba(245, 158, 11, 0.05)']
        };
      case 'ACQUISITION':
        return {
          icon: 'business',
          color: '#ef4444', // Red
          label: 'Acquisition',
          gradient: ['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.05)']
        };
      case 'IPO':
        return {
          icon: 'stats-chart',
          color: '#06b6d4', // Teal/Cyan
          label: 'IPO Signal',
          gradient: ['rgba(6, 182, 212, 0.15)', 'rgba(6, 182, 212, 0.05)']
        };
      default:
        return {
          icon: 'notifications',
          color: colors.primary,
          label: 'Signal',
          gradient: ['rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0.05)']
        };
    }
  };

  const config = getSignalConfig();

  const renderContent = () => {
    switch (type) {
      case 'REVENUE':
        return (
          <View style={styles.contentRow}>
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: config.color }]}>
                ↑{item.growth_rate || item.revenue_growth || 'High'}%
              </Text>
              <Text style={styles.metricLabel}>Growth</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{item.revenue_range || 'N/A'}</Text>
              <Text style={styles.metricLabel}>Revenue</Text>
            </View>
          </View>
        );
      case 'TALENT':
        return (
          <View style={styles.contentRow}>
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: config.color }]}>
                {item.hiring_surge ? '🔥 Surge' : 'Growing'}
              </Text>
              <Text style={styles.metricLabel}>Hiring</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{item.new_hires_count || 'Team'}</Text>
              <Text style={styles.metricLabel}>New Hires</Text>
            </View>
          </View>
        );
      case 'STRATEGIC':
        return (
          <View style={styles.descriptionBox}>
            <Text style={styles.description} numberOfLines={2}>
              {item.description || item.signal_type || 'Strategic expansion or partnership detected.'}
            </Text>
          </View>
        );
      case 'FUNDING':
      case 'ACQUISITION':
      case 'IPO':
        return (
          <View style={styles.contentRow}>
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: config.color }]}>
                {item.amount_usd ? `$${(item.amount_usd / 1e6).toFixed(1)}M` : item.series || 'Closed'}
              </Text>
              <Text style={styles.metricLabel}>Amount</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{item.date || 'Recent'}</Text>
              <Text style={styles.metricLabel}>Date</Text>
            </View>
          </View>
        );
    }
  };

  return (
    <SwipeActionCard onLike={onLike} onDislike={onDislike}>
      <GlassCard onPress={onPress}>
      <View style={styles.header}>
        <Avatar src={logo} fallback={name} size={48} />
        <View style={styles.titleInfo}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.industry}>{item.industry || item.industries?.[0] || 'Technology'}</Text>
        </View>
        <View style={styles.typeBadge}>
          <Ionicons name={config.icon as any} size={14} color={config.color} />
          <Text style={[styles.typeText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      <View style={[styles.content, { backgroundColor: config.gradient[1] }]}>
        {renderContent()}
      </View>

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
};

export default memo(SignalCardV2);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleInfo: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  industry: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  content: {
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  contentRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  metric: {
    alignItems: 'center',
    gap: 2,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text.primary,
  },
  metricLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  descriptionBox: {
    paddingVertical: 4,
  },
  description: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
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
    color: colors.text.tertiary,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  detailsBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});
