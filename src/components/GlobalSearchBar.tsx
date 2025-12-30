import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import SearchBar from './ui/SearchBar';
import { specterPublicAPI } from '../api/public-client/client';
import { useClerkToken } from '../hooks/useClerkToken';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Ionicons } from '@expo/vector-icons';

export default function GlobalSearchBar() {
  const [term, setTerm] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const { getAuthToken } = useClerkToken();

  const { data: history } = useQuery({
    queryKey: ['search_history'],
    queryFn: async () => {
      const token = await getAuthToken();
      if (!token) return [];
      return specterPublicAPI.searches.getHistory(token);
    },
    enabled: showOverlay && !term,
  });

  const { data: results, isLoading } = useQuery({
    queryKey: ['quick_search', term],
    queryFn: async () => {
      const token = await getAuthToken();
      if (!token) return null;
      return specterPublicAPI.searches.getCounts(term, token);
    },
    enabled: showOverlay && term.length > 2,
  });

  return (
    <View style={styles.container}>
      <SearchBar
        value={term}
        onChangeText={setTerm}
        onFocus={() => setShowOverlay(true)}
        placeholder="Search Specter..."
      />

      {showOverlay && (
        <View style={styles.overlay}>
          {term.length < 3 ? (
            <FlatList
              data={history}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={<Text style={styles.header}>Recent Searches</Text>}
              renderItem={({ item }) => (
                <Pressable style={styles.item}>
                  <Ionicons name="time-outline" size={20} color={colors.text.tertiary} />
                  <Text style={styles.itemText}>{item.name}</Text>
                </Pressable>
              )}
            />
          ) : (
            <View>
              <Text style={styles.header}>Results</Text>
              {isLoading ? (
                <ActivityIndicator color={colors.brand.blue} style={{ marginTop: 20 }} />
              ) : (
                <View>
                  <SearchResultRow icon="business" label="Companies" count={results?.companies} />
                  <SearchResultRow icon="people" label="People" count={results?.people} />
                  <SearchResultRow icon="wallet" label="Investors" count={results?.investors} />
                </View>
              )}
            </View>
          )}
          
          <Pressable style={styles.closeBtn} onPress={() => setShowOverlay(false)}>
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function SearchResultRow({ icon, label, count }: { icon: any, label: string, count?: number }) {
  return (
    <Pressable style={styles.item}>
      <Ionicons name={icon} size={20} color={colors.brand.blue} />
      <Text style={styles.itemText}>{label}</Text>
      <Text style={styles.countText}>{count?.toLocaleString() ?? 0}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 1000,
    width: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: colors.content.bg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.content.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    maxHeight: 400,
  },
  header: {
    ...typography.labelSmall,
    color: colors.text.tertiary,
    marginBottom: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.content.border,
  },
  itemText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginLeft: 12,
    flex: 1,
  },
  countText: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
  },
  closeBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeBtnText: {
    color: colors.brand.blue,
    ...typography.labelMedium,
  },
});
