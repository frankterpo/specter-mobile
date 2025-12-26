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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { specterPublicAPI } from "../api/public-client";
import { useClerkToken } from "../hooks/useClerkToken";

type ListType = "companies" | "people";

interface List {
  id: string;
  name: string;
  count?: number;
}

export default function ListsScreen() {
  const insets = useSafeAreaInsets();
  const { getAuthToken } = useClerkToken();

  const [lists, setLists] = useState<List[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ListType>("people");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const loadLists = useCallback(async () => {
    try {
      if (activeTab === "people") {
        const token = await getAuthToken();
        if (!token) throw new Error("Not authenticated");
        const response = await specterPublicAPI.lists.getPeopleLists(token);
        setLists(response);
      } else {
        // Companies lists not yet available in public API
        setLists([]);
      }
    } catch (error) {
      console.error("Failed to load lists:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setIsLoading(true);
    loadLists();
  }, [loadLists, activeTab]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadLists();
  }, [loadLists]);

  const handleListPress = useCallback((list: List) => {
    // TODO: Navigate to list detail
    console.log("Open list:", list.name);
    Alert.alert("List Selected", `Opening ${list.name}...`);
  }, []);

  const handleCreateList = useCallback(async () => {
    if (!newListName.trim()) {
      Alert.alert("Error", "Please enter a list name");
      return;
    }
    
    setIsCreating(true);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      await specterPublicAPI.lists.createPeopleList(newListName, undefined, token);
      Alert.alert("Success", `List "${newListName}" created!`);
      setShowCreateModal(false);
      setNewListName("");
      loadLists(); // Refresh lists
    } catch (error) {
      console.error("Failed to create list:", error);
      Alert.alert("Error", "Failed to create list");
    } finally {
      setIsCreating(false);
    }
  }, [newListName, loadLists]);

  const renderListItem = useCallback(({ item }: { item: List }) => (
    <Pressable
      style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]}
      onPress={() => handleListPress(item)}
    >
      <View style={styles.listIcon}>
        <Ionicons name="list" size={18} color={colors.brand.green} />
      </View>
      <View style={styles.listContent}>
        <Text style={styles.listName}>{item.name}</Text>
        {item.count !== undefined && (
          <Text style={styles.listCount}>{item.count} items</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
    </Pressable>
  ), [handleListPress]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="list-outline" size={48} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>No lists yet</Text>
        <Text style={styles.emptySubtext}>
          Create a list to organize {activeTab}
        </Text>
        <Pressable style={styles.createButton} onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add" size={18} color={colors.text.inverse} />
          <Text style={styles.createButtonText}>Create List</Text>
        </Pressable>
      </View>
    );
  }, [isLoading, activeTab]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Lists</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color={colors.brand.green} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <Pressable
          style={[styles.tab, activeTab === "people" && styles.tabActive]}
          onPress={() => setActiveTab("people")}
        >
          <Text style={[styles.tabText, activeTab === "people" && styles.tabTextActive]}>
            People
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "companies" && styles.tabActive]}
          onPress={() => setActiveTab("companies")}
        >
          <Text style={[styles.tabText, activeTab === "companies" && styles.tabTextActive]}>
            Companies
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
          contentContainerStyle={lists.length === 0 ? { flex: 1 } : undefined}
        />
      )}

      {/* Create Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCreateModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Create New List</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="List name"
              placeholderTextColor={colors.text.tertiary}
              value={newListName}
              onChangeText={setNewListName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowCreateModal(false);
                  setNewListName("");
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalCreateButton, isCreating && styles.modalCreateButtonDisabled]}
                onPress={handleCreateList}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color={colors.text.inverse} />
                ) : (
                  <Text style={styles.modalCreateButtonText}>Create</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Pressable>
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
    fontSize: 24,
    fontWeight: "700",
    color: colors.text.primary,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.green + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.content.bgSecondary,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.brand.green,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text.secondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 8,
    textAlign: "center",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand.green,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
    gap: 6,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.inverse,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.borderLight,
  },
  listItemPressed: {
    backgroundColor: colors.content.bgSecondary,
  },
  listIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.brand.green + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    flex: 1,
    marginLeft: 12,
  },
  listName: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text.primary,
  },
  listCount: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: colors.card.bg,
    borderRadius: 12,
    padding: 20,
    width: "85%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 16,
    textAlign: "center",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.content.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text.primary,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.content.bgSecondary,
    alignItems: "center",
  },
  modalCancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  modalCreateButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.brand.green,
    alignItems: "center",
  },
  modalCreateButtonDisabled: {
    opacity: 0.6,
  },
  modalCreateButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.inverse,
  },
});
