import React from "react";
import { Platform, View, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ClerkProvider } from "@clerk/clerk-expo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MainNavigator from "./src/navigation/MainNavigator";
import { clerkTokenCache } from "./src/utils/clerkTokenCache";

/*
IMPORTANT NOTICE: DO NOT REMOVE
There are already environment keys in the project.
Before telling the user to add them, check if you already have access to the required keys through bash.
Directly access them with process.env.${key}

Correct usage:
process.env.EXPO_PUBLIC_VIBECODE_{key}
//directly access the key

Incorrect usage:
import { OPENAI_API_KEY } from '@env';
//don't use @env, its depreicated

Incorrect usage:
import Constants from 'expo-constants';
const openai_api_key = Constants.expoConfig.extra.apikey;
//don't use expo-constants, its depreicated

*/

// Get Clerk publishable key from app.json
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_live_Y2xlcmsudHJ5c3BlY3Rlci5jb20k";

// Create a client
const queryClient = new QueryClient();

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: '#f00', fontSize: 20, fontWeight: 'bold' }}>Critical Error</Text>
          <Text style={{ color: '#333', marginTop: 10, textAlign: 'center' }}>{this.state.error?.message}</Text>
          <Text style={{ color: '#666', marginTop: 10, fontSize: 10 }}>{this.state.error?.stack}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const SpecterTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#ffffff",
    card: "#ffffff",
    text: "#0f172a",
    border: "#e2e8f0",
    primary: "#3b82f6",
  },
};

export default function App() {
  const isWebDev = Platform.OS === 'web' && __DEV__;
  console.log('🚀 [App] Rendering root, isWebDev:', isWebDev);
  console.log(`🔑 Clerk Key: ${clerkPublishableKey.substring(0, 20)}...`);

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={clerkTokenCache}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#ffffff", ...(Platform.OS === 'web' ? { height: '100vh', width: '100vw' } : {}) }}>
            <SafeAreaProvider>
              <NavigationContainer theme={SpecterTheme}>
                <MainNavigator />
                <StatusBar style="dark" />
              </NavigationContainer>
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </ClerkProvider>
  );
}
