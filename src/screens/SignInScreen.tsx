import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSignIn, useOAuth } from "@clerk/clerk-expo";
import { useAuthStore } from "../stores/authStore";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useClerkToken } from "../hooks/useClerkToken";
import { setUserContext } from "../stores/userStore";
import { cacheToken } from "../utils/tokenCache";
import { Image } from "expo-image";
import { getJwtSub } from "../utils/jwt";

export default function SignInScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });
  const { setAuthEmail } = useAuthStore();
  const { getAuthToken } = useClerkToken();
  
  // Check if we're in web development mode
  const isWebDev = Platform.OS === 'web' && __DEV__;

  console.log('SignInScreen rendered, isLoaded:', isLoaded, 'isWebDev:', isWebDev);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // Form validation
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      return "Email is required";
    }
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address";
    }
    return "";
  };

  const validatePassword = (password: string) => {
    if (!password) {
      return "Password is required";
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters";
    }
    return "";
  };

  const handleForgotPassword = async () => {
    const emailValidation = validateEmail(resetEmail);
    if (emailValidation) {
      setEmailError(emailValidation);
      return;
    }

    setIsLoading(true);

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: resetEmail,
      });
      setResetSent(true);
      Alert.alert(
        "Password Reset Sent",
        `We've sent a password reset link to ${resetEmail}`,
        [{ text: "OK", onPress: () => setIsForgotPassword(false) }]
      );
    } catch (err: any) {
      console.error("Forgot password error:", err);
      Alert.alert("Error", err.errors?.[0]?.message || "Failed to send reset email");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    // Validate inputs
    const emailValidation = validateEmail(email);
    const passwordValidation = validatePassword(password);

    setEmailError(emailValidation);
    setPasswordError(passwordValidation);

    if (emailValidation || passwordValidation) {
      return;
    }

    setIsLoading(true);

    try {
      console.log("Attempting sign in with:", { email, isLoaded });
      
      // HYBRID AUTH: Web development bypass for Clerk origin restrictions
      if (isWebDev) {
        console.log("🔐 [Auth] Using proxy password sign-in for web dev");
        try {
          const response = await fetch("http://localhost:3333/api/auth/sign-in", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });

          if (response.ok) {
            const data = await response.json();
            console.log("✅ [Auth] Proxy sign-in successful!", data.userId);

            // Cache the JWT token for fast subsequent API calls
            if (data.jwt) {
              await cacheToken(data.jwt, data.userId || "unknown", email, data.sessionId);
              console.log("✅ [Auth] Token cached successfully");
            }

            // Mark signed-in state for navigation (used on web)
            await setAuthEmail(email);

            // Set user context with dynamic API key if returned from proxy
            await setUserContext({
              userId: data.userId || "unknown",
              userEmail: data.email || email,
              apiKey: data.apiKey
            });

            return; // Success!
          } else {
            const errData = await response.json().catch(() => ({}));
            const message = errData?.error || `Proxy sign-in failed (HTTP ${response.status})`;
            console.warn("⚠️ [Auth] Proxy sign-in failed:", message);

            // On web localhost, Clerk SDK sign-in is frequently blocked by origin restrictions.
            // If the proxy cannot authenticate either, show a clear, actionable error instead of silently falling through.
            if (response.status === 401 && String(message).toLowerCase().includes("signed out")) {
              Alert.alert(
                "Web Sign-In Blocked",
                "Clerk is rejecting localhost sign-in (expected with production keys). Please test sign-in on iOS/Android, or add your localhost origin to Clerk / use a development Clerk instance for web.",
              );
              return;
            }

            Alert.alert("Sign In Failed", message);
            return;
          }
        } catch (proxyErr) {
          console.error("❌ [Auth] Proxy connection failed:", proxyErr);
          Alert.alert(
            "Proxy Unavailable",
            "Could not reach the local auth proxy at http://localhost:3333. Start it with `node server.js` and retry."
          );
          return;
        }
      }

      // Fallback or Primary: Real Clerk Sign-In
      if (!isLoaded) {
        throw new Error("Clerk is still loading. Please try again in a moment.");
      }

      // Clerk Expo expects password sign-in via `signIn.create({ strategy: 'password', identifier, password })`
      const result: any = await signIn.create({
        strategy: "password",
        identifier: email,
        password,
      });

      console.log("Sign in result:", { status: result?.status });

      if (result?.status !== "complete") {
        const status = result?.status || "unknown";
        throw new Error(
          `Sign-in incomplete (status: ${status}). If you have MFA enabled, complete it in Clerk or disable it for now.`
        );
      }

      await setActive({ session: result.createdSessionId });
      console.log("Sign in successful!");

      await setAuthEmail(email);

      // Cache a 1h JWT for API calls; renewal happens by calling getToken() again when needed.
      const token = await getAuthToken();
      if (token) {
        const userId = getJwtSub(token) || "clerk_user";
        await cacheToken(token, userId, email);
        await setUserContext({ userId, userEmail: email });
      }
    } catch (err: any) {
      console.error("Sign in error:", err);
      const errorMessage = err?.errors?.[0]?.message || err?.message || "Failed to sign in";
      Alert.alert("Sign In Failed", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      console.log("Starting Google OAuth flow");

      const { createdSessionId, signIn, signUp, setActive } = await startOAuthFlow();

      if (createdSessionId) {
        console.log("OAuth successful, session created:", createdSessionId);
        await setActive({ session: createdSessionId });
      } else {
        console.log("OAuth incomplete:", { signIn, signUp });
      }
    } catch (err: any) {
      console.error("Google OAuth error:", err);
      Alert.alert("OAuth Error", err.errors?.[0]?.message || "Failed to sign in with Google");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    // Apple Sign-In implementation would go here
    // This is iOS only and requires additional setup
    Alert.alert("Coming Soon", "Apple Sign-In will be available soon!");
  };


  return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Specter Logo Header with Dark Navy Background */}
        <View style={styles.logoHeader}>
          <Image
            source={require('../../assets/App Icon - White on Blue.svg')}
            style={styles.headerLogo}
            contentFit="contain"
          />
          <Text style={styles.logoSubtitle}>Startup Data Platform</Text>
        </View>

        <View style={styles.content}>
          {/* Welcome Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </View>

          {/* OAuth Buttons */}
          <View style={styles.oauthContainer}>
            <Text style={styles.oauthLabel}>Continue with</Text>

            {/* Google OAuth Button */}
            <Pressable
              onPress={handleGoogleSignIn}
              style={({ pressed }) => [
                styles.oauthButton,
                styles.googleButton,
                pressed && styles.buttonPressed,
                isLoading && styles.buttonDisabled,
              ]}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.text.primary} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color={colors.text.primary} />
                  <Text style={[styles.oauthButtonText, styles.googleButtonText]}>
                    Continue with Google
                  </Text>
                </>
              )}
            </Pressable>

            {/* Apple Sign-In Button (iOS only) */}
            {Platform.OS === 'ios' && (
              <Pressable
                onPress={handleAppleSignIn}
                style={({ pressed }) => [
                  styles.oauthButton,
                  styles.appleButton,
                  pressed && styles.buttonPressed,
                  isLoading && styles.buttonDisabled,
                ]}
                disabled={isLoading}
              >
                <Ionicons name="logo-apple" size={20} color={colors.text.inverse} />
                <Text style={[styles.oauthButtonText, styles.appleButtonText]}>
                  Continue with Apple
                </Text>
              </Pressable>
            )}

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
          </View>

            {/* Email Input */}
          <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (emailError) setEmailError("");
                }}
              placeholder="Enter your email"
              placeholderTextColor={colors.text.tertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, emailError ? styles.inputError : null]}
              />
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
            </View>

            {/* Password Input */}
          <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.passwordContainer, passwordError ? styles.inputError : null]}>
                <TextInput
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (passwordError) setPasswordError("");
                  }}
                  placeholder="Enter your password"
                placeholderTextColor={colors.text.tertiary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.passwordInput}
                />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color={colors.text.tertiary}
                />
                </Pressable>
              </View>
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            </View>

            {/* Forgot Password Link */}
            <Pressable
              onPress={() => setIsForgotPassword(true)}
              style={styles.forgotPasswordButton}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </Pressable>

            {/* Sign In Button */}
            <Pressable
              onPress={handleSignIn}
              style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
              (isLoading) && styles.buttonDisabled,
              ]}
            disabled={isLoading}
            >
              {isLoading ? (
              <ActivityIndicator color={colors.text.inverse} />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </Pressable>

            {/* Sign Up Link */}
          <Pressable
            onPress={() => navigation.navigate("SignUp" as never)}
            style={styles.linkButton}
          >
            <Text style={styles.linkText}>
              Don't have an account? <Text style={styles.linkTextBold}>Sign up</Text>
            </Text>
          </Pressable>
        </View>

        {/* Forgot Password Modal */}
        {isForgotPassword && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Reset Password</Text>
                <Pressable
                  onPress={() => {
                    setIsForgotPassword(false);
                    setResetEmail("");
                    setEmailError("");
                    setResetSent(false);
                  }}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={colors.text.primary} />
                </Pressable>
              </View>

              <Text style={styles.modalSubtitle}>
                Enter your email address and we'll send you a link to reset your password.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  value={resetEmail}
                  onChangeText={(text) => {
                    setResetEmail(text);
                    if (emailError) setEmailError("");
                  }}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, emailError ? styles.inputError : null]}
                />
                {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
              </View>

              <Pressable
                onPress={handleForgotPassword}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                  isLoading && styles.buttonDisabled,
                ]}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.text.inverse} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {resetSent ? "Email Sent" : "Send Reset Link"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
          </View>
      </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  // Specter Logo Header
  logoHeader: {
    backgroundColor: colors.sidebar.bg, // Dark navy #0f172a
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: "center",
    paddingTop: 48,
  },
  headerLogo: {
    width: 80,
    height: 80,
    marginBottom: 8,
  },
  logoText: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text.inverse, // White
    letterSpacing: 2,
    marginBottom: 4,
  },
  logoSubtitle: {
    fontSize: 14,
    color: colors.sidebar.foreground, // Muted text #94a3b8
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text.primary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.content.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.card.bg,
  },
  inputError: {
    borderColor: colors.error, // Red border for errors
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
    fontWeight: "500",
  },
  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.brand.blue, // Blue color for link
    fontWeight: "500",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.content.border,
    borderRadius: 8,
    backgroundColor: colors.card.bg,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text.primary,
  },
  eyeButton: {
    padding: 12,
  },
  primaryButton: {
    backgroundColor: colors.brand.blue, // Specter blue from theme (#3b82f6)
    borderRadius: 8, // Standard border radius
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    minHeight: 48, // Standard button height
    shadowColor: colors.brand.blue,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4, // Android shadow
  },
  primaryButtonText: {
    color: colors.text.inverse, // White text from theme
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  linkButton: {
    alignItems: "center",
    marginTop: 16,
  },
  linkText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  linkTextBold: {
    color: colors.brand.blue,
    fontWeight: "600",
  },
  // OAuth styles
  oauthContainer: {
    marginBottom: 24,
  },
  oauthLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: 16,
    fontWeight: "500",
  },
  oauthButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    gap: 12,
    minHeight: 48,
  },
  googleButton: {
    backgroundColor: colors.card.bg,
    borderColor: colors.content.border,
  },
  googleButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  appleButton: {
    backgroundColor: colors.text.primary,
    borderColor: colors.text.primary,
  },
  appleButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: "600",
  },
  oauthButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.content.border,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: colors.text.tertiary,
    fontWeight: "500",
  },
  // Modal styles
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: colors.card.bg,
    borderRadius: 12,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 24,
    lineHeight: 20,
  },
});
