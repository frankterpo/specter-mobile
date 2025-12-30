import React, { memo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { Person, getCurrentJob, getFullName } from "../../api/specter";
import { Card } from "./shadcn/Card";
import { Avatar } from "./shadcn/Avatar";
import { Badge } from "./shadcn/Badge";
import { Button } from "./shadcn/Button";

interface PersonCardProps {
  person: Person;
  onPress?: () => void;
  onLike?: () => void;
  onDislike?: () => void;
  onAddToList?: () => void;
  onRemoveFromList?: () => void;
}

function PersonCard({
  person,
  onPress,
  onLike,
  onDislike,
  onAddToList,
  onRemoveFromList,
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
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatarContainer}>
          <Avatar
            src={person.profile_image_url}
            fallback={name}
            size={48}
          />
          {statusColor && <View style={[styles.statusDot, { backgroundColor: statusColor }]} />}
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {person.seniority ? (
            <Badge variant="secondary" size="sm" style={styles.levelPill}>
              {person.seniority}
            </Badge>
          ) : null}
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
        <Button
          variant={status === "disliked" ? "destructive" : "outline"}
          size="icon"
          icon="close"
          onPress={onDislike}
          style={[
            styles.actionBtn,
            status === "disliked" && styles.actionActive,
          ]}
        />
        <Button
          variant={status === "liked" ? "default" : "outline"}
          size="icon"
          icon="heart"
          onPress={onLike}
          style={[
            styles.actionBtn,
            status === "liked" && styles.actionActive,
          ]}
        />
        <Button
          variant="outline"
          size="icon"
          icon="add"
          onPress={onAddToList}
          style={styles.actionBtn}
        />
        {onRemoveFromList && (
          <Button
            variant="destructive"
            size="icon"
            icon="remove-circle"
            onPress={onRemoveFromList}
            style={styles.actionBtn}
          />
        )}
      </View>
    </Card>
  );
}

export default memo(PersonCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    padding: 24,
    gap: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
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
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
  },
  levelPill: {
    alignSelf: "flex-start",
    marginTop: 2,
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
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
  },
  actionActive: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
});
