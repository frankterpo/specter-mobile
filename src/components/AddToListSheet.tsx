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
import { useAuth } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { List, fetchLists, addToList } from "../api/specter";

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
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [lists, setLists] = useState<List[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addingToList, setAddingToList] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
    }
  }, [getToken]);

  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      loadLists();
    }
  }, [visible, loadLists]);

  const handleAddToList = useCallback(async (list: List) => {
    try {
      setAddingToList(list.id);
      const token = await getToken();
      if (!token) return;

      await addToList(token, list.id, entityId);
      onClose();
    } catch (error) {
      console.error("Failed to add to list:", error);
    } finally {
      setAddingToList(null);
    }
  }, [getToken, entityId, onClose]);

  const filteredLists = lists.filter((list) =>
    list.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderListItem = useCallback(({ item }: { item: List }) => (
    <Pressable
      style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]}
      onPress={() => handleAddToList(item)}
      disabled={addingToList !== null}
    >
      <View style={styles.listIcon}>
        <Ionicons name="list" size={16} color={colors.brand.green} />
      </View>
      <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
      {addingToList === item.id ? (
        <ActivityIndicator size="small" color={colors.brand.green} />
      ) : (
        <Ionicons name="add-circle-outline" size={22} color={colors.brand.green} />
      )}
    </Pressable>
  ), [handleAddToList, addingToList]);

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
              <ActivityIndicator size="large" color={colors.brand.green} />
            </View>
          ) : filteredLists.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No lists found</Text>
            </View>
          ) : (
            <FlatList
              data={filteredLists}
              keyExtractor={(item) => item.id}
              renderItem={renderListItem}
              showsVerticalScrollIndicator={false}
              style={styles.list}
            />
          )}

          {/* Create new list button */}
          <Pressable style={styles.createButton}>
            <Ionicons name="add" size={18} color={colors.brand.green} />
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
    backgroundColor: colors.brand.green + "15",
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
    borderColor: colors.brand.green,
    borderRadius: 8,
    borderStyle: "dashed",
    gap: 6,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.brand.green,
  },
});

