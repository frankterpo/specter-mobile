import React from "react";
import { StyleSheet, View, Text, ActivityIndicator, Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { useAuthStore } from "../stores/authStore";
import { colors } from "../theme/colors";
import { BottomNavigation } from "../components/ui/shadcn/BottomNavigation";
import {
  MainTabParamList,
  CompaniesStackParamList,
  CompaniesTopTabParamList,
  PeopleStackParamList,
  PeopleTopTabParamList,
  InvestorsStackParamList,
  InvestorsTopTabParamList,
  TransactionsStackParamList,
  TransactionsTopTabParamList,
  MySpecterStackParamList,
  MySpecterTopTabParamList,
  SettingsStackParamList,
  ApiTestingStackParamList,
  RootStackParamList,
} from "../types/navigation";

// Screens
import CompaniesFeedScreen from "../screens/CompaniesFeedScreen";
import CompanyDetailScreen from "../screens/CompanyDetailScreen";
import PeopleFeedScreen from "../screens/PeopleFeedScreen";
import PersonDetailScreen from "../screens/PersonDetailScreen";
import ListsScreen from "../screens/ListsScreen";
import ListDetailScreen from "../screens/ListDetailScreen";
import SettingsScreen from "../screens/SettingsScreen";
import ApiTestingScreen from "../screens/ApiTestingScreen";
import SignInScreen from "../screens/SignInScreen";
import SignUpScreen from "../screens/SignUpScreen";
import SavedSearchResultsScreen from "../screens/SavedSearchResultsScreen";

// New Screens
import RevenueSignalsScreen from "../screens/RevenueSignalsScreen";
import TalentSignalsScreen from "../screens/TalentSignalsScreen";
import StrategicSignalsScreen from "../screens/StrategicSignalsScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import InvestorDetailScreen from "../screens/InvestorDetailScreen";
import TransactionDetailScreen from "../screens/TransactionDetailScreen";
import LoadingSplashScreen from "../screens/LoadingSplashScreen";

const Tab = createBottomTabNavigator<MainTabParamList>();
const TopTab = createMaterialTopTabNavigator();
const RootStack = createNativeStackNavigator<RootStackParamList>();

const CompaniesStack = createNativeStackNavigator<CompaniesStackParamList>();
const PeopleStack = createNativeStackNavigator<PeopleStackParamList>();
const InvestorsStack = createNativeStackNavigator<InvestorsStackParamList>();
const TransactionsStack = createNativeStackNavigator<TransactionsStackParamList>();
const MySpecterStack = createNativeStackNavigator<MySpecterStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();
const ApiTestingStack = createNativeStackNavigator<ApiTestingStackParamList>();

const TOP_TAB_STYLE = {
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.text.tertiary,
  tabBarIndicatorStyle: { backgroundColor: colors.primary, height: 3 },
  tabBarLabelStyle: { fontSize: 13, fontWeight: '700' as const, textTransform: 'none' as const },
  tabBarStyle: { backgroundColor: colors.background, elevation: 0, shadowOpacity: 0 },
};

// --- Sub-Navigators ---

function CompaniesTopTabs() {
  return (
    <TopTab.Navigator screenOptions={TOP_TAB_STYLE}>
      <TopTab.Screen name="Database" component={CompaniesFeedScreen} />
      <TopTab.Screen name="Revenue" component={RevenueSignalsScreen} />
    </TopTab.Navigator>
  );
}

function PeopleTopTabs() {
  return (
    <TopTab.Navigator screenOptions={TOP_TAB_STYLE}>
      <TopTab.Screen name="Database" component={PeopleFeedScreen} />
      <TopTab.Screen name="Talent" component={TalentSignalsScreen} />
    </TopTab.Navigator>
  );
}

import FundingRoundsScreen from "../screens/FundingRoundsScreen";
import AcquisitionsScreen from "../screens/AcquisitionsScreen";
import IPOScreen from "../screens/IPOsScreen";
import InvestorsFeedScreen from "../screens/InvestorsFeedScreen";

function InvestorsTopTabs() {
  return (
    <TopTab.Navigator screenOptions={TOP_TAB_STYLE}>
      <TopTab.Screen name="Database" component={InvestorsFeedScreen} />
      <TopTab.Screen name="Strategic" component={StrategicSignalsScreen} />
    </TopTab.Navigator>
  );
}

function TransactionsTopTabs() {
  return (
    <TopTab.Navigator screenOptions={TOP_TAB_STYLE}>
      <TopTab.Screen name="Funding" component={FundingRoundsScreen} />
      <TopTab.Screen name="Acquisitions" component={AcquisitionsScreen} />
      <TopTab.Screen name="IPOs" component={IPOScreen} />
    </TopTab.Navigator>
  );
}

import SavedSearchesScreen from "../screens/SavedSearchesScreen";
import MySpecterApiKeyScreen from "../screens/MySpecterApiKeyScreen";
import { getUserContext, setUserContext } from "../stores/userStore";
import { getDevProxyUrl } from "../utils/devProxy";

function MySpecterTopTabs() {
  const authEmail = useAuthStore((state) => state.authEmail);
  const [apiKeyStatus, setApiKeyStatus] = React.useState<"checking" | "ready" | "missing">("checking");
  const [apiKeyError, setApiKeyError] = React.useState<string | null>(null);

  const ensureApiKey = React.useCallback(async () => {
    setApiKeyStatus("checking");
    setApiKeyError(null);
    const context = await getUserContext();
    if (context?.apiKey) {
      setApiKeyStatus("ready");
      return;
    }

    const email = authEmail || context?.userEmail;
    if (!email) {
      setApiKeyStatus("missing");
      return;
    }

    try {
      const response = await fetch(getDevProxyUrl("/api/auth/get-api-key"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.apiKey) {
          await setUserContext({
            userId: data.userId || context?.userId || "unknown",
            userEmail: email,
            displayName: context?.displayName,
            apiKey: data.apiKey,
          });
          setApiKeyStatus("ready");
          return;
        }
      }
      if (response.status === 404) {
        setApiKeyError("API key endpoint not found. Restart `node server.js`.");
      } else {
        setApiKeyError(`API key lookup failed (${response.status}).`);
      }
    } catch (error: any) {
      console.warn("Failed to fetch API key:", error);
      setApiKeyError(error?.message || "API key lookup failed.");
    }

    setApiKeyStatus("missing");
  }, [authEmail]);

  const handleSaveApiKey = React.useCallback(
    async (apiKey: string) => {
      const context = await getUserContext();
      const email = authEmail || context?.userEmail || "unknown";
      await setUserContext({
        userId: context?.userId || "unknown",
        userEmail: email,
        displayName: context?.displayName,
        apiKey,
      });
      setApiKeyStatus("ready");
      setApiKeyError(null);
    },
    [authEmail]
  );

  React.useEffect(() => {
    ensureApiKey();
  }, [ensureApiKey]);

  if (apiKeyStatus !== "ready") {
    return (
      <MySpecterApiKeyScreen
        email={authEmail}
        isChecking={apiKeyStatus === "checking"}
        onRetry={ensureApiKey}
        onSaveKey={handleSaveApiKey}
        errorMessage={apiKeyError}
      />
    );
  }

  return (
    <TopTab.Navigator screenOptions={TOP_TAB_STYLE}>
      <TopTab.Screen name="Searches" component={SavedSearchesScreen} />
      <TopTab.Screen name="Lists" component={ListsScreen} />
      <TopTab.Screen name="Notifications" component={NotificationsScreen} />
    </TopTab.Navigator>
  );
}

// --- Main Navigators ---

function CompaniesNavigator() {
  return (
    <CompaniesStack.Navigator screenOptions={{ headerShown: false }}>
      <CompaniesStack.Screen name="CompaniesMain" component={CompaniesTopTabs} />
      <CompaniesStack.Screen name="CompanyDetail" component={CompanyDetailScreen} />
      <CompaniesStack.Screen name="SavedSearchResults" component={SavedSearchResultsScreen} />
    </CompaniesStack.Navigator>
  );
}

function PeopleNavigator() {
  return (
    <PeopleStack.Navigator screenOptions={{ headerShown: false }}>
      <PeopleStack.Screen name="PeopleMain" component={PeopleTopTabs} />
      <PeopleStack.Screen name="PersonDetail" component={PersonDetailScreen} />
      <PeopleStack.Screen name="SavedSearchResults" component={SavedSearchResultsScreen} />
    </PeopleStack.Navigator>
  );
}

function InvestorsNavigator() {
  return (
    <InvestorsStack.Navigator screenOptions={{ headerShown: false }}>
      <InvestorsStack.Screen name="InvestorsMain" component={InvestorsTopTabs} />
      <InvestorsStack.Screen name="InvestorDetail" component={InvestorDetailScreen} />
    </InvestorsStack.Navigator>
  );
}

function TransactionsNavigator() {
  return (
    <TransactionsStack.Navigator screenOptions={{ headerShown: false }}>
      <TransactionsStack.Screen name="TransactionsMain" component={TransactionsTopTabs} />
      <TransactionsStack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
    </TransactionsStack.Navigator>
  );
}

function MySpecterNavigator() {
  return (
    <MySpecterStack.Navigator screenOptions={{ headerShown: false }}>
      <MySpecterStack.Screen name="MySpecterMain" component={MySpecterTopTabs} />
      <MySpecterStack.Screen name="ListDetail" component={ListDetailScreen} />
      <MySpecterStack.Screen name="SearchDetail" component={SavedSearchResultsScreen} />
    </MySpecterStack.Navigator>
  );
}

function SettingsNavigator() {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="SettingsMain" component={SettingsScreen} />
    </SettingsStack.Navigator>
  );
}

