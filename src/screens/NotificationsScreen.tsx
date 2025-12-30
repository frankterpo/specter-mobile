import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { specterPublicAPI } from "../api/public-client/client";
import { useClerkToken } from "../hooks/useClerkToken";
import { formatDistanceToNow } from "date-fns";
import { GlassCard } from "../components/ui/glass/GlassCard";

export default function NotificationsScreen() {
  const { getAuthToken } = useClerkToken();
  const { colors } = theme;
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      const result = await specterPublicAPI.user.getNotifications(token);
      return Array.isArray(result) ? result : (result.items || []);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity activeOpacity={0.7}>
      <GlassCard style={[
        styles.notificationItem,
        !item.read && styles.unreadItem
      ]}>
        <View style={styles.iconContainer}>
          <Ionicons 
            name={item.type === 'match' ? 'person-add' : 'notifications'} 
            size={24} 
            color={colors.primary} 
          />
        </View>
        <View style={styles.contentContainer}>
          <Text style={styles.title}>{item.title || "New Notification"}</Text>
          <Text style={styles.message} numberOfLines={2}>
            {item.message || item.body || "You have a new update."}
          </Text>
          <Text style={styles.time}>
            {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : "Just now"}
          </Text>
        </View>
        {!item.read && <View style={styles.dot} />}
      </GlassCard>
    </TouchableOpacity>
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="notifications-off-outline" size={48} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>No notifications yet</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlashList
        data={notifications || []}
        estimatedItemSize={100}
        renderItem={renderItem}
        keyExtractor={(item, index) => item.id || `n-${index}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={isLoading ? <ActivityIndicator style={{ margin: 20 }} color={colors.primary} /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    padding: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    marginVertical: 0,
    marginHorizontal: 0,
  },
  unreadItem: {
    borderColor: theme.colors.primary + '40',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  time: {
    fontSize: 11,
    color: theme.colors.text.tertiary,
    fontWeight: '600',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
    marginLeft: 12,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 400,
  },
  emptyText: {
    marginTop: 16,
    color: theme.colors.text.tertiary,
    fontSize: 16,
    fontWeight: '600',
  }
});
