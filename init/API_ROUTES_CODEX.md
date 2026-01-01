# Specter Backend API Routes for Codex Agent

> **Source**: `specter-dev/pipeliner` repository  
> **Path**: `backend/api/src/api/routers/`  
> **Last Updated**: January 2026

This document provides comprehensive API route definitions for the Codex agent to extend the Specter Mobile app functionality. Routes are organized by service type: **Private (Railway)** for internal/premium features and **API v1 (Public)** for standard API access.

---

## Architecture Overview

```
backend/api/src/api/routers/
├── api/                          # Public API routes (api.tryspecter.com)
│   ├── v1/
│   │   ├── companies/            # Company-related endpoints
│   │   ├── entities/             # Entity search & management
│   │   ├── investor_interest/    # Investor interest signals
│   │   └── people/               # People search & data
│   └── __init__.py
├── private/                      # Private/Railway routes (internal service)
│   ├── companies/                # Company data & enrichment
│   │   └── enrichment/           # Company enrichment endpoints
│   ├── people/                   # People data & emails
│   ├── settings/                 # User settings
│   ├── strat_intel/              # Strategic intelligence signals
│   ├── users/                    # User management
│   ├── auth.py                   # Authentication endpoints
│   ├── queries.py                # Query endpoints (commented out)
│   └── quick_search.py           # Quick search functionality
└── __init__.py
```

---

## PRIVATE ROUTES (Railway Service)

**Base URL**: Internal Railway service (proxied via `server.js` or direct Railway URL)  
**Authentication**: Bearer JWT token + `x-api-key` header

### 1. Authentication Router (`/auth`)

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| GET | `/auth` | `authenticate_user` | Authenticate user and return their information |

**Response Model**: User information object

---

### 2. Companies Router (`/companies`)

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| GET | `/{company_id}/department-sizes` | `get_company_dept_sizes` | Get company size breakdown by departments |
| GET | `/{company_id}/people` | `get_company_people` | Get people associated with a company |
| POST | `/` | `get_company_info` | Get company info with body filters |

#### GET `/{company_id}/department-sizes`

**Parameters**:
- `company_id` (path, required): Company ID to get department sizes for

**Response**: `Dict[str, int]` - Dictionary with department names as keys and employee counts as values

**Example Response**:
```json
{
  "Engineering": 45,
  "Sales": 23,
  "Marketing": 12,
  "Operations": 8
}
```

#### GET `/{company_id}/people`

**Parameters**:
- `company_id` (path, required): Company ID
- `department` (query, optional): Filter by department name
- `founders` (query, optional): `true` = only founders, `false` = only non-founders
- `ceo` (query, optional): Filter to include/exclude CEOs
- `page` (query, default=0): Page number
- `limit` (query, default=25): Results per page

**Response**: `List[BasicPerson]`

#### POST `/`

**Body**: `CompanyBodyFilters`
```json
{
  "company_ids": ["id1", "id2"],
  "filters": {
    "industry": "Technology",
    "size_min": 50,
    "size_max": 500
  }
}
```

**Response**: `List[Company]`

---

### 3. People Router (`/people`)

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| GET | `/{person_id}` | `get_person_by_id` | Get detailed person information |
| GET | `/{person_id}/export` | `export_person_by_id` | Export person data (CSV/JSON) |
| GET | `/{person_id}/emails` | `get_person_emails` | Get person's email addresses |

#### GET `/{person_id}`

**Parameters**:
- `person_id` (path, required): Person ID

**Response**: Full person object with employment history, education, social links

#### GET `/{person_id}/emails`

**Parameters**:
- `person_id` (path, required): Person ID

**Response**: List of verified email addresses

---

### 4. Quick Search Router (`/quick-search`)

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| GET | `/info-with-none` | `info_with_none` | Quick search with null handling |
| GET | `/` | `quick_search` | Universal quick search across entities |

**Search Types Supported**:
- Companies (by name, domain, ID)
- People (by name, email, LinkedIn)
- Investors (by name, fund)

**Query Parameters**:
- `q` (required): Search query string
- `type` (optional): Entity type filter (`company`, `person`, `investor`)
- `limit` (optional, default=10): Max results
- `product` (optional): Specter product context

**Response**: `QuickSearchCounts` with categorized results

---

### 5. Strategic Intelligence Router (`/strat-intel`)

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| POST | `/` | `api_get_strat_intel` | Get strategic intelligence signals |

**Body**: Strategic signal filter object
```json
{
  "signal_types": ["funding", "acquisition", "ipo"],
  "date_range": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "industries": ["Technology", "Healthcare"],
  "regions": ["US", "EU"],
  "limit": 50,
  "offset": 0
}
```

**Response Fields** (per signal):
- `signal_id`: Unique signal identifier
- `signal_type`: Type of signal (funding, acquisition, etc.)
- `signal_type_2`: Secondary classification
- `hq_region`: Company headquarters region
- `logos`: Company logos
- `week_batch`: Weekly batch identifier
- `linkedin_url`: LinkedIn URL if available
- `twitter_url`: Twitter URL if available
- `industry_og`: Original industry classification
- `growth_stage`: Company growth stage
- `customer_ids`: Related customer IDs
- `number_of_sources`: Source count for signal
- `company_domain`: Company website domain
- `sources`: List of source details
- `entity_id`: Related entity ID

---

### 6. Users Router (`/users`)

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| GET | `/me` | `get_current_user` | Get current authenticated user |
| PUT | `/me` | `update_current_user` | Update user profile |

---

### 7. Settings Router (`/settings`)

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| GET | `/` | `get_settings` | Get user settings |
| PUT | `/` | `update_settings` | Update user settings |

---

## API V1 ROUTES (Public API)