function ApiTestingNavigator() {
  return (
    <ApiTestingStack.Navigator screenOptions={{ headerShown: false }}>
      <ApiTestingStack.Screen name="ApiTestingMain" component={ApiTestingScreen} />
    </ApiTestingStack.Navigator>
  );
}

// Tab icon component
function TabIcon({
  name,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
}) {
  return (
    <Ionicons
      name={name}
      size={22}
      color={focused ? colors.primary : colors.text.tertiary}
    />
  );
}

// Custom tab bar component with animations and badges
function CustomTabBar({ state, descriptors, navigation, notificationCount = 0 }: any) {
  const insets = useSafeAreaInsets();

  const tabs = state.routes.map((route: any, index: number) => {
    const { options } = descriptors[route.key];
    const label = options.tabBarLabel !== undefined ? options.tabBarLabel : route.name;
    const icon = options.tabBarIcon;

    // Get badge count from route params (can be set by screens) or use notification count for Settings
    let badge = route.params?.badge || 0;
    if (route.name === "SettingsTab" && notificationCount > 0) {
      badge = notificationCount;
    }

    let iconInactiveName: keyof typeof Ionicons.glyphMap = "help-outline";
    let iconActiveName: keyof typeof Ionicons.glyphMap = "help";
    try {
      if (typeof icon === 'function') {
        const inactiveIconElement = icon({ focused: false, color: colors.text.tertiary, size: 22 });
        iconInactiveName = inactiveIconElement?.props?.name || "help-outline";
        const activeIconElement = icon({ focused: true, color: colors.primary, size: 22 });
        iconActiveName = activeIconElement?.props?.name || "help";
      }
    } catch (e) {
      console.warn("Failed to get icon name for route:", route.name, e);
    }

    return {
      key: route.key,
      label,
      iconInactive: iconInactiveName,
      iconActive: iconActiveName,
      badge,
    };
  });

  const activeTab = state.routes[state.index].key;

  const handleTabPress = (tabKey: string) => {
    const route = state.routes.find((r: any) => r.key === tabKey);
    if (!route) return;

    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  return (
    <BottomNavigation
      tabs={tabs}
      activeTab={activeTab}
      onTabPress={handleTabPress}
      style={{ paddingBottom: insets.bottom }}
    />
  );
}

// Main Tab Navigator - Specification V1
function MainTabs() {
  const isDev = __DEV__;

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="CompaniesTab"
        component={CompaniesNavigator}
        options={{
          tabBarLabel: "Companies",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "briefcase" : "briefcase-outline"} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="PeopleTab"
        component={PeopleNavigator}
        options={{
          tabBarLabel: "People",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "people-circle" : "people-circle-outline"} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="InvestorsTab"
        component={InvestorsNavigator}
        options={{
          tabBarLabel: "Investors",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "trending-up" : "trending-up-outline"} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="TransactionsTab"
        component={TransactionsNavigator}
        options={{
          tabBarLabel: "Transactions",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "swap-vertical" : "swap-vertical-outline"} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="MySpecterTab"
        component={MySpecterNavigator}
        options={{
          tabBarLabel: "My Specter",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "sparkles" : "sparkles-outline"} focused={focused} />
          ),
        }}
      />
      {/* API Explorer only in development mode */}
      {isDev && (
      <Tab.Screen
        name="ApiTestingTab"
        component={ApiTestingNavigator}
        options={{
            tabBarLabel: "API",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "code" : "code-outline"} focused={focused} />
          ),
        }}
      />
      )}
    </Tab.Navigator>
  );
}

