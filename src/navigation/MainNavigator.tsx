import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen";
import SwipeDeckScreen from "../screens/SwipeDeckScreen";
import PersonDetailScreen from "../screens/PersonDetailScreen";
import CompanyDetailScreen from "../screens/CompanyDetailScreen";
import SettingsScreen from "../screens/SettingsScreen";
import DiagnosticsScreen from "../screens/DiagnosticsScreen";
import PersonaScreen from "../screens/PersonaScreen";
import { MainStackParamList } from "../types/navigation";

const Stack = createNativeStackNavigator<MainStackParamList>();

export default function MainNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="Dashboard" component={HomeScreen} />
      <Stack.Screen name="SwipeDeck" component={SwipeDeckScreen} />
      <Stack.Screen name="PersonDetail" component={PersonDetailScreen} />
      <Stack.Screen name="CompanyDetail" component={CompanyDetailScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} />
      <Stack.Screen name="Persona" component={PersonaScreen} />
    </Stack.Navigator>
  );
}
