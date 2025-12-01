import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { List, fetchLists } from "../api/specter";

type ListType = "companies" | "people";

export default function ListsScreen() {
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [lists, setLists] = useState<List[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ListType>("companies");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState("");

  const loadLists = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetchLists(token);
      setLists(response);
    } catch (error) {
      console.error("Failed to load lists:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadLists();
  }, [loadLists]);

  const handleListPress = useCallback((list: List) => {
    // TODO: Navigate to list detail
    console.log("Open list:", list.name);
  }, []);

  const handleCreateList = useCallback(() => {
    if (!newListName.trim()) {
      Alert.alert("Error", "Please enter a list name");
      return;
    }
    // TODO: Call API to create list
    console.log("Create list:", newListName);
    setShowCreateModal(false);
    setNewListName("");
  }, [newListName]);

  const renderListItem = useCallback(({ item }: { item: List }) => (
    <Pressable
      style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]}
      onPress={() => handleListPress(item)}
    >
      <View style={styles.listIcon}>
        <Ionicons name="list" size={18} color={colors.brand.green} />
      </View>
      <View style={styles.listInfo}>
        <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
        {item.description && (
          <Text style={styles.listDescription} numberOfLines={1}>
            {item.description}
          </Text>
        )}
      </View>
      <View style={styles.listMeta}>
        <Text style={styles.listCount}>{item.person_count || 0}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
      </View>
    </Pressable>
  ), [handleListPress]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="list-outline" size={48} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>No lists yet</Text>
        <Pressable
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={18} color={colors.text.inverse} />
          <Text style={styles.createButtonText}>Create your first list</Text>
        </Pressable>
      </View>
    );
  }, [isLoading]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Lists</Text>
        <Text style={styles.count}>{lists.length}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === "companies" && styles.tabActive]}
          onPress={() => setActiveTab("companies")}
        >
          <Text style={[styles.tabText, activeTab === "companies" && styles.tabTextActive]}>
            Companies
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "people" && styles.tabActive]}
          onPress={() => setActiveTab("people")}
        >
          <Text style={[styles.tabText, activeTab === "people" && styles.tabTextActive]}>
            People
          </Text>
        </Pressable>
      </View>

      {/* Lists */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.green} />
        </View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          renderItem={renderListItem}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.brand.green}
            />
          }
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={lists.length === 0 ? styles.emptyList : undefined}
        />
      )}

      {/* FAB */}
      {lists.length > 0 && (
        <Pressable
          style={[styles.fab, { bottom: insets.bottom + 16 }]}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={28} color={colors.text.inverse} />
        </Pressable>
      )}

      {/* Create List Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create List</Text>
              <Pressable onPress={() => setShowCreateModal(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </Pressable>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="List name"
              placeholderTextColor={colors.text.tertiary}
              value={newListName}
              onChangeText={setNewListName}
              autoFocus
            />
            <Pressable
              style={[
                styles.modalButton,
                !newListName.trim() && styles.modalButtonDisabled,
              ]}
              onPress={handleCreateList}
              disabled={!newListName.trim()}
            >
              <Text style={styles.modalButtonText}>Create</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text.primary,
  },
  count: {
    fontSize: 14,
    color: colors.text.secondary,
    backgroundColor: colors.content.bgSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.content.bgSecondary,
  },
  tabActive: {
    backgroundColor: colors.brand.green,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.text.inverse,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.borderLight,
  },
  listItemPressed: {
    backgroundColor: colors.content.bgSecondary,
  },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.brand.green + "15",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
  },
  listDescription: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  listMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  listCount: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.secondary,
    backgroundColor: colors.content.bgSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.secondary,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand.green,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: 8,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.inverse,
  },
  fab: {
    position: "absolute",
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand.green,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.card.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text.primary,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.content.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text.primary,
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: colors.brand.green,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalButtonDisabled: {
    backgroundColor: colors.text.tertiary,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.inverse,
  },
});

