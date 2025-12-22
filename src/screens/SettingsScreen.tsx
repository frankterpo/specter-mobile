import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { colors } from "../theme/colors";
import { getUserContext, clearUserContext, UserContext } from "../stores/userStore";
import { useClerk } from "@clerk/clerk-expo";

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
  const { signOut } = useClerk();
  const [userContext, setUserContext] = React.useState<UserContext | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    loadUserContext();
  }, []);

  const loadUserContext = async () => {
        try {
      const context = await getUserContext();
      setUserContext(context);
    } catch (error) {
      console.error("Failed to load user context:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearUserData = async () => {
    Alert.alert(
      "Clear User Data",
      "This will clear your user settings. You'll need to re-enter your email to continue using the app.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await clearUserContext();
              // Force app reload by navigating away
              Alert.alert(
                "Data Cleared",
                "Please restart the app to continue.",
                [{ text: "OK" }]
              );
            } catch (error) {
              console.error("Failed to clear user data:", error);
              Alert.alert("Error", "Failed to clear user data");
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out? You'll need to sign in again to use the app.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              console.log("Signing out...");
              await signOut();
              await clearUserContext();
              console.log("Signed out successfully");
              Alert.alert(
                "Signed Out",
                "You have been signed out successfully. Restart the app to see sign-in screen.",
                [{ text: "OK" }]
              );
            } catch (error) {
              console.error("Failed to sign out:", error);
              Alert.alert("Error", "Failed to sign out");
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.brand.green} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
      {/* Header */}
        <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

        {/* User Section */}
        <View style={styles.section}>
          <View style={styles.userSection}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {userContext?.userEmail?.[0]?.toUpperCase() || "?"}
                </Text>
              </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {userContext?.displayName || userContext?.userEmail || "Unknown User"}
          </Text>
              <Text style={styles.userEmail}>{userContext?.userEmail || ""}</Text>
              <Text style={styles.userStatus}>
                Using Railway + Clerk Auth
                </Text>
              </View>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          
            <SettingItem
              icon="person-outline"
            label="User ID"
            description={userContext?.userId || "Not set"}
            />
          
            <SettingItem
            icon="key-outline"
            label="API Status"
            description="Connected via Railway + Clerk JWT"
            />
              </View>

        {/* App Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>APP</Text>

          <SettingItem
            icon="notifications-outline"
            label="Notifications"
            description="Coming soon"
          />

            <SettingItem
            icon="color-palette-outline"
            label="Appearance"
            description="Light mode"
            />

            <SettingItem
            icon="help-circle-outline"
            label="Help & Support"
            description="Get help with the app"
            />
            </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>

            <SettingItem
            icon="information-circle-outline"
            label="Version"
            description="1.0.0 (Railway + Clerk Auth)"
            rightElement={null}
            />

            <SettingItem
            icon="document-text-outline"
            label="Terms of Service"
            />

            <SettingItem
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            />
              </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.error }]}>DANGER ZONE</Text>

            <SettingItem
              icon="log-out-outline"
              label="Sign Out"
            description="Sign out from your account"
              danger
            onPress={handleLogout}
          />

            <SettingItem
              icon="trash-outline"
            label="Clear User Data"
            description="Remove all local user data"
              danger
            onPress={handleClearUserData}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text.primary,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.tertiary,
    marginHorizontal: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  userSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.content.bgSecondary,
    marginHorizontal: 12,
    borderRadius: 12,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand.green,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.text.inverse,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text.primary,
  },
  userEmail: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  userStatus: {
    fontSize: 12,
    color: colors.brand.green,
    marginTop: 4,
    fontWeight: "500",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.card.bg,
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
    marginLeft: 12,
  },
  settingLabel: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: "500",
  },
  settingLabelDanger: {
    color: colors.error,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
});