// Authentication Loading Screen
function AuthLoadingScreen() {
  return (
    <View style={[styles.container, styles.loadingContainer]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Loading Specter...</Text>
    </View>
  );
}

export default function MainNavigator() {
  const isWeb = Platform.OS === "web";
  const { isSignedIn: cachedSignedIn, isBootstrapped, bootstrapAuth, setAuthEmail } = useAuthStore();
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);
  const [showSplash, setShowSplash] = React.useState(true);

  // Still call useAuth, but we'll be more flexible with its results in dev
  let clerkIsLoaded = false;
  let clerkIsSignedIn = false;
  
  try {
    const auth = useAuth();
    clerkIsLoaded = auth.isLoaded;
    clerkIsSignedIn = auth.isSignedIn;
  } catch (e) {
    // In some web dev environments, useAuth might throw if Clerk hasn't initialized at all
    if (!isWeb) console.error("Clerk useAuth error:", e);
  }

  React.useEffect(() => {
    // Check for ?logout=1 query param to force sign out (useful in web debug)
    const location = typeof window !== "undefined" ? window.location : undefined;
    if (isWeb && location?.search?.includes("logout=1")) {
      console.log('🧭 [MainNavigator] Forcing logout via URL param');
      import('../stores/userStore').then(({ clearUserContext }) => {
        import('../utils/tokenCache').then(({ clearTokenCache }) => {
          clearTokenCache().finally(() => {
            clearUserContext().finally(() => {
              setAuthEmail(null).finally(() => {
                location.assign(location.origin + location.pathname);
              });
            });
          });
        });
      });
      return;
    }

    const timeout = setTimeout(() => {
      if (isCheckingAuth) setIsCheckingAuth(false);
    }, 2000);

    bootstrapAuth().finally(() => {
      clearTimeout(timeout);
      setIsCheckingAuth(false);
    });

    return () => clearTimeout(timeout);
  }, [bootstrapAuth, isCheckingAuth, setAuthEmail]);

  console.log('🧭 [MainNavigator] Rendering', { 
    clerkIsLoaded, 
    clerkIsSignedIn, 
    cachedSignedIn,
    isCheckingAuth,
    showSplash
  });

  if (showSplash) {
    return <LoadingSplashScreen onAnimationComplete={() => {
      console.log('🧭 [MainNavigator] Splash complete, transitioning...');
      setShowSplash(false);
    }} />;
  }

  // Consider the app "loaded" once we've checked local auth state (and Clerk if available).
  const isLoaded = !isCheckingAuth && (isBootstrapped || clerkIsLoaded || Platform.OS !== 'web');

  // Native-only: trust Clerk session state; cached JWT is only a performance optimization.
  // Web troubleshooting may rely on cached auth state if Clerk cannot initialize on localhost.
  const isSignedIn = isWeb ? clerkIsSignedIn || cachedSignedIn : clerkIsSignedIn;

  if (!isLoaded) {
    console.log('🧭 [MainNavigator] Rendering AuthLoadingScreen');
    return <AuthLoadingScreen />;
  }

  console.log('🧭 [MainNavigator] Rendering RootStack.Navigator, isSignedIn:', isSignedIn, 'isLoaded:', isLoaded);
  
  return (
    <View style={styles.container}>
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      >
        {isSignedIn ? (
          <RootStack.Screen name="MainTabs" component={MainTabs} />
        ) : (
          <>
            <RootStack.Screen name="SignIn" component={SignInScreen} />
            <RootStack.Screen name="SignUp" component={SignUpScreen} />
          </>
        )}
      </RootStack.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card.bg,
    ...(Platform.OS === 'web' ? { height: '100vh', width: '100vw' } : {}),
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text.secondary,
  },
});
