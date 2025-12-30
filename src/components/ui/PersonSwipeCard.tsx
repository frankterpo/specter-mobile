import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  ScrollView,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { Person, getCurrentJob, getFullName, getHighlightColor, formatHighlight } from "../../api/specter";
import Animated, {
  useAnimatedStyle,
  SharedValue,
  interpolate,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CARD_HEIGHT = SCREEN_HEIGHT * 0.7;

interface PersonSwipeCardProps {
  person: Person;
  translateX: SharedValue<number>;
  index: number;
}

export default function PersonSwipeCard({
  person,
  translateX,
  index,
}: PersonSwipeCardProps) {
  const name = getFullName(person);
  const currentJob = getCurrentJob(person.experience || []);
  const scrollRef = useRef<ScrollView>(null);

  const cardStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [0.9, 1, 0.9]
    );
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-10, 0, 10]
    );

    return {
      transform: [
        { translateX: translateX.value },
        { scale },
        { rotate: `${rotate}deg` },
      ],
      zIndex: 100 - index,
    };
  });

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SCREEN_WIDTH * 0.3], [0, 1]),
  }));

  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SCREEN_WIDTH * 0.3, 0], [1, 0]),
  }));

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      {/* Swipe Status Labels */}
      <Animated.View style={[styles.label, styles.likeLabel, likeOpacity]}>
        <Text style={styles.labelText}>LIKE</Text>
      </Animated.View>
      <Animated.View style={[styles.label, styles.nopeLabel, nopeOpacity]}>
        <Text style={styles.labelText}>NOPE</Text>
      </Animated.View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={true}
      >
        {/* Top Image & Hero Info */}
        <View style={styles.heroSection}>
          {person.profile_image_url ? (
            <Image
              source={{
                uri: person.profile_image_url,
                // Enable caching for better performance
                cacheKey: `person-hero-${person.profile_image_url.split('/').pop()}`,
              }}
              style={styles.heroImage}
              contentFit="cover"
              // Enable disk caching
              cachePolicy="disk"
              // Smooth transition for loading
              transition={200}
            />
          ) : (
            <View style={[styles.heroImage, styles.placeholderImage]}>
              <Text style={styles.placeholderText}>
                {person.first_name?.[0]}
                {person.last_name?.[0]}
              </Text>
            </View>
          )}
          
          <View style={styles.heroOverlay}>
            <Text style={styles.heroName}>{name}</Text>
            <Text style={styles.heroSubtitle}>
              {currentJob ? `${currentJob.title} @ ${currentJob.company_name}` : person.seniority}
            </Text>
          </View>
        </View>

        {/* Details Section */}
        <View style={styles.detailsSection}>
          {/* Tagline / About */}
          {person.tagline && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TAGLINE</Text>
              <Text style={styles.taglineText}>{person.tagline}</Text>
            </View>
          )}

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>REGION</Text>
              <Text style={styles.statValue}>{person.location || "N/A"}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>SENIORITY</Text>
              <Text style={styles.statValue}>{person.seniority || "N/A"}</Text>
            </View>
          </View>

          {/* Highlights */}
          {person.highlights && person.highlights.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>HIGHLIGHTS</Text>
              <View style={styles.highlightsContainer}>
                {person.highlights.map((h, i) => (
                  <View 
                    key={i} 
                    style={[styles.highlightPill, { backgroundColor: getHighlightColor(h) + "15" }]}
                  >
                    <Text style={[styles.highlightText, { color: getHighlightColor(h) }]}>
                      {formatHighlight(h)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Socials */}
          <View style={styles.socialsRow}>
            {person.linkedin_url && (
              <Pressable 
                style={styles.socialBtn}
                onPress={() => Linking.openURL(person.linkedin_url!)}
              >
                <Ionicons name="logo-linkedin" size={24} color="#0A66C2" />
                <Text style={styles.socialBtnText}>LinkedIn</Text>
              </Pressable>
            )}
            {person.email && (
              <Pressable 
                style={styles.socialBtn}
                onPress={() => Linking.openURL(`mailto:${person.email}`)}
              >
                <Ionicons name="mail" size={24} color="#64748B" />
                <Text style={styles.socialBtnText}>Email</Text>
              </Pressable>
            )}
          </View>

          {/* Spacer for bottom actions visibility */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    width: SCREEN_WIDTH - 32,
    height: CARD_HEIGHT,
    backgroundColor: "#fff",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroSection: {
    height: 400,
    width: "100%",
    backgroundColor: "#E2E8F0",
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand.blue,
  },
  placeholderText: {
    fontSize: 72,
    fontWeight: "700",
    color: "#fff",
  },
  heroOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingTop: 60,
    backgroundColor: "rgba(0,0,0,0.3)", // Basic overlay, would be better with linear gradient
  },
  heroName: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "rgba(255,255,255,0.9)",
  },
  detailsSection: {
    padding: 24,
    gap: 24,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  taglineText: {
    fontSize: 15,
    color: "#334155",
    lineHeight: 22,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 24,
  },
  statBox: {
    flex: 1,
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  highlightsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  highlightPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  highlightText: {
    fontSize: 13,
    fontWeight: "600",
  },
  socialsRow: {
    flexDirection: "row",
    gap: 12,
  },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  socialBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  label: {
    position: "absolute",
    top: 40,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 4,
    zIndex: 1000,
  },
  likeLabel: {
    right: 40,
    borderColor: "#10B981",
    transform: [{ rotate: "15deg" }],
  },
  nopeLabel: {
    left: 40,
    borderColor: "#EF4444",
    transform: [{ rotate: "-15deg" }],
  },
  labelText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#10B981", // Will be overridden if needed
  },
});
