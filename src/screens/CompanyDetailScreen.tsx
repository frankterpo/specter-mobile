import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { Company } from "../api/specter";
import { CompaniesStackParamList } from "../types/navigation";

type RouteProps = RouteProp<CompaniesStackParamList, "CompanyDetail">;

export default function CompanyDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();

  const { companyId } = route.params;
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompany();
  }, [companyId]);

  const loadCompany = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Company detail API not yet available in public API
      // Show placeholder for now
      setError("Company details coming soon");
      
    } catch (err: any) {
      setError(err.message || "Failed to load company");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.brand.green} />
      </View>
    );
  }

  if (error || !company) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Company Details</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.container, styles.centered]}>
          <Ionicons name="business-outline" size={64} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>Company Details Coming Soon</Text>
          <Text style={styles.emptySubtext}>
            This feature will be available in the next update
          </Text>
          <Pressable style={styles.backButtonLarge} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const initials = (company.name || "")
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
          {company.name}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Company Header */}
        <View style={styles.companyHeader}>
          {company.logo_url ? (
            <Image
              source={{ uri: company.logo_url }}
              style={styles.logo}
              contentFit="contain"
            />
          ) : (
            <View style={[styles.logo, styles.logoPlaceholder]}>
              <Text style={styles.logoText}>{initials}</Text>
            </View>
          )}

          <Text style={styles.companyName}>{company.name}</Text>

          {company.tagline && (
            <Text style={styles.tagline}>{company.tagline}</Text>
          )}

          {company.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={colors.text.tertiary} />
              <Text style={styles.locationText}>{company.location}</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {company.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.descriptionText}>{company.description}</Text>
          </View>
        )}

        {/* Website */}
        {company.website && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Website</Text>
            <Pressable
              style={styles.websiteButton}
              onPress={() => Linking.openURL(company.website!)}
            >
              <Ionicons name="globe-outline" size={18} color={colors.brand.green} />
              <Text style={styles.websiteText}>{company.website}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
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
  companyHeader: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginBottom: 16,
  },
  logoPlaceholder: {
    backgroundColor: colors.brand.green,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 28,
    fontWeight: "600",
    color: colors.text.inverse,
  },
  companyName: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text.primary,
    textAlign: "center",
  },
  tagline: {
    fontSize: 14,
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
  descriptionText: {
    fontSize: 15,
    color: colors.text.primary,
    lineHeight: 22,
  },
  websiteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.content.bgSecondary,
  },
  websiteText: {
    fontSize: 14,
    color: colors.brand.green,
    flex: 1,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text.secondary,
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  backButtonLarge: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: colors.brand.green,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.inverse,
  },
});
