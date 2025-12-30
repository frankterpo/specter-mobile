import React from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

const API_KEYS_URL = "https://app.tryspecter.com/settings";

interface MySpecterApiKeyScreenProps {
  email?: string | null;
  isChecking?: boolean;
  onRetry?: () => void;
  onSaveKey?: (apiKey: string) => void;
  errorMessage?: string | null;
}

export default function MySpecterApiKeyScreen({
  email,
  isChecking,
  onRetry,
  onSaveKey,
  errorMessage,
}: MySpecterApiKeyScreenProps) {
  const [apiKeyInput, setApiKeyInput] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);

  const handleSave = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setLocalError("Paste your API key to continue.");
      return;
    }
    setLocalError(null);
    onSaveKey?.(trimmed);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="key-outline" size={28} color={colors.primary} />
        </View>
        <Text style={styles.title}>API key required</Text>
        <Text style={styles.subtitle}>
          My Specter needs an API key to load saved searches, lists, and notifications.
        </Text>
        {email ? (
          <Text style={styles.emailText}>Signed in as {email}</Text>
        ) : (
          <Text style={styles.emailText}>Sign in to link your API key.</Text>
        )}
        {(errorMessage || localError) && (
          <Text style={styles.errorText}>{localError || errorMessage}</Text>
        )}
        <Pressable
          style={styles.primaryButton}
          onPress={() => Linking.openURL(API_KEYS_URL)}
        >
          <Ionicons name="open-outline" size={18} color={colors.white} />
          <Text style={styles.primaryLabel}>Open Specter to generate key</Text>
        </Pressable>
        <View style={styles.inputRow}>
          <Ionicons name="keypad-outline" size={16} color={colors.text.tertiary} />
          <TextInput
            style={styles.input}
            placeholder="Paste API key"
            placeholderTextColor={colors.text.tertiary}
            value={apiKeyInput}
            onChangeText={setApiKeyInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Pressable
          style={[styles.secondaryButton, !apiKeyInput.trim() && styles.secondaryButtonDisabled]}
          onPress={handleSave}
          disabled={!apiKeyInput.trim()}
        >
          <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.secondaryLabel}>Use this key</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, isChecking && styles.secondaryButtonDisabled]}
          onPress={onRetry}
          disabled={isChecking}
        >
          <Ionicons name="refresh" size={16} color={colors.primary} />
          <Text style={styles.secondaryLabel}>{isChecking ? "Checking..." : "Check again"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.content.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.card.bg,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.content.borderLight,
    gap: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primary + "1A",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  emailText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  errorText: {
    fontSize: 12,
    color: colors.destructive,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  primaryLabel: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.content.borderLight,
    backgroundColor: colors.content.bgSecondary,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: colors.text.primary,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary + "40",
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryLabel: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 13,
  },
});
