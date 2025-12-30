import React, { useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ViewStyle,
  Platform,
  PanResponder,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../../theme/colors";
import { shadows } from "../../../theme/shadows";

interface TabItem {
  key: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconActive?: keyof typeof Ionicons.glyphMap;
  iconInactive?: keyof typeof Ionicons.glyphMap;
  badge?: number;
}

interface BottomNavigationProps {
  tabs: TabItem[];
  activeTab: string;
  onTabPress: (tabKey: string) => void;
  style?: ViewStyle;
}

const HORIZONTAL_PADDING = 8;
const SWIPE_THRESHOLD = 40;

export function BottomNavigation({ tabs, activeTab, onTabPress, style }: BottomNavigationProps) {
  const insets = useSafeAreaInsets();
  const activeTabIndex = tabs.findIndex(tab => tab.key === activeTab);

  const activeIndexRef = useRef(activeTabIndex);
  const tabsRef = useRef(tabs);

  activeIndexRef.current = activeTabIndex;
  tabsRef.current = tabs;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          const { dx, dy } = gesture;
          return Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy);
        },
        onPanResponderRelease: (_, gesture) => {
          const { dx } = gesture;
          const currentIndex = activeIndexRef.current;
          const items = tabsRef.current;
          if (!items?.length) return;

          if (dx <= -SWIPE_THRESHOLD && currentIndex < items.length - 1) {
            onTabPress(items[currentIndex + 1].key);
            return;
          }

          if (dx >= SWIPE_THRESHOLD && currentIndex > 0) {
            onTabPress(items[currentIndex - 1].key);
          }
        },
      }),
    [onTabPress]
  );

  return (
    <View 
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }, style]}
      {...panResponder.panHandlers}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => {
              // Light haptic feedback for tab switching
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onTabPress(tab.key);
            }}
            style={({ pressed }) => [
              styles.tab,
              isActive && styles.tabActive,
              pressed && styles.tabPressed,
            ]}
          >
            <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
              <Ionicons
                name={(isActive ? (tab.iconActive ?? tab.icon) : (tab.iconInactive ?? tab.icon)) ?? "help-outline"}
                size={22}
                color={isActive ? colors.primary : colors.text.tertiary}
              />
              {tab.badge != null && tab.badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[styles.label, isActive ? styles.labelActive : styles.labelHidden]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card.bg,
    borderColor: colors.content.borderLight,
    borderWidth: 1,
    minHeight: 68,
    paddingVertical: 10,
    paddingHorizontal: HORIZONTAL_PADDING,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    marginHorizontal: 12,
    marginBottom: 8,
    ...shadows.sm,
  },
  tab: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 16,
    gap: 4,
  },
  tabPressed: {
    opacity: 0.8,
  },
  tabActive: {
    backgroundColor: colors.primary + "14",
    borderWidth: 1,
    borderColor: colors.primary + "40",
  },
  iconContainer: {
    position: "relative",
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.content.bgSecondary,
    borderWidth: 1,
    borderColor: colors.content.borderLight,
  },
  iconContainerActive: {
    backgroundColor: colors.primary + "1A",
    borderColor: colors.primary + "40",
  },
  badge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: colors.warning, // Orange for notifications
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.card.bg, // White border for visibility
    shadowColor: colors.warning,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#000",
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
    maxWidth: 76,
    lineHeight: 12,
    textAlign: "center",
  },
  labelActive: {
    opacity: 1,
  },
  labelHidden: {
    opacity: 0,
  },
});
