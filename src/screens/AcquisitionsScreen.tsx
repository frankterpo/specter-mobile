import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { theme } from "../theme";
import { TransactionsStackParamList } from "../types/navigation";
import SignalCardV2 from "../components/ui/cards/SignalCardV2";
import { SkeletonSignalCard } from "../components/ui/skeleton/SkeletonCards";
import { useSignals } from "../hooks/useSignals";
import { FlashList } from "@shopify/flash-list";

type NavigationProp = NativeStackNavigationProp<TransactionsStackParamList, "TransactionsMain">;

export default function AcquisitionsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = theme;
  
  const {
    data,
    isLoading,
    isRefreshing,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useSignals('ACQUISITION');

  const items = useMemo(() => 
    data?.pages.flatMap(page => page.items) || [], 
  [data]);

  const handlePress = useCallback((item: any) => {
    navigation.navigate("TransactionDetail", { type: 'Acquisition', item });
  }, [navigation]);

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No acquisitions found</Text>
      </View>
    );
  };

  const renderSkeleton = () => (
    <View style={{ padding: 16 }}>
      {[1, 2, 3, 4, 5].map(i => <SkeletonSignalCard key={i} />)}
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading ? renderSkeleton() : (
        <FlashList
          data={items}
          estimatedItemSize={180}
          keyExtractor={(item, index) => item.id || `a-${index}`}
          renderItem={({ item }) => (
            <SignalCardV2
              type="ACQUISITION"
              item={item}
              onPress={() => handlePress(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={isRefreshing} 
              onRefresh={refetch} 
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={renderEmpty}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ margin: 20 }} color={colors.primary} /> : null}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.text.tertiary,
    fontSize: 16,
  }
});
