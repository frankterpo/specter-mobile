import React, { useState } from "react";
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
import { PeopleStackParamList } from "../types/navigation";
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

type RouteProps = RouteProp<PeopleStackParamList, "PersonDetail">;
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

export default function PersonDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { getAuthToken } = useClerkToken();
  const { colors, spacing, typography } = theme;

  const { personId } = route.params;
  const [activeTab, setActiveTab] = useState<'Experience' | 'Education' | 'Skills' | 'Contact'>('Experience');
  const [isListSheetVisible, setIsListSheetVisible] = useState(false);

  const statusMutation = useEntityStatusMutation();

  const { data: person, isLoading, error, refetch } = useQuery({
    queryKey: ['person', personId],
    queryFn: async () => {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      const data = await specterPublicAPI.people.getById(personId, token);
      
      // Mark as viewed
      statusMutation.mutate({ id: personId, type: 'people', status: 'viewed' });
      
      return data;
    }
  });

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !person) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle" size={48} color={colors.destructive} />
        <Text style={styles.errorText}>{(error as Error)?.message || "Person not found"}</Text>
        <GlassButton label="Retry" onPress={() => refetch()} style={{ marginTop: 20 }} />
      </View>
    );
  }

  const name = person.full_name || `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown';
  const currentExp = person.experience?.[0];
  const hasEmail = !!(person as any).email;
  const hasPhone = !!(person as any).phone;
  const educationLevel = (person as any).education_level;
  const avgTenure = (person as any).avg_tenure;
  const currentTenure = (person as any).current_tenure;

  return (
    <View style={styles.container}>
      {/* Hero Section */}
      <View style={styles.hero}>
        <LinearGradient
          colors={[colors.sidebar.bg, colors.primary + '40', colors.background]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.navHeader, { paddingTop: insets.top }]}>
          <GlassButton icon="arrow-back" onPress={() => navigation.goBack()} />
          <View style={styles.headerActions}>
            <GlassButton icon="share-outline" />
            <GlassButton icon="ellipsis-horizontal" />
          </View>
        </View>

        <Animated.View entering={FadeInUp.delay(200)} style={styles.heroContent}>
          <Avatar src={person.profile_image_url} fallback={name} size={100} style={styles.heroAvatar} />
          <View style={styles.nameContainer}>
            <Text style={styles.name}>{name}</Text>
            <View style={styles.contactIndicators}>
              {hasEmail && <Ionicons name="mail" size={16} color={colors.primary} />}
              {hasPhone && <Ionicons name="call" size={16} color={colors.primary} />}
            </View>
          </View>
          <Text style={styles.tagline}>{person.tagline || (currentExp ? `${currentExp.title} @ ${currentExp.company_name}` : 'No title available')}</Text>
          <View style={styles.heroMeta}>
            <Text style={styles.metaText}>📍 {person.region || person.location || 'Global'}</Text>
            {person.seniority && <Badge variant="secondary" style={styles.seniorityBadge}>
              <Text style={styles.badgeText}>{person.seniority}</Text>
            </Badge>}
            {currentExp?.is_unicorn && <Text style={styles.emoji}>🦄</Text>}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{person.followers_count?.toLocaleString() || '0'}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{person.connections_count?.toLocaleString() || '0'}</Text>
              <Text style={styles.statLabel}>Connections</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{person.years_of_experience || '0'}yr</Text>
              <Text style={styles.statLabel}>Experience</Text>
            </View>
          </View>

          {/* Extra Metrics Bar */}
          <View style={styles.extraMetrics}>
            {avgTenure && (
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Avg. Tenure</Text>
                <Text style={styles.metricValue}>{avgTenure} mo</Text>
              </View>
            )}
            {currentTenure && (
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Current</Text>
                <Text style={styles.metricValue}>{currentTenure} mo</Text>
              </View>
            )}
            {educationLevel && (
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Education</Text>
                <Text style={styles.metricValue} numberOfLines={1}>{educationLevel}</Text>
              </View>
            )}
          </View>

          <View style={styles.heroHighlights}>
            {person.people_highlights?.slice(0, 3).map((h, i) => (
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
          {(['Experience', 'Education', 'Skills', 'Contact'] as const).map(tab => (
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
          {activeTab === 'Experience' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Experience Timeline</Text>
              {person.experience?.map((exp, i) => (
                <View key={i} style={styles.timelineItem}>
                  <View style={styles.timelineLine}>
                    <View style={styles.timelineDot} />
                    {i < person.experience.length - 1 && <View style={styles.timelineConnector} />}
                  </View>
                  <GlassCard style={styles.experienceCard}>
                    <View style={styles.expHeader}>
                      <Avatar src={(exp as any).logo_url} fallback={exp.company_name} size={40} style={styles.companyLogo} />
                      <View style={styles.expTitleInfo}>
                        <Text style={styles.expTitle}>{exp.title}</Text>
                        <Text style={styles.expCompany}>{exp.company_name}</Text>
                      </View>
                    </View>
                    <Text style={styles.expDate}>
                      {exp.start_date ? new Date(exp.start_date).getFullYear() : '?'} - {exp.is_current ? 'Present' : (exp.end_date ? new Date(exp.end_date).getFullYear() : '?')}
                    </Text>
                    
                    <View style={styles.expMeta}>
                      {exp.industry && <Badge variant="secondary" style={styles.expBadge}><Text style={styles.expBadgeText}>{exp.industry}</Text></Badge>}
                      {exp.company_size && <Badge variant="secondary" style={styles.expBadge}><Text style={styles.expBadgeText}>{exp.company_size}</Text></Badge>}
                    </View>
                  </GlassCard>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'Education' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Education</Text>
              {person.education?.map((edu, i) => (
                <GlassCard key={i} style={styles.educationCard}>
                  <View style={styles.eduHeader}>
                    <Ionicons name="school" size={32} color={colors.primary} />
                    <View style={styles.eduTitleInfo}>
                      <Text style={styles.eduSchool}>{edu.school_name}</Text>
                      <Text style={styles.eduDegree}>{edu.degree} in {edu.field_of_study}</Text>
                    </View>
                  </View>
                  <Text style={styles.eduDate}>
                    {edu.start_date ? new Date(edu.start_date).getFullYear() : '?'} - {edu.end_date ? new Date(edu.end_date).getFullYear() : '?'}
                  </Text>
                </GlassCard>
              )) || <Text style={styles.emptyText}>No education listed.</Text>}
            </View>
          )}

          {activeTab === 'Skills' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Skills & Expertise</Text>
              <View style={styles.skillsGrid}>
                {(person as any).top_skills?.map((skill: string, i: number) => (
                  <GlassCard key={i} style={styles.skillCard}>
                    <Text style={styles.skillName}>{skill}</Text>
                  </GlassCard>
                )) || <Text style={styles.emptyText}>No skills listed.</Text>}
              </View>
            </View>
          )}

          {activeTab === 'Contact' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Get in Touch</Text>
              <GlassCard style={styles.contactCard}>
                <View style={styles.contactItem}>
                  <Ionicons name="mail-outline" size={24} color={colors.primary} />
                  <View>
                    <Text style={styles.contactLabel}>Email Address</Text>
                    <Text style={styles.contactValue}>{(person as any).email || 'Available on request'}</Text>
                  </View>
                  {(person as any).email && (
                    <GlassButton 
                      icon="copy-outline" 
                      style={styles.copyBtn} 
                      onPress={() => {}} 
                    />
                  )}
                </View>
                <View style={styles.contactDivider} />
                <View style={styles.contactItem}>
                  <Ionicons name="call-outline" size={24} color={colors.primary} />
                  <View>
                    <Text style={styles.contactLabel}>Phone Number</Text>
                    <Text style={styles.contactValue}>{(person as any).phone || 'Not provided'}</Text>
                  </View>
                </View>
              </GlassCard>

              <View style={styles.socialGrid}>
                {person.linkedin_url && (
                  <GlassCard style={styles.socialCard} onPress={() => Linking.openURL(person.linkedin_url!)}>
                    <Ionicons name="logo-linkedin" size={24} color="#0077b5" />
                    <Text style={styles.socialText}>LinkedIn</Text>
                  </GlassCard>
                )}
                {(person as any).twitter_url && (
                  <GlassCard style={styles.socialCard} onPress={() => Linking.openURL((person as any).twitter_url)}>
                    <Ionicons name="logo-twitter" size={24} color="#1DA1F2" />
                    <Text style={styles.socialText}>Twitter</Text>
                  </GlassCard>
                )}
                {(person as any).github_url && (
                  <GlassCard style={styles.socialCard} onPress={() => Linking.openURL((person as any).github_url)}>
                    <Ionicons name="logo-github" size={24} color={colors.text.primary} />
                    <Text style={styles.socialText}>GitHub</Text>
                  </GlassCard>
                )}
              </View>
            </View>
          )}
        </Animated.View>
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Floating Action Bar */}
      <View style={[styles.floatingActions, { paddingBottom: insets.bottom + 10 }]}>
        <GlassButton 
          icon="close" 
          variant="destructive" 
          style={styles.mainAction} 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            statusMutation.mutate({ id: personId, type: 'people', status: 'disliked' });
            navigation.goBack();
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
            statusMutation.mutate({ id: personId, type: 'people', status: 'liked' });
          }}
        />
      </View>

      <AddToListSheet
        visible={isListSheetVisible}
        onClose={() => setIsListSheetVisible(false)}
        entityId={personId}
        entityType="person"
        entityName={name}
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
    gap: 12,
  },
  heroContent: {
    alignItems: 'center',
  },
  heroAvatar: {
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 50,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.text.primary,
  },
  contactIndicators: {
    flexDirection: 'row',
    gap: 6,
  },
  tagline: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  metaText: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
    fontWeight: '600',
  },
  seniorityBadge: {
    height: 24,
    paddingHorizontal: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emoji: {
    fontSize: 18,
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
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text.primary,
  },
  statLabel: {
    fontSize: 10,
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
    gap: 8,
    marginTop: 20,
  },
  extraMetrics: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 9,
    color: theme.colors.text.tertiary,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  metricValue: {
    fontSize: 12,
    color: theme.colors.text.primary,
    fontWeight: '700',
    marginTop: 2,
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
    marginBottom: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 16,
  },
  timelineLine: {
    width: 20,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.background,
    zIndex: 1,
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: -2,
  },
  experienceCard: {
    flex: 1,
    marginBottom: 24,
    padding: 16,
    borderRadius: 20,
  },
  expHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  companyLogo: {
    borderRadius: 8,
  },
  expTitleInfo: {
    flex: 1,
  },
  expTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  expCompany: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  expDate: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    marginTop: 8,
    fontWeight: '600',
  },
  expMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  expBadge: {
    height: 20,
    paddingHorizontal: 6,
  },
  expBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  educationCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 20,
  },
  eduHeader: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  eduTitleInfo: {
    flex: 1,
  },
  eduSchool: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text.primary,
  },
  eduDegree: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  eduDate: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    marginTop: 12,
    fontWeight: '600',
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  skillCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginVertical: 0,
  },
  skillName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  contactCard: {
    borderRadius: 24,
    padding: 0,
    overflow: 'hidden',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
  },
  contactLabel: {
    fontSize: 11,
    color: theme.colors.text.tertiary,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginTop: 2,
  },
  copyBtn: {
    marginLeft: 'auto',
    width: 36,
    height: 36,
  },
  contactDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  socialGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  socialCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    gap: 8,
  },
  socialText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.secondary,
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
  errorText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
    marginTop: 20,
  },
});
