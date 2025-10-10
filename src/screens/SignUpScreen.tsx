import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { signUp } from "../api/clerk";
import useAuthStore from "../state/authStore";

type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

type SignUpScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "SignUp">;
};

export default function SignUpScreen({ navigation }: SignUpScreenProps) {
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { setUser, setToken, setIsAuthenticated } = useAuthStore();

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please enter both email and password");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters");
      return;
    }

    Keyboard.dismiss();
    setIsLoading(true);
    setErrorMessage("");

    try {
      const result = await signUp({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      if (result.success && result.token && result.user) {
        await setToken(result.token);
        setUser(result.user);
        setIsAuthenticated(true);
        // Navigation handled by App.tsx auth state
      } else {
        setErrorMessage(result.error || "Failed to create account. Please try again.");
      }
    } catch (error) {
      setErrorMessage("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-8">
          <Pressable
            onPress={() => navigation.goBack()}
            className="w-10 h-10 items-center justify-center rounded-full"
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1a365d" />
          </Pressable>

          <Text className="text-3xl font-bold mt-6 mb-2" style={styles.title}>
            Create account
          </Text>
          <Text className="text-base" style={styles.subtitle}>
            Join Specter to get started
          </Text>
        </View>

        {/* Form */}
        <View className="flex-1 px-6">
          {/* First Name Input */}
          <View className="mb-4">
            <Text className="text-sm font-medium mb-2" style={styles.label}>
              First Name (Optional)
            </Text>
            <TextInput
              value={firstName}
              onChangeText={(text) => {
                setFirstName(text);
                setErrorMessage("");
              }}
              placeholder="John"
              placeholderTextColor="#94a3b8"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              className="rounded-xl px-4 py-4 text-base"
              style={styles.input}
            />
          </View>

          {/* Last Name Input */}
          <View className="mb-4">
            <Text className="text-sm font-medium mb-2" style={styles.label}>
              Last Name (Optional)
            </Text>
            <TextInput
              value={lastName}
              onChangeText={(text) => {
                setLastName(text);
                setErrorMessage("");
              }}
              placeholder="Doe"
              placeholderTextColor="#94a3b8"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              className="rounded-xl px-4 py-4 text-base"
              style={styles.input}
            />
          </View>

          {/* Email Input */}
          <View className="mb-4">
            <Text className="text-sm font-medium mb-2" style={styles.label}>
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setErrorMessage("");
              }}
              placeholder="you@example.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              className="rounded-xl px-4 py-4 text-base"
              style={styles.input}
            />
          </View>

          {/* Password Input */}
          <View className="mb-4">
            <Text className="text-sm font-medium mb-2" style={styles.label}>
              Password
            </Text>
            <View className="relative">
              <TextInput
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrorMessage("");
                }}
                placeholder="At least 8 characters"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleSignUp}
                className="rounded-xl px-4 py-4 text-base pr-12"
                style={styles.input}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-4"
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={22}
                  color="#64748b"
                />
              </Pressable>
            </View>
          </View>

          {/* Error Message */}
          {errorMessage ? (
            <View className="mb-4 p-3 rounded-lg" style={styles.errorContainer}>
              <Text className="text-sm" style={styles.errorText}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {/* Sign Up Button */}
          <Pressable
            onPress={handleSignUp}
            disabled={isLoading}
            className="rounded-xl py-4 mb-4"
            style={({ pressed }) => [
              styles.signUpButton,
              (pressed || isLoading) && styles.buttonPressed,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center text-base font-semibold">
                Create Account
              </Text>
            )}
          </Pressable>

          {/* Sign In Link */}
          <View className="flex-row items-center justify-center mb-6">
            <Text className="text-base" style={styles.footerText}>
              Already have an account?{" "}
            </Text>
            <Pressable onPress={() => navigation.navigate("SignIn")}>
              <Text className="text-base font-semibold" style={styles.linkText}>
                Sign In
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    backgroundColor: "#f7fafc",
  },
  title: {
    color: "#1a365d",
  },
  subtitle: {
    color: "#64748b",
  },
  label: {
    color: "#334155",
  },
  input: {
    backgroundColor: "#f7fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    color: "#1e293b",
  },
  errorContainer: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorText: {
    color: "#dc2626",
  },
  signUpButton: {
    backgroundColor: "#1a365d",
  },
  buttonPressed: {
    opacity: 0.7,
  },
  footerText: {
    color: "#64748b",
  },
  linkText: {
    color: "#1a365d",
  },
});
