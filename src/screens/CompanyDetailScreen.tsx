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
import { useAuth } from "@clerk/clerk-expo";
import { colors } from "../theme/colors";
import { Company, fetchCompanyDetail, likeCompany, dislikeCompany } from "../api/specter";
import { CompaniesStackParamList } from "../types/navigation";

type RouteProps = RouteProp<CompaniesStackParamList, "CompanyDetail">;

export default function CompanyDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();

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
      const token = await getToken();
      if (!token) {
        setError("Not authenticated");
        return;
      }
      const data = await fetchCompanyDetail(token, companyId);
      if (data) {
        setCompany(data);
      } else {
        setError("Company not found");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load company");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      await likeCompany(token, companyId);
    } catch (error) {
      console.error("Failed to like company:", error);
    }
  };

  const handleDislike = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      await dislikeCompany(token, companyId);
    } catch (error) {
      console.error("Failed to dislike company:", error);
    }
  };

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  const name = company?.name || company?.organization_name || "Company";
  const description = company?.description || company?.tagline || "";
  const location = company?.hq
    ? [company.hq.city, company.hq.state, company.hq.country].filter(Boolean).join(", ")
    : "";
  const industries = company?.industries || [];
  const funding = company?.funding;

  const formatFunding = (amount?: number) => {
    if (!amount) return "N/A";
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
    return `$${amount}`;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.brand.green} />
      </View>
    );
  }

  if (error || !company) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error || "Company not found"}</Text>
        <Pressable style={styles.retryButton} onPress={loadCompany}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

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
        {/* Company info card */}
        <View style={styles.card}>
          {/* Logo + Name */}
          <View style={styles.companyHeader}>
            {company.logo_url ? (
              <Image
                source={{ uri: company.logo_url }}
                style={styles.logo}
                contentFit="contain"
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoText}>{name.charAt(0)}</Text>
              </View>
            )}
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{name}</Text>
              {location && (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color={colors.text.tertiary} />
                  <Text style={styles.locationText}>{location}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Tagline */}
          {description && (
            <Text style={styles.description}>{description}</Text>
          )}

          {/* Tags */}
          <View style={styles.tagsRow}>
            {industries.slice(0, 3).map((industry, idx) => (
              <View key={idx} style={[styles.tag, styles.tagBlue]}>
                <Text style={styles.tagTextBlue}>{industry}</Text>
              </View>
            ))}
            {company.growth_stage && (
              <View style={[styles.tag, styles.tagPurple]}>
                <Text style={styles.tagTextPurple}>{company.growth_stage}</Text>
              </View>
            )}
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Pressable style={[styles.actionBtn, styles.dislikeBtn]} onPress={handleDislike}>
              <Ionicons name="close" size={22} color={colors.error} />
              <Text style={[styles.actionBtnText, { color: colors.error }]}>Pass</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.likeBtn]} onPress={handleLike}>
              <Ionicons name="heart" size={22} color={colors.brand.green} />
              <Text style={[styles.actionBtnText, { color: colors.brand.green }]}>Like</Text>
            </Pressable>
          </View>
        </View>

        {/* Metrics card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <MaterialCommunityIcons name="cash-multiple" size={20} color={colors.brand.green} />
              <Text style={styles.metricValue}>{formatFunding(funding?.total_funding_usd)}</Text>
              <Text style={styles.metricLabel}>Total Raised</Text>
            </View>
            <View style={styles.metricItem}>
              <Ionicons name="people-outline" size={20} color={colors.brand.blue} />
              <Text style={styles.metricValue}>
                {company.employee_count_range || company.employee_count || "N/A"}
              </Text>
              <Text style={styles.metricLabel}>Employees</Text>
            </View>
            <View style={styles.metricItem}>
              <Ionicons name="calendar-outline" size={20} color={colors.text.tertiary} />
              <Text style={styles.metricValue}>{company.founded_year || "N/A"}</Text>
              <Text style={styles.metricLabel}>Founded</Text>
            </View>
            <View style={styles.metricItem}>
              <Ionicons name="trending-up" size={20} color={colors.brand.purple} />
              <Text style={styles.metricValue}>{funding?.round_count || "N/A"}</Text>
              <Text style={styles.metricLabel}>Rounds</Text>
            </View>
          </View>
        </View>

        {/* Funding card */}
        {funding && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Funding</Text>
            <View style={styles.fundingInfo}>
              <View style={styles.fundingRow}>
                <Text style={styles.fundingLabel}>Last Round</Text>
                <Text style={styles.fundingValue}>
                  {funding.last_funding_type || "N/A"} - {formatFunding(funding.last_funding_usd)}
                </Text>
              </View>
              <View style={styles.fundingRow}>
                <Text style={styles.fundingLabel}>Date</Text>
                <Text style={styles.fundingValue}>{funding.last_funding_date || "N/A"}</Text>
              </View>
              {funding.post_money_valuation_usd && (
                <View style={styles.fundingRow}>
                  <Text style={styles.fundingLabel}>Valuation</Text>
                  <Text style={styles.fundingValue}>
                    {formatFunding(funding.post_money_valuation_usd)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Investors */}
        {company.investors && company.investors.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Investors</Text>
            <View style={styles.investorsList}>
              {company.investors.slice(0, 6).map((investor, idx) => (
                <View key={idx} style={styles.investorChip}>
                  <Text style={styles.investorName}>{investor}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Links */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Links</Text>
          <View style={styles.linksRow}>
            {company.website?.url && (
              <Pressable
                style={styles.linkBtn}
                onPress={() => openUrl(company.website?.url || "")}
              >
                <Ionicons name="globe-outline" size={18} color={colors.brand.blue} />
                <Text style={styles.linkText}>Website</Text>
              </Pressable>
            )}
            {company.socials?.linkedin?.url && (
              <Pressable
                style={styles.linkBtn}
                onPress={() => openUrl(company.socials?.linkedin?.url || "")}
              >
                <Ionicons name="logo-linkedin" size={18} color="#0077B5" />
                <Text style={styles.linkText}>LinkedIn</Text>
              </Pressable>
            )}
            {company.socials?.twitter?.url && (
              <Pressable
                style={styles.linkBtn}
                onPress={() => openUrl(company.socials?.twitter?.url || "")}
              >
                <Ionicons name="logo-twitter" size={18} color="#1DA1F2" />
                <Text style={styles.linkText}>Twitter</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
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
  companyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.content.bgSecondary,
    marginRight: 14,
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.brand.blue,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  logoText: {
    color: colors.text.inverse,
    fontSize: 22,
    fontWeight: "600",
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text.primary,
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
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  tagBlue: {
    backgroundColor: colors.tag.blue.bg,
  },
  tagTextBlue: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.tag.blue.text,
  },
  tagPurple: {
    backgroundColor: colors.tag.purple.bg,
  },
  tagTextPurple: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.tag.purple.text,
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
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricItem: {
    width: "46%",
    backgroundColor: colors.content.bgSecondary,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  fundingInfo: {
    gap: 10,
  },
  fundingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  fundingLabel: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  fundingValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.primary,
  },
  investorsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  investorChip: {
    backgroundColor: colors.content.bgSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  investorName: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  linksRow: {
    flexDirection: "row",
    gap: 12,
  },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.content.bgSecondary,
    borderRadius: 8,
  },
  linkText: {
    fontSize: 13,
    color: colors.text.secondary,
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

