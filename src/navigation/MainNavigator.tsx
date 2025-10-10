import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PeopleListScreen from "../screens/PeopleListScreen";
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
      <Stack.Screen name="PeopleList" component={PeopleListScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
