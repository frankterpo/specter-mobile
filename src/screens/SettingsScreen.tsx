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
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Image } from "expo-image";
import * as SecureStore from "expo-secure-store";
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
  const { signOut, isSignedIn } = useAuth();
  const { user } = useUser();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const clearAllAuthData = async () => {
    try {
      // Get all keys from SecureStore and clear Clerk-related ones
      // Clerk uses various keys, let's clear common ones
      const clerkKeys = [
        "__clerk_client_jwt",
        "__clerk_db_jwt",
        "__clerk_refresh_token",
        "__clerk_session",
        "__clerk_client_uat",
      ];
      
      for (const key of clerkKeys) {
        try {
          await SecureStore.deleteItemAsync(key);
          console.log(`✅ [Settings] Cleared ${key}`);
        } catch (error) {
          // Key might not exist, that's okay
        }
      }
      
      // Also try to clear all keys that start with __clerk
      // Note: SecureStore doesn't have a listKeys method, so we clear known ones
      console.log("✅ [Settings] All Clerk keys cleared from SecureStore");
    } catch (error) {
      console.error("❌ [Settings] Error clearing SecureStore:", error);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              setIsSigningOut(true);
              console.log("🚪 [Settings] Starting sign out...");
              
              // First, try to sign out from Clerk properly
              try {
                console.log("🔄 [Settings] Calling Clerk signOut()...");
                await signOut();
                console.log("✅ [Settings] Clerk signOut() completed");
                
                // Wait a moment for state to update
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Check if still signed in
                if (isSignedIn) {
                  console.warn("⚠️ [Settings] Still signed in after signOut(), forcing clear...");
                  await clearAllAuthData();
                }
              } catch (signOutError: any) {
                console.error("❌ [Settings] Clerk signOut() failed:", signOutError);
                console.error("❌ [Settings] Error details:", {
                  message: signOutError?.message,
                  name: signOutError?.name,
                  stack: signOutError?.stack,
                });
                // Continue with force clear even if signOut fails
                await clearAllAuthData();
              }
              
              // Force clear all auth data from SecureStore (always do this)
              await clearAllAuthData();
              
              console.log("✅ [Settings] Sign out process completed");
              
              // Show success message
              Alert.alert(
                "Signed Out", 
                "You have been signed out successfully. The app will refresh.",
                [
                  { 
                    text: "OK",
                    onPress: () => {
                      // The app should automatically navigate to auth screen
                      // due to isSignedIn state change in App.tsx
                    }
                  },
                ]
              );
            } catch (error: any) {
              console.error("❌ [Settings] Sign out error:", error);
              Alert.alert(
                "Sign Out Error",
                error?.message || "Failed to sign out completely. The app will restart.",
                [
                  {
                    text: "Force Clear",
                    style: "destructive",
                    onPress: async () => {
                      await clearAllAuthData();
                      // Force app restart by clearing everything
                      Alert.alert(
                        "Please Restart",
                        "All auth data cleared. Please close and reopen the app.",
                        [{ text: "OK" }]
                      );
                    },
                  },
                  { text: "Cancel" },
                ]
              );
            } finally {
              setIsSigningOut(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Settings</Text>
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
              rightElement={
                isSigningOut ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : undefined
              }
            />
            <View style={styles.divider} />
            <SettingItem
              icon="trash-outline"
              label="Force Logout (Clear All Data)"
              description="Use if normal logout doesn't work"
              onPress={async () => {
                Alert.alert(
                  "Force Logout",
                  "This will clear all authentication data. You'll need to sign in again. Continue?",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Force Clear",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          setIsSigningOut(true);
                          await clearAllAuthData();
                          // Try signOut as well
                          try {
                            await signOut();
                          } catch (e) {
                            console.log("signOut failed, but continuing with force clear");
                          }
                          Alert.alert(
                            "Data Cleared",
                            "All auth data cleared. Please close and reopen the app, then sign in again.",
                            [{ text: "OK" }]
                          );
                        } catch (error) {
                          Alert.alert("Error", "Failed to clear data. Please restart the app manually.");
                        } finally {
                          setIsSigningOut(false);
                        }
                      },
                    },
                  ]
                );
              }}
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.content.bg,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
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
