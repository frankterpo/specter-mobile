import React from "react";
import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import {
  MainTabParamList,
  CompaniesStackParamList,
  PeopleStackParamList,
  ListsStackParamList,
  SettingsStackParamList,
  RootStackParamList,
} from "../types/navigation";

// Screens
import CompaniesFeedScreen from "../screens/CompaniesFeedScreen";
import CompanyDetailScreen from "../screens/CompanyDetailScreen";
import PeopleFeedScreen from "../screens/PeopleFeedScreen";
import PersonDetailScreen from "../screens/PersonDetailScreen";
import ListsScreen from "../screens/ListsScreen";
import SettingsScreen from "../screens/SettingsScreen";

const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const CompaniesStack = createNativeStackNavigator<CompaniesStackParamList>();
const PeopleStack = createNativeStackNavigator<PeopleStackParamList>();
const ListsStack = createNativeStackNavigator<ListsStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

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

// Lists Tab Navigator
function ListsNavigator() {
  return (
    <ListsStack.Navigator screenOptions={{ headerShown: false }}>
      <ListsStack.Screen name="ListsFeed" component={ListsScreen} />
    </ListsStack.Navigator>
  );
}

// Settings Tab Navigator
function SettingsNavigator() {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="SettingsMain" component={SettingsScreen} />
    </SettingsStack.Navigator>
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

// Main Tab Navigator - 4 tabs only
function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card.bg,
          borderTopColor: colors.content.border,
          borderTopWidth: 1,
          height: 52 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.brand.green,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarLabelStyle: {
          fontSize: 11,
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
        name="ListsTab"
        component={ListsNavigator}
        options={{
          tabBarLabel: "Lists",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "list" : "list-outline"} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsNavigator}
        options={{
          tabBarLabel: "Settings",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "settings" : "settings-outline"} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Root Navigator
export default function MainNavigator() {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <RootStack.Screen name="MainTabs" component={MainTabs} />
    </RootStack.Navigator>
  );
}
