import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SwipeDeckScreen from "../screens/SwipeDeckScreen";
import PersonDetailScreen from "../screens/PersonDetailScreen";
import SettingsScreen from "../screens/SettingsScreen";
import { MainStackParamList } from "../types/navigation";

const Stack = createNativeStackNavigator<MainStackParamList>();

export default function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="SwipeDeck" component={SwipeDeckScreen} />
      <Stack.Screen name="PersonDetail" component={PersonDetailScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
