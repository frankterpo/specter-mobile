import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useUser, useClerk } from "@clerk/clerk-expo";
import { MainStackParamList } from "../types/navigation";

type SettingsScreenProps = {
  navigation: NativeStackNavigationProp<MainStackParamList, "Settings">;
};

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await signOut();
            } catch (error) {
              console.error("Logout error:", error);
              Alert.alert("Error", "Failed to sign out. Please try again.");
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const MenuItem = ({ 
    icon, 
    label, 
    onPress, 
    iconColor = "#1a365d",
    showChevron = true,
    badge,
  }: { 
    icon: keyof typeof Ionicons.glyphMap; 
    label: string; 
    onPress?: () => void;
    iconColor?: string;
    showChevron?: boolean;
    badge?: string;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={styles.menuItemText}>{label}</Text>
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      {showChevron && (
        <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
      )}
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.firstName?.[0]?.toUpperCase() || user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || "U"}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>
              {user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.firstName || "User"}
            </Text>
            <Text style={styles.userEmail}>
              {user?.emailAddresses?.[0]?.emailAddress || "user@example.com"}
            </Text>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ACCOUNT</Text>
          <View style={styles.menuGroup}>
            <MenuItem icon="person-outline" label="Edit Profile" />
            <View style={styles.menuDivider} />
            <MenuItem icon="lock-closed-outline" label="Change Password" />
            <View style={styles.menuDivider} />
            <MenuItem icon="notifications-outline" label="Notifications" />
          </View>
        </View>

        {/* AI & Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>AI & DATA</Text>
          <View style={styles.menuGroup}>
            <MenuItem 
              icon="flask-outline" 
              label="AI Diagnostics" 
              iconColor="#8B5CF6"
              onPress={() => navigation.navigate("Diagnostics")}
              badge="Dev"
            />
            <View style={styles.menuDivider} />
            <MenuItem 
              icon="cloud-download-outline" 
              label="Export Data" 
              iconColor="#3B82F6"
            />
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ABOUT</Text>
          <View style={styles.menuGroup}>
            <MenuItem icon="help-circle-outline" label="Help & Support" />
            <View style={styles.menuDivider} />
            <MenuItem icon="information-circle-outline" label="About Specter" />
            <View style={styles.menuDivider} />
            <MenuItem icon="document-text-outline" label="Privacy Policy" />
          </View>
        </View>

        {/* Sign Out */}
        <Pressable
          onPress={handleLogout}
          disabled={isLoggingOut}
          style={({ pressed }) => [
            styles.signOutButton,
            (pressed || isLoggingOut) && styles.signOutButtonPressed,
          ]}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.signOutText}>
            {isLoggingOut ? "Signing Out..." : "Sign Out"}
          </Text>
        </Pressable>

        {/* Version */}
        <Text style={styles.versionText}>Specter Mobile v1.0.0</Text>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 20,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1E3A5F",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFF",
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: "#64748B",
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },
  menuGroup: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  menuItemPressed: {
    backgroundColor: "#F8FAFC",
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginLeft: 52,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#1E293B",
  },
  badge: {
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFF",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    gap: 8,
  },
  signOutButtonPressed: {
    opacity: 0.7,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#EF4444",
  },
  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 8,
  },
});
