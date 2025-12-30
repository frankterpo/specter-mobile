import React, { memo } from 'react';
import { StyleSheet, View, Text, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../theme';
import { Person } from '../../../api/specter';
import { Avatar } from '../shadcn/Avatar';
import { Badge } from '../shadcn/Badge';
import { GlassCard } from '../glass/GlassCard';
import { GlassButton } from '../glass/GlassButton';
import { SwipeActionCard } from '../SwipeActionCard';

interface PersonCardV2Props {
  person: Person;
  onPress?: () => void;
  onLike?: () => void;
  onDislike?: () => void;
  onAddToList?: () => void;
}

const StatPill = ({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap, value: string | number, label: string }) => {
  const { colors } = theme;
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={14} color={colors.text.tertiary} />
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
};

const formatNumber = (num?: number) => {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const PersonCardV2 = memo(({ person, onPress, onLike, onDislike, onAddToList }: PersonCardV2Props) => {
  const { colors } = theme;
  const name = person.full_name || `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown';
  const currentExp = person.experience?.[0];
  const latestEducation = person.education?.[0];
  const status = person.entity_status?.status;
  const topSkills = (person as any).top_skills?.slice(0, 3) || [];
  const hasEmail = !!(person as any).email;
  const hasPhone = !!(person as any).phone;

  return (
    <SwipeActionCard onLike={onLike} onDislike={onDislike}>
      <GlassCard onPress={onPress} style={styles.card}>
      {/* Header Row */}
      <View style={styles.header}>
        <Avatar src={person.profile_image_url} fallback={name} size={64} />
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{name}</Text>
            <View style={styles.contactIcons}>
              {hasEmail && <Ionicons name="mail" size={14} color={colors.primary} />}
              {hasPhone && <Ionicons name="call" size={14} color={colors.primary} />}
            </View>
          </View>
          <Text style={styles.tagline} numberOfLines={2}>
            {person.tagline || (currentExp ? `${currentExp.title} @ ${currentExp.company_name}` : 'No title available')}
          </Text>
          <View style={styles.metaRow}>
            {person.region && (
              <View style={styles.metaItem}>
                <Ionicons name="location" size={12} color={colors.text.tertiary} />
                <Text style={styles.metaText}>{person.region}</Text>
              </View>
            )}
            {person.seniority && (
              <Badge variant="secondary" style={styles.seniorityBadge}>
                <Text style={styles.badgeText}>{person.seniority}</Text>
              </Badge>
            )}
            {currentExp?.is_unicorn && <Text style={styles.emoji}>🦄</Text>}
          </View>
        </View>
        <View style={styles.socialIcons}>
          {person.linkedin_url && (
            <GlassButton 
              icon="logo-linkedin" 
              onPress={() => Linking.openURL(person.linkedin_url!)} 
              style={styles.socialBtn}
            />
          )}
          {(person as any).twitter_url && (
            <GlassButton 
              icon="logo-twitter" 
              onPress={() => Linking.openURL((person as any).twitter_url!)} 
              style={styles.socialBtn}
            />
          )}
        </View>
      </View>

      {/* Education / Latest Status */}
      {latestEducation && (
        <View style={styles.educationRow}>
          <Ionicons name="school" size={12} color={colors.text.tertiary} />
          <Text style={styles.educationText} numberOfLines={1}>
            {latestEducation.degree || 'Studied'} at {latestEducation.school_name}
          </Text>
        </View>
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <StatPill icon="people" value={formatNumber(person.followers_count)} label="Followers" />
        <StatPill icon="link" value={formatNumber(person.connections_count)} label="Connections" />
        <StatPill icon="time" value={`${person.years_of_experience || 0}yr`} label="Experience" />
      </View>

      {/* Highlights & Skills */}
      <View style={styles.tagsContainer}>
        {person.people_highlights?.slice(0, 2).map((h, i) => (
          <Badge key={`h-${i}`} variant="default" style={styles.highlightBadge}>
            <Text style={styles.highlightText}>{h.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</Text>
          </Badge>
        ))}
        {topSkills.map((s: string, i: number) => (
          <Badge key={`s-${i}`} variant="outline" style={styles.skillBadge}>
            <Text style={styles.skillText}>{s}</Text>
          </Badge>
        ))}
      </View>

      {/* Action Row */}
      <View style={styles.actions}>
        <View style={styles.statusIndicator}>
          <View style={[
            styles.statusDot, 
            { backgroundColor: status === 'liked' ? colors.success : status === 'disliked' ? colors.destructive : colors.text.tertiary }
          ]} />
          <Text style={styles.statusText}>
            {status === 'liked' ? 'Liked' : status === 'disliked' ? 'Passed' : 'Not viewed'}
          </Text>
        </View>
        <View style={styles.buttonGroup}>
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

export default PersonCardV2;

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    gap: 16,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  contactIcons: {
    flexDirection: 'row',
    gap: 4,
  },
  tagline: {
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
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  metaText: {
    fontSize: 11,
    color: theme.colors.text.tertiary,
  },
  seniorityBadge: {
    height: 20,
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emoji: {
    fontSize: 14,
  },
  socialIcons: {
    gap: 8,
  },
  socialBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  educationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  educationText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 16,
  },
  highlightBadge: {
    backgroundColor: theme.colors.primary + '20',
    height: 24,
    paddingHorizontal: 8,
    borderColor: theme.colors.primary + '40',
  },
  highlightText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  skillBadge: {
    borderColor: 'rgba(255,255,255,0.1)',
    height: 24,
    paddingHorizontal: 8,
  },
  skillText: {
    fontSize: 11,
    color: theme.colors.text.secondary,
  },
  actions: {
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
  statusText: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
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
