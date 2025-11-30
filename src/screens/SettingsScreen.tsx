import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Image } from "expo-image";
import { colors } from "../theme/colors";

interface SettingItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  danger?: boolean;
}

function SettingItem({
  icon,
  label,
  description,
  onPress,
  rightElement,
  danger = false,
}: SettingItemProps) {
  return (
    <Pressable style={styles.settingItem} onPress={onPress}>
      <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>
        <Ionicons
          name={icon}
          size={20}
          color={danger ? colors.error : colors.brand.green}
        />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>
          {label}
        </Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      {rightElement || (
        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      )}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { user } = useUser();

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => signOut(),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile section */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            {user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {(user?.firstName?.[0] || "") + (user?.lastName?.[0] || "U")}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {user?.fullName || user?.primaryEmailAddress?.emailAddress || "User"}
            </Text>
            <Text style={styles.profileEmail}>
              {user?.primaryEmailAddress?.emailAddress || ""}
            </Text>
          </View>
          <Pressable style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>

        {/* Account section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingGroup}>
            <SettingItem
              icon="person-outline"
              label="Profile"
              description="Edit your profile information"
            />
            <View style={styles.divider} />
            <SettingItem
              icon="notifications-outline"
              label="Notifications"
              description="Manage alert preferences"
            />
            <View style={styles.divider} />
            <SettingItem
              icon="lock-closed-outline"
              label="Privacy & Security"
              description="Password and security settings"
            />
          </View>
        </View>

        {/* Integrations section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Integrations</Text>
          <View style={styles.settingGroup}>
            <SettingItem
              icon="git-branch-outline"
              label="Connected Apps"
              description="CRM and other integrations"
            />
            <View style={styles.divider} />
            <SettingItem
              icon="cloud-outline"
              label="Data Export"
              description="Export your data"
            />
          </View>
        </View>

        {/* Support section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.settingGroup}>
            <SettingItem
              icon="help-circle-outline"
              label="Help Center"
              description="FAQs and documentation"
            />
            <View style={styles.divider} />
            <SettingItem
              icon="chatbubble-outline"
              label="Contact Support"
              description="Get help from our team"
            />
            <View style={styles.divider} />
            <SettingItem
              icon="information-circle-outline"
              label="About"
              description="App version and info"
            />
          </View>
        </View>

        {/* Sign out */}
        <View style={styles.section}>
          <View style={styles.settingGroup}>
            <SettingItem
              icon="log-out-outline"
              label="Sign Out"
              onPress={handleSignOut}
              danger
            />
          </View>
        </View>

        {/* App info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>Specter Mobile</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 20,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card.bg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  profileAvatar: {
    marginRight: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand.green,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.text.inverse,
    fontSize: 20,
    fontWeight: "600",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.brand.green + "15",
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brand.green,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.tertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  settingGroup: {
    backgroundColor: colors.card.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.card.border,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.brand.green + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  settingIconDanger: {
    backgroundColor: colors.error + "15",
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text.primary,
  },
  settingLabelDanger: {
    color: colors.error,
  },
  settingDescription: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.content.border,
    marginLeft: 62,
  },
  appInfo: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 4,
  },
  appName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  appVersion: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
});
