import React from "react";
import { View, Text, Pressable, StyleSheet, Linking, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CONTACT_URL = "https://www.tryspecter.com/contact";

export default function SignUpScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const openContact = async () => {
    await Linking.openURL(CONTACT_URL);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Create an account</Text>
        <Text style={styles.subtitle}>
          New sign-ups are handled via our contact form.
        </Text>
      </View>

      <Pressable onPress={openContact} style={styles.primaryBtn}>
        <Ionicons name="open-outline" size={18} color="#fff" />
        <Text style={styles.primaryBtnText}>Go to contact form</Text>
      </Pressable>

      <Text style={styles.hint}>
        If you already have an account, sign in from the previous screen.
      </Text>

      <Pressable onPress={() => navigation.goBack()} style={styles.secondaryBtn}>
        <Text style={styles.secondaryBtnText}>Back to sign in</Text>
      </Pressable>

      {Platform.OS === "web" && (
        <Text style={styles.smallPrint}>{CONTACT_URL}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  hint: {
    marginTop: 16,
    color: colors.text.tertiary,
    fontSize: 12,
    lineHeight: 18,
  },
  secondaryBtn: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card.bg,
  },
  secondaryBtnText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  smallPrint: {
    marginTop: 12,
    color: colors.text.tertiary,
    fontSize: 11,
    textAlign: "center",
  },
});

