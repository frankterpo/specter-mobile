import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { setUserContext, UserContext } from "../stores/userStore";

interface UserSetupScreenProps {
  onComplete: () => void;
}

export default function UserSetupScreen({ onComplete }: UserSetupScreenProps) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleContinue = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      Alert.alert("Email Required", "Please enter your email address.");
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    setIsLoading(true);

    try {
      // Use email as userId (backend expects userId, we'll use email as identifier)
      // In production, you might want to hash this or use a different identifier
      const userContext: UserContext = {
        userId: trimmedEmail, // Using email as userId for simplicity
        userEmail: trimmedEmail,
        displayName: trimmedEmail.split("@")[0], // Extract name part from email
      };

      await setUserContext(userContext);
      onComplete();
    } catch (error) {
      console.error("Failed to save user context:", error);
      Alert.alert(
        "Error",
        "Failed to save your information. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        {/* Logo/Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="person-circle" size={64} color={colors.brand.green} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Welcome to Specter</Text>
        <Text style={styles.subtitle}>
          Enter your email to get started with personalized features
        </Text>

        {/* Email Input */}
        <View style={styles.inputContainer}>
          <Ionicons
            name="mail-outline"
            size={20}
            color={colors.text.tertiary}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="your.email@example.com"
            placeholderTextColor={colors.text.tertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="done"
            onSubmitEditing={handleContinue}
            editable={!isLoading}
          />
        </View>

        {/* Continue Button */}
        <Pressable
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          ) : (
            <>
              <Text style={styles.buttonText}>Continue</Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={colors.text.inverse}
              />
            </>
          )}
        </Pressable>

        {/* Info Text */}
        <Text style={styles.infoText}>
          Your email is used to personalize your experience. All actions (likes,
          lists, etc.) will be associated with your account.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.content.bgSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.content.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
    padding: 0,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand.green,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.inverse,
  },
  infoText: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: "center",
    lineHeight: 16,
  },
});

