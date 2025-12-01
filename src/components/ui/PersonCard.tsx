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
      {/* Avatar */}
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
        {statusColor && <View style={[styles.statusDot, { backgroundColor: statusColor }]} />}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {person.seniority && (
            <>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.seniority} numberOfLines={1}>{person.seniority}</Text>
            </>
          )}
        </View>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionBtn, status === "disliked" && styles.actionActive]}
          onPress={onDislike}
          hitSlop={6}
        >
          <Ionicons
            name="close"
            size={18}
            color={status === "disliked" ? colors.error : colors.text.tertiary}
          />
        </Pressable>
        <Pressable
          style={[styles.actionBtn, status === "liked" && styles.actionActive]}
          onPress={onLike}
          hitSlop={6}
        >
          <Ionicons
            name="heart"
            size={16}
            color={status === "liked" ? colors.brand.green : colors.text.tertiary}
          />
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onAddToList} hitSlop={6}>
          <Ionicons name="add" size={18} color={colors.text.tertiary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card.bg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.borderLight,
  },
  cardPressed: {
    backgroundColor: colors.content.bgSecondary,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.content.bgSecondary,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.card.bg,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
    flexShrink: 1,
  },
  separator: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginHorizontal: 6,
  },
  seniority: {
    fontSize: 12,
    color: colors.brand.blue,
    fontWeight: "500",
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionActive: {
    backgroundColor: colors.content.bgTertiary,
  },
});
