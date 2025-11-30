import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import {
  MainTabParamList,
  CompaniesStackParamList,
  PeopleStackParamList,
  InvestorsStackParamList,
  TransactionsStackParamList,
  MySpecterStackParamList,
  RootStackParamList,
} from "../types/navigation";

// Screens
import CompaniesFeedScreen from "../screens/CompaniesFeedScreen";
import CompanyDetailScreen from "../screens/CompanyDetailScreen";
import PeopleFeedScreen from "../screens/PeopleFeedScreen";
import PersonDetailScreen from "../screens/PersonDetailScreen";
import InvestorsFeedScreen from "../screens/InvestorsFeedScreen";
import TransactionsFeedScreen from "../screens/TransactionsFeedScreen";
import MySpecterScreen from "../screens/MySpecterScreen";
import SettingsScreen from "../screens/SettingsScreen";

const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const CompaniesStack = createNativeStackNavigator<CompaniesStackParamList>();
const PeopleStack = createNativeStackNavigator<PeopleStackParamList>();
const InvestorsStack = createNativeStackNavigator<InvestorsStackParamList>();
const TransactionsStack = createNativeStackNavigator<TransactionsStackParamList>();
const MySpecterStack = createNativeStackNavigator<MySpecterStackParamList>();

// Companies Tab Navigator
function CompaniesNavigator() {
  return (
    <CompaniesStack.Navigator screenOptions={{ headerShown: false }}>
      <CompaniesStack.Screen name="CompaniesFeed" component={CompaniesFeedScreen} />
      <CompaniesStack.Screen name="CompanyDetail" component={CompanyDetailScreen} />
    </CompaniesStack.Navigator>
  );
}

// People Tab Navigator
function PeopleNavigator() {
  return (
    <PeopleStack.Navigator screenOptions={{ headerShown: false }}>
      <PeopleStack.Screen name="PeopleFeed" component={PeopleFeedScreen} />
      <PeopleStack.Screen name="PersonDetail" component={PersonDetailScreen} />
    </PeopleStack.Navigator>
  );
}

// Investors Tab Navigator
function InvestorsNavigator() {
  return (
    <InvestorsStack.Navigator screenOptions={{ headerShown: false }}>
      <InvestorsStack.Screen name="InvestorsFeed" component={InvestorsFeedScreen} />
    </InvestorsStack.Navigator>
  );
}

// Transactions Tab Navigator
function TransactionsNavigator() {
  return (
    <TransactionsStack.Navigator screenOptions={{ headerShown: false }}>
      <TransactionsStack.Screen name="FundingRounds" component={TransactionsFeedScreen} />
    </TransactionsStack.Navigator>
  );
}

// My Specter Tab Navigator
function MySpecterNavigator() {
  return (
    <MySpecterStack.Navigator screenOptions={{ headerShown: false }}>
      <MySpecterStack.Screen name="Searches" component={MySpecterScreen} />
    </MySpecterStack.Navigator>
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
      color={focused ? colors.brand.green : colors.text.tertiary}
    />
  );
}

// Main Tab Navigator
function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.sidebar.bg,
          borderTopColor: colors.sidebar.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.brand.green,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="CompaniesTab"
        component={CompaniesNavigator}
        options={{
          tabBarLabel: "Companies",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "business" : "business-outline"} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="PeopleTab"
        component={PeopleNavigator}
        options={{
          tabBarLabel: "People",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "people" : "people-outline"} focused={focused} />
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
          tabBarLabel: "Deals",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "cash" : "cash-outline"} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="MySpecterTab"
        component={MySpecterNavigator}
        options={{
          tabBarLabel: "My Specter",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "bookmark" : "bookmark-outline"} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Root Navigator with modal screens
export default function MainNavigator() {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <RootStack.Screen name="MainTabs" component={MainTabs} />
      <RootStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
    </RootStack.Navigator>
  );
}
