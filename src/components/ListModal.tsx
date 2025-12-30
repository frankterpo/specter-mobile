import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { specterPublicAPI } from "../api/public-client";
import { colors } from "../theme/colors";
import { useClerkToken } from "../hooks/useClerkToken";

interface List {
  id: string;
  name: string;
}

interface ListModalProps {
  visible: boolean;
  onClose: () => void;
  personId: string;
  personName: string;
}

export default function ListModal({
  visible,
  onClose,
  personId,
  personName,
}: ListModalProps) {
  const { getAuthToken } = useClerkToken();
  const [lists, setLists] = useState<List[]>([]);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      const userLists = await specterPublicAPI.lists.getLists("people", 5000, token);
      const normalizedLists = Array.isArray(userLists)
        ? userLists
        : Array.isArray((userLists as any)?.lists)
          ? (userLists as any).lists
          : [];
      setLists(normalizedLists);
      setSelectedLists([]);
    } catch (err: any) {
      console.error("Load lists error:", err);
      setError(err.message || "Failed to load lists");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleList = (listId: string) => {
    setSelectedLists((prev) =>
      prev.includes(listId)
        ? prev.filter((id) => id !== listId)
        : [...prev, listId]
    );
  };

  const handleSave = async () => {
    if (selectedLists.length === 0) {
      Alert.alert("Select a List", "Please select at least one list to add this person to.");
      return;
    }

    setIsUpdating(true);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");

      // Add person to all selected lists
      await Promise.all(
        selectedLists.map((listId) =>
          specterPublicAPI.lists.addPersonToList(listId, personId, token)
        )
      );
      
      Alert.alert(
        "Success",
        `${personName} added to ${selectedLists.length} list(s).`
      );
      onClose();
    } catch (err: any) {
      console.error("Save error:", err);
      Alert.alert("Error", err.message || "Failed to add to lists");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add to List</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {personName}
            </Text>
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={32} color={colors.destructive} />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={loadData}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : lists.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="list-outline" size={48} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>No lists yet</Text>
              <Text style={styles.emptySubtext}>
                Create a list in the Lists tab first
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.listContainer}>
              {lists.map((list) => (
                <Pressable
                  key={list.id}
                  style={[
                    styles.listItem,
                    selectedLists.includes(list.id) && styles.listItemSelected,
                  ]}
                  onPress={() => toggleList(list.id)}
                >
                  <View style={styles.listIcon}>
                    <Ionicons
                      name={selectedLists.includes(list.id) ? "checkbox" : "square-outline"}
                      size={20}
                      color={
                        selectedLists.includes(list.id)
                          ? colors.primary
                          : colors.text.tertiary
                      }
                    />
                  </View>
                  <Text style={styles.listName}>{list.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Actions */}
          {!isLoading && !error && lists.length > 0 && (
            <View style={styles.actions}>
              <Pressable style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, isUpdating && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Add to List</Text>
                )}
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.card.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
    paddingBottom: 32,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.content.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.borderLight,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  errorContainer: {
    padding: 40,
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    marginTop: 12,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  retryButtonText: {
    fontSize: 14,
    color: colors.white,
    fontWeight: "500",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 12,
    fontWeight: "500",
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 4,
    textAlign: "center",
  },
  listContainer: {
    maxHeight: 300,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.content.borderLight,
  },
  listItemSelected: {
    backgroundColor: colors.primary + "10",
  },
  listIcon: {
    marginRight: 12,
  },
  listName: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.content.bgSecondary,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
  },
});
