import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { specterPublicAPI } from "../api/public-client";
import { useClerkToken } from "../hooks/useClerkToken";

interface AddToListSheetProps {
  visible: boolean;
  onClose: () => void;
  entityId: string;
  entityType: "person" | "company";
  entityName: string;
}

export default function AddToListSheet({
  visible,
  onClose,
  entityId,
  entityType,
  entityName,
}: AddToListSheetProps) {
  const insets = useSafeAreaInsets();
  const { getAuthToken } = useClerkToken();

  const [lists, setLists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addingToList, setAddingToList] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadLists = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      const response = await specterPublicAPI.lists.getLists(entityType === "person" ? "people" : "company", 5000, token);
      const normalizedLists = Array.isArray(response) ? response : Array.isArray((response as any)?.lists) ? (response as any).lists : [];
      setLists(normalizedLists);
    } catch (error) {
      console.error("Failed to load lists:", error);
      setLists([]);
    } finally {
      setIsLoading(false);
    }
  }, [entityType, getAuthToken]);

  useEffect(() => {
    if (visible) {
      loadLists();
    }
  }, [visible, loadLists]);

  const handleAddToList = useCallback(
    async (list: any) => {
    try {
      setAddingToList(list.id);
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
        await specterPublicAPI.lists.addPersonToList(list.id, entityId, token);
      onClose();
    } catch (error) {
      console.error("Failed to add to list:", error);
    } finally {
      setAddingToList(null);
    }
    },
    [entityId, onClose]
  );

  const filteredLists = lists.filter((list: any) =>
    list.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderListItem = useCallback(({ item }: { item: any }) => (
    <Pressable
      style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]}
      onPress={() => handleAddToList(item)}
      disabled={addingToList !== null}
    >
      <View style={styles.listIcon}>
        <Ionicons name="list" size={16} color={colors.primary} />
      </View>
      <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
      {addingToList === item.id ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
      )}
    </Pressable>
  ), [handleAddToList, addingToList, colors]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable 
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add to List</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{entityName}</Text>
          </View>

          {/* Search */}
          {lists.length > 5 && (
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={16} color={colors.text.tertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search lists..."
                placeholderTextColor={colors.text.tertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          )}

          {/* Lists */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredLists.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="list-outline"
                size={48}
                color={colors.text.tertiary}
              />
              <Text style={styles.emptyText}>No lists found</Text>
              <Text style={styles.emptySubtext}>
                Create a new list to get started
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredLists}
              keyExtractor={(item) => item.id || `list-${item.name}`}
              renderItem={renderListItem}
              style={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Create new list button */}
          <Pressable
            style={styles.createButton}
            onPress={() => {
              // TODO: Implement create list functionality
              console.log("Create new list - TODO");
            }}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.createButtonText}>Create New List</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.card.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.content.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.borderLight,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.content.bgSecondary,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    padding: 0,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 12,
    fontWeight: "500",
  },
  emptySubtext: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 4,
    textAlign: "center",
  },
  list: {
    maxHeight: 300,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.borderLight,
    gap: 12,
  },
  listItemPressed: {
    backgroundColor: colors.content.bgSecondary,
  },
  listIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  listName: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    borderStyle: "dashed",
    gap: 6,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.primary,
  },
  createButtonDisabled: {
    borderColor: colors.text.tertiary,
    opacity: 0.5,
  },
  createButtonTextDisabled: {
    color: colors.text.tertiary,
  },
});
