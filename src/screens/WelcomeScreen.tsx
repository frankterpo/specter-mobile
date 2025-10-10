import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Welcome">;
};

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* Logo Section */}
      <View className="flex-1 items-center justify-center px-6">
        <View className="items-center mb-8">
          {/* Logo Icon */}
          <View className="w-20 h-20 rounded-2xl items-center justify-center mb-4" style={styles.logoContainer}>
            <Ionicons name="analytics" size={40} color="#1a365d" />
          </View>
          
          {/* App Name */}
          <Text className="text-4xl font-bold mb-3" style={styles.title}>
            Specter Mobile
          </Text>
          
          {/* Tagline */}
          <Text className="text-base text-center" style={styles.tagline}>
            Operating System for Venture Capital
          </Text>
        </View>
      </View>

      {/* Buttons Section */}
      <View className="px-6" style={{ paddingBottom: insets.bottom + 40 }}>
        {/* Sign In Button */}
        <Pressable
          onPress={() => navigation.navigate("SignIn")}
          className="rounded-xl py-4 mb-3"
          style={({ pressed }) => [
            styles.signInButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text className="text-white text-center text-base font-semibold">
            Sign In
          </Text>
        </Pressable>

        {/* Sign Up Button */}
        <Pressable
          onPress={() => navigation.navigate("SignUp")}
          className="rounded-xl py-4 border-2"
          style={({ pressed }) => [
            styles.signUpButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text className="text-center text-base font-semibold" style={styles.signUpButtonText}>
            Sign Up
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    backgroundColor: "#f7fafc",
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  title: {
    color: "#1a365d",
  },
  tagline: {
    color: "#64748b",
  },
  signInButton: {
    backgroundColor: "#1a365d",
  },
  signUpButton: {
    backgroundColor: "white",
    borderColor: "#1a365d",
  },
  signUpButtonText: {
    color: "#1a365d",
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
