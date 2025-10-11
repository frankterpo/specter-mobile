import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useAuth } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import {
  fetchPersonDetail,
  likePerson,
  dislikePerson,
  Person,
  getCurrentJob,
  getFullName,
  getInitials,
  formatHighlight,
} from "../api/specter";

type MainStackParamList = {
  PeopleList: undefined;
  PersonDetail: { personId: string };
  Settings: undefined;
};

type PersonDetailScreenProps = {
  navigation: NativeStackNavigationProp<MainStackParamList, "PersonDetail">;
  route: RouteProp<MainStackParamList, "PersonDetail">;
};

export default function PersonDetailScreen({
  navigation,
  route,
}: PersonDetailScreenProps) {
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
    if (!person) return;

    setActionLoading("like");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      await likePerson(token, person.id);
      
      // Update local state
      setPerson({
        ...person,
        entity_status: { status: "liked" },
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Navigate back after short delay
      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to like person");
      console.error("Like error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDislike = async () => {
    if (!person) return;

    setActionLoading("dislike");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      await dislikePerson(token, person.id);
      
      // Update local state
      setPerson({
        ...person,
        entity_status: { status: "disliked" },
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Navigate back after short delay
      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to dislike person");
      console.error("Dislike error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#1a365d" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (error || !person) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>{error || "Person not found"}</Text>
        <Pressable onPress={loadPersonDetail} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={styles.backToListButton}>
          <Text style={styles.backToListButtonText}>Back to List</Text>
        </Pressable>
      </View>
    );
  }

  const currentJob = getCurrentJob(person.experience);
  const fullName = getFullName(person);
  const initials = getInitials(person);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1a365d" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {fullName}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          {person.profile_image_url ? (
            <Image
              source={{ uri: person.profile_image_url }}
              style={styles.profileImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
              <Text style={styles.profileImageText}>{initials}</Text>
            </View>
          )}

          <Text style={styles.fullName}>{fullName}</Text>

          {currentJob && (
            <Text style={styles.currentJob}>
              {currentJob.title} at {currentJob.company_name}
            </Text>
          )}

          <View style={styles.metaRow}>
            {person.location && (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={16} color="#64748b" />
                <Text style={styles.metaText}>{person.location}</Text>
              </View>
            )}
            {person.seniority && (
              <View style={styles.metaItem}>
                <Ionicons name="briefcase-outline" size={16} color="#64748b" />
                <Text style={styles.metaText}>{person.seniority}</Text>
              </View>
            )}
            {person.years_of_experience !== undefined && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={16} color="#64748b" />
                <Text style={styles.metaText}>{person.years_of_experience} years</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tagline Section */}
        {person.tagline && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.tagline}>{person.tagline}</Text>
          </View>
        )}

        {/* Highlights Section */}
        {person.people_highlights && person.people_highlights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Highlights</Text>
            <View style={styles.highlightsContainer}>
              {person.people_highlights.map((highlight, index) => (
                <View key={index} style={styles.highlightBadge}>
                  <Text style={styles.highlightText}>{formatHighlight(highlight)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Experience Section */}
        {person.experience && person.experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
            {person.experience.map((exp, index) => (
              <View key={index} style={styles.experienceItem}>
                <View style={styles.experienceHeader}>
                  <Text style={styles.companyName}>{exp.company_name}</Text>
                  {exp.is_current && (
                    <View style={styles.currentBadge}>
                      <View style={styles.currentDot} />
                      <Text style={styles.currentText}>Current</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.jobTitle}>{exp.title}</Text>
                {exp.company_size && (
                  <Text style={styles.companyDetail}>Size: {exp.company_size}</Text>
                )}
                {exp.total_funding_amount !== undefined && exp.total_funding_amount > 0 && (
                  <Text style={styles.companyDetail}>
                    Funding: ${(exp.total_funding_amount / 1000000).toFixed(1)}M
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Bottom Padding */}
        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionButtons, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={handleDislike}
          disabled={actionLoading !== null}
          style={({ pressed }) => [
            styles.actionButton,
            styles.dislikeButton,
            (pressed || actionLoading === "dislike") && styles.actionButtonPressed,
          ]}
        >
          {actionLoading === "dislike" ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="thumbs-down" size={20} color="white" />
              <Text style={styles.actionButtonText}>Pass</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={handleLike}
          disabled={actionLoading !== null}
          style={({ pressed }) => [
            styles.actionButton,
            styles.likeButton,
            (pressed || actionLoading === "like") && styles.actionButtonPressed,
          ]}
        >
          {actionLoading === "like" ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="thumbs-up" size={20} color="white" />
              <Text style={styles.actionButtonText}>Like</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f7fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#1a365d",
    textAlign: "center",
    marginHorizontal: 8,
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  profileImagePlaceholder: {
    backgroundColor: "#1a365d",
    alignItems: "center",
    justifyContent: "center",
  },
  profileImageText: {
    fontSize: 40,
    fontWeight: "600",
    color: "white",
  },
  fullName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a365d",
    textAlign: "center",
    marginBottom: 8,
  },
  currentJob: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 14,
    color: "#64748b",
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a365d",
    marginBottom: 12,
  },
  tagline: {
    fontSize: 15,
    color: "#475569",
    lineHeight: 22,
  },
  highlightsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  highlightBadge: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  highlightText: {
    color: "white",
    fontSize: 13,
    fontWeight: "500",
  },
  experienceItem: {
    marginBottom: 20,
  },
  experienceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    flex: 1,
  },
  currentBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  currentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  currentText: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "500",
  },
  jobTitle: {
    fontSize: 15,
    color: "#64748b",
    marginBottom: 4,
  },
  companyDetail: {
    fontSize: 14,
    color: "#94a3b8",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
    backgroundColor: "white",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  likeButton: {
    backgroundColor: "#10b981",
  },
  dislikeButton: {
    backgroundColor: "#ef4444",
  },
  actionButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  actionButtonPressed: {
    opacity: 0.7,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748b",
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: "#ef4444",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: "#1a365d",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  backToListButton: {
    marginTop: 12,
    paddingVertical: 8,
  },
  backToListButtonText: {
    color: "#64748b",
    fontSize: 15,
  },
});
