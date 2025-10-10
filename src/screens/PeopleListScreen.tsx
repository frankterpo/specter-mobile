import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import useAuthStore from "../state/authStore";

type MainStackParamList = {
  PeopleList: undefined;
  Settings: undefined;
};

type PeopleListScreenProps = {
  navigation: NativeStackNavigationProp<MainStackParamList, "PeopleList">;
};

// Mock data for people
const mockPeople = [
  {
    id: "1",
    name: "Sarah Chen",
    role: "Managing Partner",
    firm: "Sequoia Capital",
    status: "active",
  },
  {
    id: "2",
    name: "Michael Rodriguez",
    role: "General Partner",
    firm: "Andreessen Horowitz",
    status: "active",
  },
  {
    id: "3",
    name: "Emily Watson",
    role: "Venture Partner",
    firm: "Kleiner Perkins",
    status: "pending",
  },
  {
    id: "4",
    name: "David Kim",
    role: "Principal",
    firm: "Accel Partners",
    status: "active",
  },
  {
    id: "5",
    name: "Jennifer Liu",
    role: "Associate",
    firm: "Benchmark Capital",
    status: "active",
  },
];

export default function PeopleListScreen({ navigation }: PeopleListScreenProps) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const getStatusColor = (status: string) => {
    return status === "active" ? "#10b981" : "#f59e0b";
  };

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-6 pt-4 pb-4" style={styles.header}>
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-2xl font-bold" style={styles.title}>
              People
            </Text>
            <Text className="text-sm mt-1" style={styles.subtitle}>
              {user?.email || "Welcome"}
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate("Settings")}
            className="w-10 h-10 items-center justify-center rounded-full"
            style={styles.settingsButton}
          >
            <Ionicons name="settings-outline" size={22} color="#1a365d" />
          </Pressable>
        </View>
      </View>

      {/* People List */}
      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        {mockPeople.map((person, index) => (
          <Pressable
            key={person.id}
            className="rounded-xl p-4 mb-3"
            style={({ pressed }) => [
              styles.personCard,
              pressed && styles.cardPressed,
              index === 0 && { marginTop: 8 },
            ]}
          >
            <View className="flex-row items-center">
              {/* Avatar */}
              <View
                className="w-12 h-12 rounded-full items-center justify-center mr-3"
                style={styles.avatar}
              >
                <Text className="text-base font-semibold" style={styles.avatarText}>
                  {getInitials(person.name)}
                </Text>
              </View>

              {/* Person Info */}
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-base font-semibold mr-2" style={styles.personName}>
                    {person.name}
                  </Text>
                  <View
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getStatusColor(person.status) }}
                  />
                </View>
                <Text className="text-sm mt-0.5" style={styles.personRole}>
                  {person.role}
                </Text>
                <Text className="text-sm mt-0.5" style={styles.personFirm}>
                  {person.firm}
                </Text>
              </View>

              {/* Arrow */}
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </View>
          </Pressable>
        ))}

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
  title: {
    color: "#1a365d",
  },
  subtitle: {
    color: "#64748b",
  },
  settingsButton: {
    backgroundColor: "#f7fafc",
  },
  personCard: {
    backgroundColor: "#f7fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardPressed: {
    opacity: 0.7,
  },
  avatar: {
    backgroundColor: "#1a365d",
  },
  avatarText: {
    color: "white",
  },
  personName: {
    color: "#1e293b",
  },
  personRole: {
    color: "#64748b",
  },
  personFirm: {
    color: "#94a3b8",
  },
});
