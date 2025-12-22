import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { Person, getCurrentJob, getFullName } from "../../api/specter";

interface PersonCardProps {
  person: Person;
  onPress?: () => void;
  onLike?: () => void;
  onDislike?: () => void;
  onAddToList?: () => void;
}

export default function PersonCard({
  person,
  onPress,
  onLike,
  onDislike,
  onAddToList,
}: PersonCardProps) {
  const name = getFullName(person);
  const currentJob = getCurrentJob(person.experience || []);
  const status = person.entity_status?.status;

  const getStatusColor = () => {
    switch (status) {
      case "liked": return colors.status.liked;
      case "disliked": return colors.status.disliked;
      case "viewed": return colors.status.viewed;
      default: return null;
    }
  };

  const statusColor = getStatusColor();

  // Build subtitle: Title @ Company or just seniority
  const subtitle = currentJob
    ? `${currentJob.title} @ ${currentJob.company_name}`
    : person.seniority || "";

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.topRow}>
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
                {(person.first_name?.[0] || "").toUpperCase()}
                {(person.last_name?.[0] || "").toUpperCase()}
              </Text>
            </View>
          )}
          {statusColor && <View style={[styles.statusDot, { backgroundColor: statusColor }]} />}
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {person.seniority && (
            <Text style={styles.levelPill} numberOfLines={1}>
              {person.seniority}
            </Text>
          )}
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          {person.location ? (
            <Text style={styles.location} numberOfLines={1}>
              {person.location}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actionsRow}>
          <Pressable
          style={[styles.actionBtn, status === "disliked" && styles.actionActive]}
            onPress={onDislike}
          hitSlop={6}
          >
          <Ionicons
            name="close"
            size={18}
            color={status === "disliked" ? colors.error : colors.text.secondary}
          />
          </Pressable>
          <Pressable
          style={[styles.actionBtn, status === "liked" && styles.actionActive]}
            onPress={onLike}
          hitSlop={6}
          >
          <Ionicons
            name="heart"
            size={17}
            color={status === "liked" ? colors.brand.green : colors.text.secondary}
          />
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onAddToList} hitSlop={6}>
          <Ionicons name="add" size={20} color={colors.text.secondary} />
          </Pressable>
        </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.content.bg,
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#111827",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.95,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
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
    fontSize: 14,
    fontWeight: "600",
  },
  statusDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#fff",
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },
  levelPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#eef4ff",
    color: colors.brand.blue,
    fontSize: 11,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  location: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  actionsRow: {
    flexDirection: "row",
    marginTop: 14,
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.content.border,
    alignItems: "center",
    justifyContent: "center",
  },
  actionActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#d1fae5",
  },
});
