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
import * as Haptics from "expo-haptics";
import { colors, getHighlightColor } from "../theme/colors";
import {
  Person,
  getCurrentJob,
  getFullName,
} from "../api/specter";
import { specterPublicAPI } from "../api/public-client";
import { PeopleStackParamList } from "../types/navigation";
import { useClerkToken } from "../hooks/useClerkToken";

type RouteProps = RouteProp<PeopleStackParamList, "PersonDetail">;

export default function PersonDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { getAuthToken } = useClerkToken();

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
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      const data = await specterPublicAPI.people.getById(personId, token);
      setPerson(data);
    } catch (err: any) {
      setError(err.message || "Failed to load person details");
      console.error("Load person detail error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async () => {
    if (!person) return;
    setActionLoading("like");
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      await specterPublicAPI.people.like(person.id, token);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPerson((prev) => prev ? { ...prev, my_status: "liked" } : prev);
    } catch (err) {
      console.error("Like error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDislike = async () => {
    if (!person) return;
    setActionLoading("dislike");
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      await specterPublicAPI.people.dislike(person.id, token);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPerson((prev) => prev ? { ...prev, my_status: "disliked" } : prev);
    } catch (err) {
      console.error("Dislike error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.brand.green} />
      </View>
    );
  }

  if (error || !person) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle" size={48} color={colors.error} />
        <Text style={styles.errorText}>{error || "Person not found"}</Text>
        <Pressable style={styles.retryButton} onPress={loadPersonDetail}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const fullName = getFullName(person);
  const currentJob = getCurrentJob(person);
  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {fullName}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {person.profile_image_url ? (
            <Image
              source={{ uri: person.profile_image_url }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}

          <Text style={styles.personName}>{fullName}</Text>

          {currentJob && (
            <Text style={styles.personTitle}>
              {currentJob.title} at {currentJob.org_name}
            </Text>
          )}

          {person.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={colors.text.tertiary} />
              <Text style={styles.locationText}>{person.location}</Text>
            </View>
          )}

          {/* Status Badge */}
          {person.my_status && (
            <View
              style={[
                styles.statusBadge,
                person.my_status === "liked" && styles.statusLiked,
                person.my_status === "disliked" && styles.statusDisliked,
              ]}
            >
              <Ionicons
                name={person.my_status === "liked" ? "heart" : "close"}
                size={14}
                color={person.my_status === "liked" ? colors.success : colors.error}
              />
              <Text
                style={[
                  styles.statusText,
                  person.my_status === "liked" && styles.statusTextLiked,
                  person.my_status === "disliked" && styles.statusTextDisliked,
                ]}
              >
                {person.my_status === "liked" ? "Liked" : "Passed"}
              </Text>
            </View>
          )}
        </View>

        {/* Links Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Links</Text>
          <View style={styles.linksRow}>
            {person.linkedin_url && (
              <Pressable
                style={styles.linkButton}
                onPress={() => Linking.openURL(person.linkedin_url!)}
              >
                <Ionicons name="logo-linkedin" size={20} color="#0A66C2" />
                <Text style={styles.linkText}>LinkedIn</Text>
              </Pressable>
            )}
            {person.twitter_url && (
              <Pressable
                style={styles.linkButton}
                onPress={() => Linking.openURL(person.twitter_url!)}
              >
                <Ionicons name="logo-twitter" size={20} color="#1DA1F2" />
                <Text style={styles.linkText}>Twitter</Text>
              </Pressable>
            )}
            {person.github_url && (
              <Pressable
                style={styles.linkButton}
                onPress={() => Linking.openURL(person.github_url!)}
              >
                <Ionicons name="logo-github" size={20} color={colors.text.primary} />
                <Text style={styles.linkText}>GitHub</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Bio Section */}
        {person.headline && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{person.headline}</Text>
          </View>
        )}

        {/* Experience Section */}
        {person.job_history && person.job_history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
            {person.job_history.slice(0, 5).map((job, index) => (
              <View key={index} style={styles.experienceItem}>
                <View style={styles.experienceDot} />
                <View style={styles.experienceContent}>
                  <Text style={styles.experienceTitle}>{job.title}</Text>
                  <Text style={styles.experienceCompany}>{job.org_name}</Text>
                  {job.start_date && (
                    <Text style={styles.experienceDate}>
                      {job.start_date} - {job.end_date || "Present"}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Education Section */}
        {person.education && person.education.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            {person.education.slice(0, 3).map((edu, index) => (
              <View key={index} style={styles.educationItem}>
                <Ionicons name="school-outline" size={18} color={colors.brand.green} />
                <View style={styles.educationContent}>
                  <Text style={styles.educationSchool}>{edu.school_name}</Text>
                  {edu.degree && <Text style={styles.educationDegree}>{edu.degree}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionsContainer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.actionButton, styles.actionDislike]}
          onPress={handleDislike}
          disabled={actionLoading !== null}
        >
          {actionLoading === "dislike" ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <Ionicons name="close" size={28} color={colors.error} />
          )}
        </Pressable>

        <Pressable
          style={[styles.actionButton, styles.actionLike]}
          onPress={handleLike}
          disabled={actionLoading !== null}
        >
          {actionLoading === "like" ? (
            <ActivityIndicator size="small" color={colors.success} />
          ) : (
            <Ionicons name="heart" size={28} color={colors.success} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card.bg,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: colors.text.primary,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    backgroundColor: colors.brand.green,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 36,
    fontWeight: "600",
    color: colors.text.inverse,
  },
  personName: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text.primary,
    textAlign: "center",
  },
  personTitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  locationText: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
    backgroundColor: colors.content.bgSecondary,
  },
  statusLiked: {
    backgroundColor: colors.tag.green.bg,
  },
  statusDisliked: {
    backgroundColor: colors.tag.red.bg,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.text.secondary,
  },
  statusTextLiked: {
    color: colors.success,
  },
  statusTextDisliked: {
    color: colors.error,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.tertiary,
    marginBottom: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  linksRow: {
    flexDirection: "row",
    gap: 12,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.content.bgSecondary,
  },
  linkText: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: "500",
  },
  bioText: {
    fontSize: 15,
    color: colors.text.primary,
    lineHeight: 22,
  },
  experienceItem: {
    flexDirection: "row",
    marginBottom: 16,
  },
  experienceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.green,
    marginTop: 6,
    marginRight: 12,
  },
  experienceContent: {
    flex: 1,
  },
  experienceTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
  },
  experienceCompany: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  experienceDate: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  educationItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  educationContent: {
    flex: 1,
  },
  educationSchool: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text.primary,
  },
  educationDegree: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 24,
    backgroundColor: colors.card.bg,
    borderTopWidth: 1,
    borderTopColor: colors.content.borderLight,
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  actionDislike: {
    backgroundColor: colors.tag.red.bg,
  },
  actionLike: {
    backgroundColor: colors.tag.green.bg,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.error,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: colors.brand.green,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.inverse,
  },
});
