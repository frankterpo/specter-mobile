import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useAuth } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import { colors, getHighlightColor } from "../theme/colors";
import {
  fetchPersonDetail,
  likePerson,
  dislikePerson,
  Person,
  getCurrentJob,
  getFullName,
} from "../api/specter";
import { PeopleStackParamList } from "../types/navigation";

type RouteProps = RouteProp<PeopleStackParamList, "PersonDetail">;

export default function PersonDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();

  const { personId } = route.params;
  const [person, setPerson] = useState<Person | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<"like" | "dislike" | null>(null);

  useEffect(() => {
    loadPersonDetail();
  }, [personId]);

  const loadPersonDetail = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const data = await fetchPersonDetail(token, personId);
      setPerson(data);
    } catch (err: any) {
      setError(err.message || "Failed to load person details");
      console.error("Load person detail error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async () => {
    if (!person || actionLoading) return;

    setActionLoading("like");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required");

      await likePerson(token, person.id);
      setPerson({
        ...person,
        entity_status: { status: "liked", updated_at: new Date().toISOString() },
      });
    } catch (err: any) {
      console.error("Like error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDislike = async () => {
    if (!person || actionLoading) return;

    setActionLoading("dislike");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required");

      await dislikePerson(token, person.id);
      setPerson({
        ...person,
        entity_status: { status: "disliked", updated_at: new Date().toISOString() },
      });
    } catch (err: any) {
      console.error("Dislike error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.brand.green} />
      </View>
    );
  }

  if (error || !person) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error || "Person not found"}</Text>
        <Pressable style={styles.retryButton} onPress={loadPersonDetail}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const name = getFullName(person);
  const currentJob = getCurrentJob(person.experience || []);
  const highlights = person.people_highlights || [];
  const location = person.location || person.region || "";
  const isLiked = person.entity_status?.status === "liked";
  const isDisliked = person.entity_status?.status === "disliked";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerBtn}>
            <Ionicons name="share-outline" size={22} color={colors.text.secondary} />
          </Pressable>
          <Pressable style={styles.headerBtn}>
            <Ionicons name="bookmark-outline" size={22} color={colors.text.secondary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <View style={styles.card}>
          {/* Avatar + Name */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              {person.profile_image_url ? (
                <Image
                  source={{ uri: person.profile_image_url }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {(person.first_name?.[0] || "") + (person.last_name?.[0] || "")}
                  </Text>
                </View>
              )}
              {/* Status badge */}
              {isLiked && (
                <View style={[styles.statusBadge, styles.statusLiked]}>
                  <Ionicons name="heart" size={12} color={colors.text.inverse} />
                </View>
              )}
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.name}>{name}</Text>
              {currentJob && (
                <Text style={styles.title}>
                  {currentJob.title} at {currentJob.company_name}
                </Text>
              )}
              {location && (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color={colors.text.tertiary} />
                  <Text style={styles.locationText}>{location}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Tagline */}
          {person.tagline && (
            <Text style={styles.tagline}>{person.tagline}</Text>
          )}

          {/* Highlights */}
          {highlights.length > 0 && (
            <View style={styles.highlightsRow}>
              {highlights.slice(0, 4).map((highlight, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.highlightBadge,
                    { backgroundColor: getHighlightColor(highlight) + "20" },
                  ]}
                >
                  <View
                    style={[styles.highlightDot, { backgroundColor: getHighlightColor(highlight) }]}
                  />
                  <Text style={[styles.highlightText, { color: getHighlightColor(highlight) }]}>
                    {formatHighlight(highlight)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionBtn, styles.dislikeBtn, isDisliked && styles.actionBtnActive]}
              onPress={handleDislike}
              disabled={actionLoading !== null}
            >
              {actionLoading === "dislike" ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <>
                  <Ionicons name="close" size={22} color={colors.error} />
                  <Text style={[styles.actionBtnText, { color: colors.error }]}>Pass</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.likeBtn, isLiked && styles.actionBtnActive]}
              onPress={handleLike}
              disabled={actionLoading !== null}
            >
              {actionLoading === "like" ? (
                <ActivityIndicator size="small" color={colors.brand.green} />
              ) : (
                <>
                  <Ionicons name={isLiked ? "heart" : "heart-outline"} size={22} color={colors.brand.green} />
                  <Text style={[styles.actionBtnText, { color: colors.brand.green }]}>
                    {isLiked ? "Liked" : "Like"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* Info card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Ionicons name="briefcase-outline" size={18} color={colors.text.tertiary} />
              <Text style={styles.infoLabel}>Seniority</Text>
              <Text style={styles.infoValue}>{person.seniority || "N/A"}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={18} color={colors.text.tertiary} />
              <Text style={styles.infoLabel}>Experience</Text>
              <Text style={styles.infoValue}>
                {person.years_of_experience ? `${person.years_of_experience} years` : "N/A"}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="school-outline" size={18} color={colors.text.tertiary} />
              <Text style={styles.infoLabel}>Education</Text>
              <Text style={styles.infoValue}>{person.education_level || "N/A"}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="book-outline" size={18} color={colors.text.tertiary} />
              <Text style={styles.infoLabel}>Field</Text>
              <Text style={styles.infoValue}>{person.field_of_study || "N/A"}</Text>
            </View>
          </View>
        </View>

        {/* Experience card */}
        {person.experience && person.experience.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Experience</Text>
            <View style={styles.experienceList}>
              {person.experience.slice(0, 5).map((exp, idx) => (
                <View key={idx} style={styles.experienceItem}>
                  <View style={styles.experienceHeader}>
                    <View style={styles.expIconContainer}>
                      <Ionicons
                        name={exp.is_current ? "business" : "business-outline"}
                        size={18}
                        color={exp.is_current ? colors.brand.green : colors.text.tertiary}
                      />
                    </View>
                    <View style={styles.experienceInfo}>
                      <Text style={styles.expTitle}>{exp.title}</Text>
                      <Text style={styles.expCompany}>{exp.company_name}</Text>
                      {(exp.start_date || exp.end_date) && (
                        <Text style={styles.expDates}>
                          {exp.start_date || "?"} - {exp.is_current ? "Present" : exp.end_date || "?"}
                        </Text>
                      )}
                    </View>
                    {exp.is_current && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Current</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Social links */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Links</Text>
          <View style={styles.linksRow}>
            {person.linkedin_url && (
              <Pressable
                style={styles.linkBtn}
                onPress={() => openUrl(person.linkedin_url || "")}
              >
                <Ionicons name="logo-linkedin" size={18} color="#0077B5" />
                <Text style={styles.linkText}>LinkedIn</Text>
              </Pressable>
            )}
            {person.twitter_url && (
              <Pressable
                style={styles.linkBtn}
                onPress={() => openUrl(person.twitter_url || "")}
              >
                <Ionicons name="logo-twitter" size={18} color="#1DA1F2" />
                <Text style={styles.linkText}>Twitter</Text>
              </Pressable>
            )}
            {person.github_url && (
              <Pressable
                style={styles.linkBtn}
                onPress={() => openUrl(person.github_url || "")}
              >
                <Ionicons name="logo-github" size={18} color={colors.text.primary} />
                <Text style={styles.linkText}>GitHub</Text>
              </Pressable>
            )}
            {!person.linkedin_url && !person.twitter_url && !person.github_url && (
              <Text style={styles.noLinksText}>No social links available</Text>
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function formatHighlight(highlight: string): string {
  return highlight
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.content.bgSecondary,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.content.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.border,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerBtn: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: colors.card.bg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  profileHeader: {
    flexDirection: "row",
    marginBottom: 14,
  },
  avatarContainer: {
    marginRight: 14,
    position: "relative",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.content.bgSecondary,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.text.inverse,
    fontSize: 22,
    fontWeight: "600",
  },
  statusBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.card.bg,
  },
  statusLiked: {
    backgroundColor: colors.brand.green,
  },
  profileInfo: {
    flex: 1,
    justifyContent: "center",
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  tagline: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 14,
  },
  highlightsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  highlightBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 6,
  },
  highlightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  highlightText: {
    fontSize: 12,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  actionBtnActive: {
    borderWidth: 2,
  },
  dislikeBtn: {
    backgroundColor: colors.tag.red.bg,
  },
  likeBtn: {
    backgroundColor: colors.tag.green.bg,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 12,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  infoItem: {
    width: "47%",
    backgroundColor: colors.content.bgSecondary,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },
  experienceList: {
    gap: 12,
  },
  experienceItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.content.border,
    paddingBottom: 12,
  },
  experienceHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  expIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.content.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  experienceInfo: {
    flex: 1,
  },
  expTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 2,
  },
  expCompany: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  expDates: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  currentBadge: {
    backgroundColor: colors.brand.green + "20",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.brand.green,
  },
  linksRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.content.bgSecondary,
    borderRadius: 8,
  },
  linkText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  noLinksText: {
    fontSize: 13,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.brand.green,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.inverse,
  },
});
