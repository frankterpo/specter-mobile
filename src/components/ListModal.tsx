import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import {
  fetchLists,
  addToList,
  removeFromList,
  getPersonLists,
  List,
} from "../api/specter";

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
  const { getToken } = useAuth();
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
      const token = await getToken();
      if (!token) {
        setError("Authentication required");
        return;
      }

      const [userLists, personListIds] = await Promise.all([
        fetchLists(token),
        getPersonLists(token, personId),
      ]);

      setLists(userLists);
      setSelectedLists(personListIds);
    } catch (error: any) {
      console.error("❌ Load lists error:", error);
      setError(error.message || "Failed to load lists");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleList = async (listId: string) => {
    setIsUpdating(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError("Authentication required");
        return;
      }

      const isSelected = selectedLists.includes(listId);

      if (isSelected) {
        await removeFromList(token, listId, personId);
        setSelectedLists((prev) => prev.filter((id) => id !== listId));
      } else {
        await addToList(token, listId, personId);
        setSelectedLists((prev) => [...prev, listId]);
      }
    } catch (error: any) {
      console.error("❌ Toggle list error:", error);
      setError(error.message || "Failed to update list");
      // Revert optimistic update on error
      await loadData();
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Add to List</Text>
              <Text style={styles.headerSubtitle}>{personName}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#1a365d" />
            </Pressable>
          </View>

          {/* Content */}
          {error ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="alert-circle-outline" size={60} color="#ef4444" />
              <Text style={styles.emptyTitle}>Error Loading Lists</Text>
              <Text style={styles.emptySubtitle}>{error}</Text>
              <Pressable onPress={loadData} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1a365d" />
              <Text style={styles.loadingText}>Loading lists...</Text>
            </View>
          ) : lists.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="list-outline" size={60} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Lists Yet</Text>
              <Text style={styles.emptySubtitle}>
                Create lists in the web app to organize people
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.content}>
              {lists.map((list) => {
                const isSelected = selectedLists.includes(list.id);
                return (
                  <Pressable
                    key={list.id}
                    onPress={() => toggleList(list.id)}
                    style={[
                      styles.listItem,
                      isSelected && styles.listItemSelected,
                    ]}
                    disabled={isUpdating}
                  >
                    <View style={styles.listItemLeft}>
                      <View
                        style={[
                          styles.checkbox,
                          isSelected && styles.checkboxSelected,
                        ]}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={16} color="white" />
                        )}
                      </View>
                      <View style={styles.listInfo}>
                        <Text style={styles.listName}>{list.name}</Text>
                        {list.description && (
                          <Text style={styles.listDescription} numberOfLines={1}>
                            {list.description}
                          </Text>
                        )}
                      </View>
                    </View>
                    {list.person_count !== undefined && (
                      <Text style={styles.listCount}>{list.person_count}</Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.doneButton}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a365d",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a365d",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 8,
    textAlign: "center",
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#f9fafb",
  },
  listItemSelected: {
    backgroundColor: "#eff6ff",
  },
  listItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: "#1a365d",
    borderColor: "#1a365d",
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1a365d",
  },
  listDescription: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  listCount: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  doneButton: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#1a365d",
    alignItems: "center",
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#1a365d",
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
});