**Base URL**: `https://api.tryspecter.com/api/v1/` or `https://app.tryspecter.com/api/v1/`  
**Authentication**: Bearer JWT token + `x-api-key` header

### 1. Companies Router (`/api/v1/companies`)

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| POST | `/` | `get_languages` | Get company languages with filters |

**Body**: `IdTermFilter`
```json
{
  "company_ids": ["id1", "id2"],
  "language_filter": "en"
}
```

---

### 2. Entities Router (`/api/v1/entities`)

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| POST | `/text-search` | `entities_text_search` | Search entities by text |

**Body**:
```json
{
  "text": "search query",
  "entity_types": ["company", "person"],
  "limit": 20
}
```

---

### 3. Investor Interest Router (`/api/v1/investor-interest`)

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| GET | `/{signal_id}` | `get_signal_by_id` | Get specific investor interest signal |
| GET | `/` | `get_signals` | List investor interest signals |

#### GET `/{signal_id}`

**Parameters**:
- `signal_id` (path, required): Signal ID

**Response**: Single signal object with full details

#### GET `/`

**Query Parameters**:
- `list_id` (optional): Filter by list ID
- `search_id` (optional): Filter by search ID
- `limit` (optional): Max results
- `offset` (optional): Pagination offset

---

### 4. People Router (`/api/v1/people`)

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| POST | `/by-email` | `search_by_email` | Search people by email address |

**Body**:
```json
{
  "email": "person@example.com",
  "score": 0.8
}
```

**Response**: Matching person records with confidence scores

---

## Mobile Implementation Strategy

### Priority 1: Use Existing Working Routes

The mobile app already has working implementations for:
- `/api/v1/railway/signals/*` - All signal types (funding, acquisition, IPO, etc.)
- `/api/v1/railway/company/*` - Company search and details
- `/api/v1/railway/conn/*` - Connections and relationships
- `/api/v1/app/*` - App-specific endpoints (lists, recent entities)

**Recommendation**: Continue using these routes as primary data source.

### Priority 2: Enrich with Private Routes

Add these private routes to enhance the mobile experience:

1. **Quick Search** (`/quick-search`)
   - Unified search across all entity types
   - Fast typeahead results
   - Perfect for global search bar

2. **Company People** (`/companies/{id}/people`)
   - Show team members on company detail pages
   - Filter by role (CEO, founders, department)

3. **Person Emails** (`/people/{id}/emails`)
   - Contact information for leads
   - Premium feature for paid users

4. **Strategic Intelligence** (`/strat-intel`)
   - Curated signals feed
   - Weekly batched updates
   - Multi-source validation

### Priority 3: Fallback Strategy

If private routes fail (Railway service unavailable):

```typescript
async function fetchWithFallback<T>(
  privateEndpoint: string,
  publicEndpoint: string,
  options: RequestInit
): Promise<T> {
  try {
    // Try private route first (faster, more data)
    return await fetchPrivate<T>(privateEndpoint, options);
  } catch (error) {
    console.warn(`Private route failed, falling back to public: ${error}`);
    // Fallback to public API
    return await fetchPublic<T>(publicEndpoint, options);
  }
}
```

---

## Authentication Headers

All routes require these headers:

```typescript
const headers = {
  'Authorization': `Bearer ${jwtToken}`,
  'x-api-key': apiKey,
  'Content-Type': 'application/json',
  'x-user-id': userId  // Optional, for tracking
};
```

---

## Error Handling

| Status Code | Meaning | Action |
|-------------|---------|--------|
| 401 | Unauthorized | Refresh JWT token |
| 403 | Forbidden | Check API key validity |
| 404 | Not Found | Entity doesn't exist |
| 422 | Validation Error | Check request body/params |
| 429 | Rate Limited | Implement exponential backoff |
| 500 | Server Error | Retry with backoff, then fallback |

---

## Data Models Reference

### BasicPerson
```typescript
interface BasicPerson {
  id: string;
  name: string;
  title?: string;
  company?: string;
  linkedin_url?: string;
  profile_image?: string;
}
```

### Company
```typescript
interface Company {
  id: string;
  specter_id: string;
  name: string;
  domain?: string;
  industry?: string;
  employee_count?: number;
  funding_total?: number;
  hot_companies?: HotCompanyInfo;
}
```

### Signal (Strategic Intelligence)
```typescript
interface StratIntelSignal {
  signal_id: string;
  signal_type: string;
  signal_type_2?: string;
  hq_region?: string;
  logos?: string[];
  week_batch?: string;
  linkedin_url?: string;
  twitter_url?: string;
  industry_og?: string;
  growth_stage?: string;
  customer_ids?: string[];
  number_of_sources: number;
  company_domain?: string;
  sources: SourceInfo[];
  entity_id?: string;
}
```

---

## Next Steps for Codex

1. **Implement Quick Search**: Add `/quick-search` integration for global search
2. **Add Company Team View**: Use `/companies/{id}/people` for team pages
3. **Integrate Strat Intel**: Create a dedicated signals feed using `/strat-intel`
4. **Add Email Lookup**: Implement `/people/{id}/emails` for contact info
5. **Build Fallback System**: Implement robust error handling with public API fallbacks

---

## Testing Endpoints

Use the local proxy server for testing:

```bash
# Start proxy
cd /Users/franciscoterpolilli/Projects/specter-mobile
node server.js

# Test quick search (via proxy)
curl -X GET "http://localhost:3333/proxy/private/quick-search?q=Tesla&limit=5" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "x-api-key: YOUR_API_KEY"

# Test strat intel (via proxy)
curl -X POST "http://localhost:3333/proxy/private/strat-intel" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"signal_types": ["funding"], "limit": 10}'
```
