import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { specterPublicAPI } from '../api/public-client';
import { useClerkToken } from '../hooks/useClerkToken';

const API_ENDPOINTS = [
  { name: 'People Enrichment', method: 'POST', endpoint: '/people', description: 'Search/enrich people' },
  { name: 'Person by ID', method: 'GET', endpoint: '/people/{id}', description: 'Get person details' },
  { name: 'Person by Email', method: 'GET', endpoint: '/people/by-email?email={email}', description: 'Find person by email' },
  { name: 'Saved Searches', method: 'GET', endpoint: '/searches', description: 'List saved searches' },
  { name: 'Search Results', method: 'GET', endpoint: '/searches/people/{id}/results', description: 'Get search results' },
  { name: 'People Lists', method: 'GET', endpoint: '/lists/people', description: 'List people lists' },
];

export default function ApiTestingScreen() {
  const { getAuthToken } = useClerkToken();
  const [selectedEndpoint, setSelectedEndpoint] = useState(API_ENDPOINTS[0]);
  const [requestBody, setRequestBody] = useState('{\n  "limit": 10,\n  "offset": 0\n}');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastRequest, setLastRequest] = useState('');

  const testEndpoint = async () => {
    setLoading(true);
    setResponse('');
    
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");

      const startTime = Date.now();
      let result;
      
      // Parse request body for POST requests
      const body = selectedEndpoint.method === 'POST' ? JSON.parse(requestBody) : undefined;
      
      // Execute API call based on endpoint
      switch (selectedEndpoint.endpoint) {
        case '/people':
          result = await specterPublicAPI.people.enrich(body, token);
          break;
        case '/people/{id}':
          const personId = 'example-person-id'; // TODO: Make dynamic
          result = await specterPublicAPI.people.getById(personId, token);
          break;
        case '/people/by-email?email={email}':
          const email = 'example@email.com'; // TODO: Make dynamic
          result = await specterPublicAPI.people.getByEmail(email, token);
          break;
        case '/searches':
          result = await specterPublicAPI.searches.getAll(token);
          break;
        case '/searches/people/{id}/results':
          const searchId = 'example-search-id'; // TODO: Make dynamic
          result = await specterPublicAPI.searches.getPeopleResults(searchId, 0, 10, token);
          break;
        case '/lists/people':
          result = await specterPublicAPI.lists.getPeopleLists(token);
          break;
        default:
          throw new Error('Endpoint not implemented in testing screen');
      }
      
      const duration = Date.now() - startTime;
      const formattedResponse = JSON.stringify(result, null, 2);
      
      setLastRequest(`${selectedEndpoint.method} ${selectedEndpoint.endpoint}`);
      setResponse(`✅ SUCCESS (${duration}ms)\n\n${formattedResponse}`);
      
    } catch (error: any) {
      const errorResponse = {
        error: error.message,
        statusCode: error.statusCode,
        stack: error.stack
      };
      setResponse(`❌ ERROR\n\n${JSON.stringify(errorResponse, null, 2)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚀 API Testing Playground</Text>
      
      {/* Endpoint Selector */}
      <Text style={styles.sectionTitle}>Select Endpoint:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.endpointScroll}>
        {API_ENDPOINTS.map((endpoint, index) => (
          <Pressable
            key={index}
            style={[
              styles.endpointChip,
              selectedEndpoint === endpoint && styles.endpointChipSelected
            ]}
            onPress={() => setSelectedEndpoint(endpoint)}
          >
            <Text style={[
              styles.endpointChipText,
              selectedEndpoint === endpoint && styles.endpointChipTextSelected
            ]}>
              {endpoint.method} {endpoint.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      
      <Text style={styles.endpointDesc}>{selectedEndpoint.description}</Text>
      
      {/* Request Body (for POST) */}
      {selectedEndpoint.method === 'POST' && (
        <>
          <Text style={styles.sectionTitle}>Request Body (JSON):</Text>
          <TextInput
            style={styles.requestInput}
            multiline
            value={requestBody}
            onChangeText={setRequestBody}
            placeholder="Enter JSON request body..."
            placeholderTextColor={colors.text.tertiary}
          />
        </>
      )}
      
      {/* Test Button */}
      <Pressable 
        style={[styles.testButton, loading && styles.testButtonDisabled]}
        onPress={testEndpoint}
        disabled={loading}
      >
        <Ionicons name="play" size={20} color="white" />
        <Text style={styles.testButtonText}>
          {loading ? 'Testing...' : 'Test API Call'}
        </Text>
      </Pressable>
      
      {/* Last Request */}
      {lastRequest && (
        <Text style={styles.lastRequest}>Last Request: {lastRequest}</Text>
      )}
      
      {/* Response */}
      <Text style={styles.sectionTitle}>Response:</Text>
      <ScrollView style={styles.responseContainer}>
        <Text style={styles.responseText}>
          {response || 'Response will appear here...'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.card.bg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  endpointScroll: {
    marginBottom: 8,
  },
  endpointChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: colors.content.bgSecondary,
    borderWidth: 1,
    borderColor: colors.content.border,
  },
  endpointChipSelected: {
    backgroundColor: colors.brand.green,
    borderColor: colors.brand.green,
  },
  endpointChipText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  endpointChipTextSelected: {
    color: colors.text.inverse,
  },
  endpointDesc: {
    fontSize: 14,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  requestInput: {
    height: 120,
    borderWidth: 1,
    borderColor: colors.content.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text.primary,
    backgroundColor: colors.content.bgSecondary,
    fontFamily: 'monospace',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.green,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  testButtonDisabled: {
    opacity: 0.6,
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  lastRequest: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontFamily: 'monospace',
    marginTop: 8,
  },
  responseContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.content.border,
    borderRadius: 8,
    backgroundColor: colors.content.bgSecondary,
    padding: 12,
  },
  responseText: {
    fontSize: 12,
    color: colors.text.primary,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});

