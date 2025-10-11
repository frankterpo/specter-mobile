import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useUser, useClerk } from "@clerk/clerk-expo";

type MainStackParamList = {
  PeopleList: undefined;
  PersonDetail: { personId: string };
  Settings: undefined;
};

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
              // Navigation handled by App.tsx auth state
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

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-6 pt-4 pb-4" style={styles.header}>
        <View className="flex-row items-center">
          <Pressable
            onPress={() => navigation.goBack()}
            className="w-10 h-10 items-center justify-center rounded-full mr-3"
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1a365d" />
          </Pressable>
          <Text className="text-2xl font-bold" style={styles.title}>
            Settings
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View className="px-6 pt-6 pb-4">
          <Text className="text-xs font-semibold mb-3" style={styles.sectionHeader}>
            PROFILE
          </Text>
          <View className="rounded-xl p-4" style={styles.profileCard}>
            <View className="flex-row items-center">
              <View
                className="w-14 h-14 rounded-full items-center justify-center mr-4"
                style={styles.avatar}
              >
                <Text className="text-xl font-semibold text-white">
                  {user?.firstName?.[0]?.toUpperCase() || user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || "U"}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold mb-1" style={styles.userName}>
                  {user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user?.firstName || "User"}
                </Text>
                <Text className="text-sm" style={styles.userEmail}>
                  {user?.emailAddresses?.[0]?.emailAddress || "user@example.com"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Account Section */}
        <View className="px-6 py-4">
          <Text className="text-xs font-semibold mb-3" style={styles.sectionHeader}>
            ACCOUNT
          </Text>

          <Pressable
            className="rounded-xl p-4 mb-2"
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          >
            <View className="flex-row items-center">
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={styles.iconContainer}
              >
                <Ionicons name="person-outline" size={20} color="#1a365d" />
              </View>
              <View className="flex-1">
                <Text className="text-base" style={styles.menuItemText}>
                  Edit Profile
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </View>
          </Pressable>

          <Pressable
            className="rounded-xl p-4 mb-2"
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          >
            <View className="flex-row items-center">
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={styles.iconContainer}
              >
                <Ionicons name="lock-closed-outline" size={20} color="#1a365d" />
              </View>
              <View className="flex-1">
                <Text className="text-base" style={styles.menuItemText}>
                  Change Password
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </View>
          </Pressable>

          <Pressable
            className="rounded-xl p-4"
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          >
            <View className="flex-row items-center">
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={styles.iconContainer}
              >
                <Ionicons name="notifications-outline" size={20} color="#1a365d" />
              </View>
              <View className="flex-1">
                <Text className="text-base" style={styles.menuItemText}>
                  Notifications
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </View>
          </Pressable>
        </View>

        {/* About Section */}
        <View className="px-6 py-4">
          <Text className="text-xs font-semibold mb-3" style={styles.sectionHeader}>
            ABOUT
          </Text>

          <Pressable
            className="rounded-xl p-4 mb-2"
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          >
            <View className="flex-row items-center">
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={styles.iconContainer}
              >
                <Ionicons name="help-circle-outline" size={20} color="#1a365d" />
              </View>
              <View className="flex-1">
                <Text className="text-base" style={styles.menuItemText}>
                  Help & Support
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </View>
          </Pressable>

          <Pressable
            className="rounded-xl p-4"
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          >
            <View className="flex-row items-center">
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={styles.iconContainer}
              >
                <Ionicons name="information-circle-outline" size={20} color="#1a365d" />
              </View>
              <View className="flex-1">
                <Text className="text-base" style={styles.menuItemText}>
                  About Specter
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </View>
          </Pressable>
        </View>

        {/* Logout Button */}
        <View className="px-6 pt-4 pb-8">
          <Pressable
            onPress={handleLogout}
            disabled={isLoggingOut}
            className="rounded-xl py-4"
            style={({ pressed }) => [
              styles.logoutButton,
              (pressed || isLoggingOut) && styles.logoutButtonPressed,
            ]}
          >
            <View className="flex-row items-center justify-center">
              <Ionicons name="log-out-outline" size={20} color="#dc2626" />
              <Text className="text-base font-semibold ml-2" style={styles.logoutButtonText}>
                {isLoggingOut ? "Signing Out..." : "Sign Out"}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Bottom Padding */}
        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  backButton: {
    backgroundColor: "#f7fafc",
  },
  title: {
    color: "#1a365d",
  },
  sectionHeader: {
    color: "#64748b",
    letterSpacing: 0.5,
  },
  profileCard: {
    backgroundColor: "#f7fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  avatar: {
    backgroundColor: "#1a365d",
  },
  userName: {
    color: "#1e293b",
  },
  userEmail: {
    color: "#64748b",
  },
  menuItem: {
    backgroundColor: "#f7fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  menuItemPressed: {
    opacity: 0.7,
  },
  iconContainer: {
    backgroundColor: "#e0e7ff",
  },
  menuItemText: {
    color: "#1e293b",
  },
  logoutButton: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  logoutButtonPressed: {
    opacity: 0.7,
  },
  logoutButtonText: {
    color: "#dc2626",
  },
});
