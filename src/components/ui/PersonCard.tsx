import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, getHighlightColor } from "../../theme/colors";
import { Person, getCurrentJob, getFullName } from "../../api/specter";

interface PersonCardProps {
  person: Person;
  onPress?: () => void;
  onLike?: () => void;
  onDislike?: () => void;
  onSave?: () => void;
  compact?: boolean;
}

export default function PersonCard({
  person,
  onPress,
  onLike,
  onDislike,
  onSave,
  compact = false,
}: PersonCardProps) {
  const name = getFullName(person);
  const currentJob = getCurrentJob(person.experience || []);
  const highlights = person.people_highlights?.slice(0, 3) || [];
  const location = person.location || person.region || "";

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      {/* Header: Avatar + Name + Title */}
      <View style={styles.header}>
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
          {/* Status indicator */}
          {person.entity_status?.status === "liked" && (
            <View style={[styles.statusDot, styles.statusLiked]} />
          )}
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {currentJob && (
            <Text style={styles.title} numberOfLines={1}>
              {currentJob.title} at {currentJob.company_name}
            </Text>
          )}
          {location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={11} color={colors.text.tertiary} />
              <Text style={styles.locationText}>{location}</Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {onSave && (
            <Pressable style={styles.actionBtn} onPress={onSave} hitSlop={8}>
              <Ionicons name="bookmark-outline" size={18} color={colors.text.secondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Tagline */}
      {person.tagline && !compact && (
        <Text style={styles.tagline} numberOfLines={2}>
          {person.tagline}
        </Text>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <View style={styles.highlightsRow}>
          {highlights.map((highlight, idx) => (
            <View
              key={idx}
              style={[
                styles.highlightBadge,
                { backgroundColor: getHighlightColor(highlight) + "20" },
              ]}
            >
              <View
                style={[
                  styles.highlightDot,
                  { backgroundColor: getHighlightColor(highlight) },
                ]}
              />
              <Text
                style={[
                  styles.highlightText,
                  { color: getHighlightColor(highlight) },
                ]}
              >
                {formatHighlight(highlight)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Info row */}
      {!compact && (
        <View style={styles.infoRow}>
          {person.seniority && (
            <View style={styles.infoPill}>
              <Ionicons name="briefcase-outline" size={12} color={colors.text.secondary} />
              <Text style={styles.infoPillText}>{person.seniority}</Text>
            </View>
          )}
          {person.years_of_experience && (
            <View style={styles.infoPill}>
              <Ionicons name="time-outline" size={12} color={colors.text.secondary} />
              <Text style={styles.infoPillText}>{person.years_of_experience} yrs exp</Text>
            </View>
          )}
          {currentJob?.company_size && (
            <View style={styles.infoPill}>
              <Ionicons name="people-outline" size={12} color={colors.text.secondary} />
              <Text style={styles.infoPillText}>{currentJob.company_size}</Text>
            </View>
          )}
        </View>
      )}

      {/* Social links */}
      {!compact && (person.linkedin_url || person.twitter_url || person.github_url) && (
        <View style={styles.socialRow}>
          {person.linkedin_url && (
            <View style={styles.socialIcon}>
              <Ionicons name="logo-linkedin" size={14} color="#0077B5" />
            </View>
          )}
          {person.twitter_url && (
            <View style={styles.socialIcon}>
              <Ionicons name="logo-twitter" size={14} color="#1DA1F2" />
            </View>
          )}
          {person.github_url && (
            <View style={styles.socialIcon}>
              <Ionicons name="logo-github" size={14} color={colors.text.primary} />
            </View>
          )}
        </View>
      )}

      {/* Footer actions */}
      {!compact && (onLike || onDislike) && (
        <View style={styles.footer}>
          <Pressable
            style={[styles.footerBtn, styles.footerBtnDislike]}
            onPress={onDislike}
          >
            <Ionicons name="close" size={18} color={colors.error} />
            <Text style={[styles.footerBtnText, { color: colors.error }]}>Pass</Text>
          </Pressable>

          <Pressable
            style={[styles.footerBtn, styles.footerBtnLike]}
            onPress={onLike}
          >
            <Ionicons name="heart" size={18} color={colors.brand.green} />
            <Text style={[styles.footerBtnText, { color: colors.brand.green }]}>Like</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

function formatHighlight(highlight: string): string {
  return highlight
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardCompact: {
    padding: 12,
    marginVertical: 4,
  },
  cardPressed: {
    backgroundColor: colors.content.bgSecondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  avatarContainer: {
    marginRight: 12,
    position: "relative",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.content.bgSecondary,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: "600",
  },
  statusDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.card.bg,
  },
  statusLiked: {
    backgroundColor: colors.brand.green,
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 2,
  },
  title: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  locationText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    padding: 6,
  },
  tagline: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  highlightsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  highlightBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  highlightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  highlightText: {
    fontSize: 11,
    fontWeight: "600",
  },
  infoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.content.bgSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  infoPillText: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  socialRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  socialIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.content.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.content.border,
  },
  footerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  footerBtnDislike: {
    backgroundColor: colors.tag.red.bg,
  },
  footerBtnLike: {
    backgroundColor: colors.tag.green.bg,
  },
  footerBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
});

