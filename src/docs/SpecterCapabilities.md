# Specter API & Cactus SDK - Technical Reference

This document provides a comprehensive technical reference for all available Specter API endpoints and Cactus SDK capabilities. It is designed for AI assistants like Composer to execute implementations quickly and accurately.

---

## Table of Contents

1. [Specter API Overview](#specter-api-overview)
2. [Authentication](#authentication)
3. [Core Endpoints](#core-endpoints)
4. [Saved Searches API](#saved-searches-api)
5. [Talent Signals API](#talent-signals-api)
6. [Investor Interest API](#investor-interest-api)
7. [Enrichment API](#enrichment-api)
8. [Lists API](#lists-api)
9. [Cactus SDK Reference](#cactus-sdk-reference)
10. [Integration Patterns](#integration-patterns)

---

## Specter API Overview

**Base URLs:**
- Production API: `https://app.tryspecter.com/api/v1`
- Staging API: `https://specter-api-staging.up.railway.app`
- Entity Status: `https://app.staging.tryspecter.com/api/entity-status`
- Lists: `https://app.staging.tryspecter.com/api/lists`

**Authentication:** All endpoints require `X-API-Key` header or `Bearer` token (Clerk JWT).

**Rate Limits:** Standard API rate limiting applies. See `/api-ref/rate_limits`.

**Pagination:** Uses `limit` and `offset` query parameters. Max `limit` is typically 100.

---

## Authentication

### API Key Authentication
```typescript
headers: {
  'X-API-Key': '<your-api-key>',
  'Content-Type': 'application/json'
}
```

### Bearer Token (Clerk JWT)
```typescript
headers: {
  'Authorization': `Bearer ${clerkToken}`,
  'Content-Type': 'application/json'
}
```

---

## Core Endpoints

### 1. Entities / Text-Search

**Endpoint:** `POST /entities`

**Description:** Global search across people, companies, and other entities.

**Request Body:**
```typescript
interface EntitySearchRequest {
  query: string;           // Search term
  type?: 'people' | 'company' | 'all';
  limit?: number;          // Default: 20, Max: 100
  offset?: number;         // Default: 0
}
```

**Response:**
```typescript
interface EntitySearchResponse {
  items: Array<{
    id: string;
    type: 'person' | 'company';
    name: string;
    // ... entity-specific fields
  }>;
  total: number;
  has_more: boolean;
}
```

**Use Cases for AI Agent:**
- Global search when user types a name
- Finding companies by name before enrichment
- Cross-entity search for deal sourcing

---

### 2. People Endpoints

#### Get Person by ID
**Endpoint:** `GET /people/{personId}`

**Response Fields:**
```typescript
interface Person {
  id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  profile_image_url?: string;
  tagline?: string;
  location?: string;
  region?: string;
  seniority?: string;
  years_of_experience?: number;
  education_level?: string;
  field_of_study?: string;
  experience: Experience[];
  people_highlights?: string[];  // e.g., "UNICORN_FOUNDER", "YC_ALUMNI"
  linkedin_url?: string;
  twitter_url?: string;
  github_url?: string;
  followers_count?: number;
  connections_count?: number;
  entity_status?: EntityStatus;
}

interface Experience {
  company_name: string;
  title: string;
  is_current: boolean;
  company_size?: string;
  total_funding_amount?: number;
  start_date?: string;
  end_date?: string;
  industry?: string;
  department?: string;
}

interface EntityStatus {
  status: 'viewed' | 'liked' | 'disliked' | null;
  updated_at?: string;
  viewed_by_team?: boolean;
  liked_by_team?: boolean;
  disliked_by_team?: boolean;
}
```

#### Get Person Email
**Endpoint:** `GET /people/{personId}/email`

**Response:**
```typescript
interface PersonEmailResponse {
  email?: string;
  verified: boolean;
}
```

#### Get Person by Email
**Endpoint:** `POST /people/by-email`

**Request:**
```typescript
{ email: string }
```

---

### 3. Companies Endpoints

#### Get Company by ID
**Endpoint:** `GET /companies/{companyId}`

**Response Fields:**
```typescript
interface Company {
  id: string;
  name: string;
  logo_url?: string;
  description?: string;
  industry?: string;
  size?: string;           // e.g., "11-50", "51-200"
  founded_year?: number;
  location?: string;
  website?: string;
  linkedin_url?: string;
  total_funding?: number;
  growth_stage?: string;   // e.g., "seed", "series_a", "series_b"
  employee_count?: number;
  funding_rounds?: FundingRound[];
}
```

#### Get Similar Companies
**Endpoint:** `GET /companies/{companyId}/similar`

**Query Params:** `limit`, `offset`

**Use Case:** Find comparable companies for competitive analysis.

#### Get Company People
**Endpoint:** `GET /companies/{companyId}/people`

**Use Case:** Find founders/employees at a target company.

#### Search Company by Name
**Endpoint:** `GET /companies/search?name={query}`

**Use Case:** Autocomplete company names.

---

## Saved Searches API

**Key Concept:** Saved Searches are persistent search configurations created in the Specter web app. The API allows fetching these searches and their results.

### Get All Saved Searches

**Endpoint:** `GET /searches`

**Response:**
```typescript
interface SavedSearch {
  id: number;           // Search ID - use for fetching results
  name: string;         // Human-readable name
  is_global: boolean;   // Specter-recommended searches
  query_id: number;     // For URL construction
  product_type: 'company' | 'people' | 'talent' | 'investors';
  full_count: number;   // Total results
  new_count: number;    // New results this month
}

// Response is an array
type GetSearchesResponse = SavedSearch[];
```

**Example Response:**
```json
[
  {
    "id": 163,
    "name": "Series A Fintech UK",
    "is_global": false,
    "query_id": 10,
    "product_type": "company",
    "full_count": 245,
    "new_count": 12
  }
]
```

### Get Search Results by Type

Based on `product_type`, use the appropriate endpoint:

#### People Saved Search Results
**Endpoint:** `GET /people-searches/{searchId}/results`

**Query Params:**
- `limit`: number (max 100)
- `offset`: number
- `sort_by`: string (optional)

#### Company Saved Search Results
**Endpoint:** `GET /company-searches/{searchId}/results`

#### Talent Signals Saved Search Results
**Endpoint:** `GET /talent-searches/{searchId}/results`

#### Investor Interest Saved Search Results
**Endpoint:** `GET /investor-interest-searches/{searchId}/results`

### Get Search Details (Filters)

**Endpoint:** `GET /people-searches/{searchId}` (or company/talent/investor variant)

**Response:** Returns the filter configuration used for the search.

---

## Talent Signals API

**Definition:** Talent Signals track high-intent talent movement - employees leaving/joining companies, which indicates company trajectory.

### Get Talent Signal by ID

**Endpoint:** `GET /talent/{signalId}`

**Response:**
```typescript
interface TalentSignal {
  id: string;
  person_id: string;
  person_name: string;
  from_company: {
    id: string;
    name: string;
  };
  to_company: {
    id: string;
    name: string;
  };
  signal_type: 'departure' | 'hire' | 'promotion';
  detected_at: string;
  confidence: number;
}
```

### Talent Signals Lists

**Endpoint:** `GET /talent-lists`
**Response:** Array of user's talent signal lists.

**Endpoint:** `GET /talent-lists/{listId}/results`
**Response:** Talent signals in the list.

### Talent Signals Saved Search Results

**Endpoint:** `GET /talent-searches/{searchId}/results`

**Query Params:** `limit`, `offset`, `date_from`, `date_to`

**AI Agent Use Case:** 
- Monitor talent leaving competitors
- Track hiring activity at target companies
- Detect stealth startups forming

---

## Investor Interest API

**Definition:** Investor Interest Signals track which investors are actively researching or meeting with companies.

### Get Investor Interest Signal by ID

**Endpoint:** `GET /investor-interest/{signalId}`

**Response:**
```typescript
interface InvestorInterestSignal {
  id: string;
  investor: {
    id: string;
    name: string;
    type: 'vc' | 'angel' | 'pe' | 'corporate';
  };
  target_company: {
    id: string;
    name: string;
  };
  signal_strength: 'high' | 'medium' | 'low';
  detected_at: string;
  signal_sources: string[];  // e.g., "meeting_detected", "pitch_event"
}
```

### Investor Interest Lists

**Endpoint:** `GET /investor-interest-lists`
**Endpoint:** `GET /investor-interest-lists/{listId}/results`

### Investor Interest Saved Search Results

**Endpoint:** `GET /investor-interest-searches/{searchId}/results`

**AI Agent Use Case:**
- Track competitive intelligence (which VCs are circling a company)
- Identify hot deals before announcements
- Monitor co-investor activity

---

## Enrichment API

**Definition:** Enrichment endpoints add/update Specter data for entities you provide.

### Enrich People

**Endpoint:** `POST /enrichment/people`

**Request:**
```typescript
interface EnrichPeopleRequest {
  people: Array<{
    linkedin_url?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    company?: string;
  }>;
}
```

**Response:**
```typescript
interface EnrichPeopleResponse {
  results: Array<{
    input_index: number;
    person?: Person;  // Enriched person data
    status: 'found' | 'not_found' | 'pending';
    match_confidence: number;
  }>;
}
```

### Enrich Companies

**Endpoint:** `POST /enrichment/companies`

**Request:**
```typescript
interface EnrichCompaniesRequest {
  companies: Array<{
    domain?: string;
    linkedin_url?: string;
    name?: string;
  }>;
}
```

**AI Agent Use Case:**
- Enrich deal flow from external sources
- Bulk import portfolio company data
- Enhance CRM data with Specter intelligence

---

## Lists API

### People Lists

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Get all lists | GET | `/people-lists` |
| Create list | POST | `/people-lists` |
| Get list info | GET | `/people-lists/{listId}` |
| Get list results | GET | `/people-lists/{listId}/results` |
| Modify list | PATCH | `/people-lists/{listId}` |
| Delete list | DELETE | `/people-lists/{listId}` |

### Company Lists

Same pattern with `/companies-lists` prefix.

### Add/Remove from List

**Add to List:**
```typescript
POST /lists/{listId}/people
Body: { person_id: string }
```

**Remove from List:**
```typescript
DELETE /lists/{listId}/people/{personId}
```

---

## Entity Status API

**Definition:** Track user's interaction status with entities.

### Set Entity Status

**Endpoint:** `POST /entity-status/people/{personId}`

**Request:**
```typescript
interface SetStatusRequest {
  status: 'viewed' | 'liked' | 'disliked';
}
```

**Important:** Status is mutually exclusive. Setting `liked` removes `viewed`.

### Get Team Status

**Endpoint:** `GET /entity-status/people/{personId}/team`

**Response:**
```typescript
interface TeamStatusResponse {
  viewed_by: string[];   // Team member IDs
  liked_by: string[];
  disliked_by: string[];
}
```

---

## Cactus SDK Reference

### Installation

```bash
npm install cactus-react-native react-native-nitro-modules
npx pod-install  # iOS only
```

### Core Classes

#### CactusLM

The main class for local LLM inference.

```typescript
import { CactusLM, CactusConfig } from 'cactus-react-native';

// Enable telemetry (optional)
CactusConfig.telemetryToken = 'your-token';

// Initialize
const lm = new CactusLM({
  model: 'qwen3-0.6',     // Model name
  contextSize: 2048,       // Context window
});
```

#### Available Models

| Model | Size | Speed | Quality |
|-------|------|-------|---------|
| `qwen3-0.6` | 600MB | Fast | Good |
| `qwen3-1.7` | 1.7GB | Medium | Better |
| `llama3.2-1b` | 1GB | Medium | Good |
| `llama3.2-3b` | 3GB | Slow | Best |

### Methods

#### download()
```typescript
await lm.download({
  onProgress: (progress: number) => {
    // progress: 0.0 - 1.0
    console.log(`Download: ${Math.round(progress * 100)}%`);
  }
});
```

#### init()
```typescript
await lm.init();
// Model is now loaded into memory
```

#### complete()
```typescript
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];  // For multimodal models
}

interface CompleteOptions {
  maxTokens?: number;      // Default: 512
  temperature?: number;    // Default: 0.7 (0.0-1.0)
  topP?: number;          // Default: 0.9
  topK?: number;          // Default: 40
  stopSequences?: string[];
}

const result = await lm.complete({
  messages: [
    { role: 'system', content: 'You are a VC analyst.' },
    { role: 'user', content: 'Analyze this founder...' }
  ],
  options: {
    maxTokens: 400,
    temperature: 0.4
  },
  onToken: (token: string) => {
    // Streaming callback
    console.log(token);
  }
});

// Result
interface CompleteResult {
  success: boolean;
  response: string;
  timeToFirstTokenMs: number;
  totalTimeMs: number;
  tokensPerSecond: number;
  functionCalls?: Array<{
    name: string;
    arguments: Record<string, any>;
  }>;
}
```

#### embed()
```typescript
const result = await lm.embed({ text: 'Sample text' });
// result.embedding: number[]  (vector representation)
```

#### stop()
```typescript
await lm.stop();  // Stop current generation
```

#### reset()
```typescript
await lm.reset();  // Clear context window
```

#### destroy()
```typescript
await lm.destroy();  // Release model from memory
```

#### getModels()
```typescript
const models = await lm.getModels();
// Returns list of available models
```

### Tool Calling (Function Calling)

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
    }>;
    required: string[];
  };
}

const tools: Tool[] = [{
  name: 'search_company',
  description: 'Search for a company by name',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Company name' }
    },
    required: ['name']
  }
}];

const result = await lm.complete({
  messages: [...],
  tools
});

// If model calls a tool:
if (result.functionCalls?.length) {
  const call = result.functionCalls[0];
  // call.name: 'search_company'
  // call.arguments: { name: 'Stripe' }
}
```

---

## Integration Patterns

### Pattern 1: Memory-Augmented AI Agent

```typescript
// AgentContext.tsx
interface UserMemory {
  likedIndustries: string[];      // Derived from liked entities
  dislikedIndustries: string[];
  savedSearchNames: string[];
  mostViewedSearchId?: number;    // Track engagement
  interactionCount: number;
}

function buildSystemPrompt(memory: UserMemory): string {
  const parts = [
    'You are a VC analyst assistant.',
    memory.likedIndustries.length > 0 
      ? `User prefers: ${memory.likedIndustries.join(', ')}.`
      : '',
    memory.dislikedIndustries.length > 0
      ? `User avoids: ${memory.dislikedIndustries.join(', ')}.`
      : '',
    memory.savedSearchNames.length > 0
      ? `User tracks: ${memory.savedSearchNames.join(', ')}.`
      : ''
  ];
  return parts.filter(Boolean).join(' ');
}
```

### Pattern 2: Real-time Signal Processing

```typescript
// Fetch latest signals for AI context
async function getSignalContext(token: string): Promise<string> {
  const [talent, investors] = await Promise.all([
    fetchTalentSignals(token, { limit: 5 }),
    fetchInvestorSignals(token, { limit: 5 })
  ]);
  
  return `
    Recent Talent Moves: ${talent.map(t => `${t.person_name} left ${t.from_company.name}`).join('; ')}
    Investor Activity: ${investors.map(i => `${i.investor.name} interested in ${i.target_company.name}`).join('; ')}
  `;
}
```

### Pattern 3: Bulk Actions via AI Commands

```typescript
// User says: "Like all Series A fintech founders"
async function executeBulkAction(
  token: string,
  action: 'like' | 'dislike',
  filters: FilterOptions
) {
  // 1. Fetch matching entities
  const { items } = await fetchPeople(token, { 
    limit: 100, 
    offset: 0,
    filters 
  });
  
  // 2. Apply action to all
  const actionFn = action === 'like' ? likePerson : dislikePerson;
  await Promise.all(items.map(p => actionFn(token, p.id)));
  
  return `Applied ${action} to ${items.length} people.`;
}
```

---

## Filter Reference

### People Filters

```typescript
interface FilterOptions {
  // Seniority
  seniority?: string[];  
  // Options: "C-Level", "VP", "Director", "Manager", "Entry"
  
  // Experience
  yearsOfExperience?: { min?: number; max?: number };
  department?: string[];
  // Options: "Engineering", "Product", "Sales", "Marketing", "Operations"
  hasCurrentPosition?: boolean;
  
  // Company Context
  companyIndustries?: string[];
  companySize?: string[];
  // Options: "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"
  companyGrowthStage?: string[];
  // Options: "pre_seed", "seed", "series_a", "series_b", "series_c", "growth", "public"
  
  // Education
  educationLevel?: string[];
  fieldOfStudy?: string[];
  
  // Highlights
  highlights?: string[];
  // Options: "UNICORN_FOUNDER", "SERIAL_FOUNDER", "YC_ALUMNI", "VC_BACKED", "EXIT_FOUNDER"
  
  // Social
  hasLinkedIn?: boolean;
  hasTwitter?: boolean;
  hasGitHub?: boolean;
  
  // Location
  location?: string[];
}
```

### Status Filters

```typescript
interface StatusFilters {
  myStatus?: 'viewed' | 'not_viewed' | 'liked' | 'disliked' | null;
  teamViewed?: boolean;
  teamLiked?: boolean;
}
```

---

## Error Handling

### Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 401 | Unauthorized | Re-authenticate |
| 403 | Forbidden | Check API key/permissions |
| 404 | Not Found | Entity doesn't exist |
| 429 | Rate Limited | Implement backoff |
| 500 | Server Error | Retry with backoff |

### Recommended Error Handling

```typescript
try {
  const data = await fetchPeople(token, params);
} catch (error) {
  if (error instanceof AuthError) {
    // Clear token, redirect to sign-in
    await signOut();
  } else if (error.message.includes('timed out')) {
    // Retry with exponential backoff
  } else {
    // Log and show user-friendly error
  }
}
```

---

## Quick Implementation Checklist

### For AI Agent with Memory:
- [x] Create `AgentContext` to track likes/dislikes
- [x] Implement `fetchSavedSearches()` in specter.ts
- [x] Build dynamic system prompt from user signals
- [x] Inject context into all Cactus LLM calls

### For Dashboard:
- [x] Fetch saved searches on mount
- [x] Create horizontal scroll for search pills
- [x] Implement smart feed with AI prioritization
- [ ] Add signal stream section

### For Enhanced API Integration:
- [x] Add talent signal endpoints
- [x] Add investor interest endpoints
- [x] Implement enrichment endpoints
- [ ] Add bulk action support

### For Multi-Modal Input:
- [x] Create `InputManager` for centralized input handling
- [x] Implement voice recording with `expo-av`
- [x] Add intent detection for voice commands
- [x] Track platform interactions (likes, views, time spent)
- [x] Build `AICommandBar` component
- [x] Build `VoiceInputButton` component

---

## Multi-Modal Input System

### InputManager (`src/ai/inputManager.ts`)

Centralized handler for all user inputs that feeds into the Cactus LLM.

#### Input Sources

| Source | Description | Auto-tracked |
|--------|-------------|--------------|
| `voice` | Speech-to-text transcripts | No |
| `text` | Direct text input | No |
| `like` | Like action on entity | Yes |
| `dislike` | Dislike/pass action | Yes |
| `view` | Profile view start | Yes |
| `time_spent` | Duration on profile | Yes |
| `scroll` | Scroll depth on profile | Yes |
| `search` | Search query | Yes |
| `filter_change` | Filter modifications | Yes |
| `list_action` | Add/remove from list | Yes |

#### Usage

```typescript
import { inputManager } from '../ai/inputManager';

// Start session (call on app launch)
await inputManager.startSession();

// Record text input
await inputManager.addTextInput('Find fintech founders in London');

// Record voice (after recording)
const command = await inputManager.stopVoiceRecording();
// command.intent contains parsed intent

// Record interactions (automatic via hooks)
await inputManager.recordLike(person);
await inputManager.recordView(personId, 'person', personName);
await inputManager.recordViewEnd(personId); // Calculates time spent

// Build context for LLM
const context = inputManager.buildContextForLLM();
// Returns formatted string of recent activity

// Get interaction patterns
const patterns = inputManager.getInteractionPatterns();
// { preferredIndustries, avoidedIndustries, averageViewTime, engagementScore }
```

#### Voice Command Intents

The system parses voice input into structured intents:

```typescript
type CommandIntent = 
  | { type: 'search'; query: string }
  | { type: 'filter'; filters: Record<string, any> }
  | { type: 'action'; action: 'like' | 'dislike' | 'save' | 'skip' }
  | { type: 'question'; question: string }
  | { type: 'navigate'; destination: string }
  | { type: 'bulk_action'; action: string; criteria: string }
  | { type: 'unknown'; raw: string };
```

#### Example Voice Commands

| Voice Input | Detected Intent |
|-------------|-----------------|
| "Search for fintech founders" | `{ type: 'search', query: 'fintech founders' }` |
| "Like this person" | `{ type: 'action', action: 'like' }` |
| "Show me Series A companies" | `{ type: 'filter', filters: { raw: 'series a companies' } }` |
| "What are the risks?" | `{ type: 'question', question: 'What are the risks?' }` |
| "Like all YC founders" | `{ type: 'bulk_action', action: 'like', criteria: 'yc founders' }` |

### AICommandBar Component

Unified input bar with text, voice, and quick actions.

```tsx
import AICommandBar from '../components/AICommandBar';

<AICommandBar
  person={person}                    // Optional: current person context
  onResponse={(text) => {}}          // AI response callback
  onCommand={(intent) => {}}         // Voice command callback
  placeholder="Ask anything..."
  showQuickActions={true}            // Show quick action chips
  collapsed={false}                  // Start expanded
/>
```

### VoiceInputButton Component

Standalone push-to-talk voice input.

```tsx
import VoiceInputButton from '../components/VoiceInputButton';

<VoiceInputButton
  size="medium"                      // 'small' | 'medium' | 'large'
  onCommand={(command) => {}}        // VoiceCommand callback
  onTranscript={(text) => {}}        // Raw transcript callback
/>
```

---

*Last Updated: November 2024*
*API Version: v1*
*Cactus SDK: cactus-react-native@latest*

