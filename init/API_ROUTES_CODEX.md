# Specter Mobile V1 - Complete API Routes Reference for Codex

> **PURPOSE**: Exhaustive technical context for Codex to understand, implement, and extend API routes.

---

## Architecture Overview

Specter Mobile uses **two backend APIs**:

| API | Base URL | Purpose | Auth Headers |
|-----|----------|---------|--------------|
| **Railway (Private)** | `https://specter-api-prod.up.railway.app` | Data enrichment, People/Company browse, Quick Search | `Authorization: Bearer <JWT>` + `x-api-key: <API_KEY>` |
| **App API** | `https://app.tryspecter.com/api` | Signals feeds, Lists, Entity status, User context | `Authorization: Bearer <JWT>` |

### Proxy Routing (Web Dev)
- `/proxy/railway/*` → Railway API
- `/proxy/app/*` → App API

---

## Authentication Requirements

```typescript
// Railway API - REQUIRES BOTH:
headers.set("Authorization", `Bearer ${jwtToken}`);
headers.set("x-api-key", apiKey);

// App API - REQUIRES ONLY JWT:
headers.set("Authorization", `Bearer ${jwtToken}`);

// Optional for both:
headers.set("x-user-id", userId);
```

---

## Railway Private API Routes

All require **JWT + API Key**. Prefix: `/private/`

### People Routes

| Method | Path | Purpose | Request | Response |
|--------|------|---------|---------|----------|
| POST | `/private/people` | Browse people | `{limit, offset, search?, filters?}` | `{page, items: Person[]}` |
| GET | `/private/people/{id}` | Get person by ID | - | `Person` |
| POST | `/private/people/count` | Get count | `{search?}` | `{count: number}` |
| POST | `/private/people/export` | Export people | `{limit}` | `Array<FlatObject>` |

### Company Routes

| Method | Path | Purpose | Response |
|--------|------|---------|----------|
| GET | `/private/companies/{id}/people` | Company team | `[{specter_person_id, full_name, title, is_founder, departments, seniority}]` |
| GET | `/private/companies/{id}/department-sizes` | Dept sizes | `{Engineering: 3, Sales: 5, ...}` |

### Quick Search Routes

| Method | Path | Purpose | Response |
|--------|------|---------|----------|
| GET | `/private/quick-search/history` | Search history | `[{id, name, domain, logo_url, entityStatus}]` |
| GET | `/private/quick-search/company?term=X` | Search companies | `Company[]` |
| GET | `/private/quick-search/people?term=X` | Search people | `Person[]` |
| GET | `/private/quick-search/counts?term=X` | Search counts | `{companies, people, investors}` |

### Connection Routes

| Method | Path | Purpose | Request | Response |
|--------|------|---------|---------|----------|
| POST | `/private/users/people-connections` | People connections | `{people_ids[], user_id}` | `[{person_id, connections[]}]` |
| POST | `/private/users/company-connections` | Company connections | `{company_ids[], user_id}` | `[{company_id, connections[]}]` |

---

## App API Routes

Only JWT required (no API key).

### Signals Routes

| Method | Path | Purpose | Request |
|--------|------|---------|---------|
| POST | `/signals/company` | Company signals | `{page, limit, search?, industry?, location?}` |
| POST | `/signals/people` | People signals | `{page, limit, search?, seniority?, location?}` |
| POST | `/signals/talent` | Talent signals | Same as people |
| POST | `/signals/investors` | Investor signals | `{page, limit, search?}` |
| POST | `/signals/revenue` | Revenue signals | `{page, limit, search?}` |
| POST | `/signals/strategic` | Strategic signals | Same as people |
| POST | `/signals/funding-rounds` | Funding signals | `{page, limit}` |
| POST | `/signals/acquisition` | Acquisition signals | `{page, limit}` |
| POST | `/signals/ipo` | IPO signals | `{page, limit}` |

All have corresponding `/count` and `/filters` endpoints.

### Entity Status

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/entity-status/{type}/{id}` | Update status |

Types: `people`, `company`, `investors`
Body: `{status: "liked" | "disliked" | "viewed"}`

### Lists & User

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/lists` | Get all lists |
| GET | `/lists/people/{listId}/results` | List results |
| GET | `/user/recent/company` | Recent companies |
| GET | `/user/recent/people` | Recent people |
| GET | `/notifications` | Notifications |
| GET | `/network/status` | Network status |
| GET | `/integrations` | Integrations |
| GET | `/integrations/token` | Integration token |

---

## Implementation Status

### ✅ Implemented Routes

**Railway:**
- Browse People, Person by ID, People Count
- Company Team
- Quick Search (History, Companies, People, Counts)
- Health Check

**App:**
- All Signals (Company, People, Talent, Investors, Revenue, Strategic, Funding, Acquisition, IPO)
- Entity Status
- Lists
- Recent Companies/People
- Notifications, Network Status, Integrations

### ❌ NOT YET IMPLEMENTED (Opportunities)

1. **People Connections** (`POST /private/users/people-connections`)
2. **Company Connections** (`POST /private/users/company-connections`)  
3. **Department Sizes** (`GET /private/companies/{id}/department-sizes`)
4. **People Export** (full implementation)

---

## Route Implementation Guide

### Adding New Route

```typescript
// In src/api/public-client/client.ts

companies = {
  async getDepartmentSizes(companyId: string, authToken: string): Promise<Record<string, number>> {
    return apiRequest<Record<string, number>>(
      `/private/companies/${companyId}/department-sizes`,
      { method: "GET" },
      authToken,
      'railway'  // API type: 'railway' or 'app'
    );
  },
};
```

### Fallback Pattern (Railway → App)

```typescript
async getSomeData(authToken: string): Promise<SomeData> {
  try {
    return await apiRequest<SomeData>('/private/endpoint', { method: "GET" }, authToken, 'railway');
  } catch (error) {
    if (error instanceof SpecterAPIError && error.statusCode === 404) {
      return await apiRequest<SomeData>('/app-endpoint', { method: "GET" }, authToken, 'app');
    }
    throw error;
  }
}
```

---

## TypeScript Types

```typescript
export type EntityStatus = "viewed" | "liked" | "disliked" | null;

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  linkedin_url: string;
  profile_image_url: string | null;
  tagline: string | null;
  location: string | null;
  region: string | null;
  seniority: string | null;
  years_of_experience: number | null;
  experience: Experience[];
  entityStatus?: { status: EntityStatus; updated_at: string };
}

export interface Company {
  id: string;
  name: string;
  domain: string;
  logoUrl: string | null;
  industry: string[];
  hqRegion: string | null;
  descriptionShort: string | null;
  foundedYear: number | null;
  growthStage: string | null;
  totalFundingAmount: number | null;
  highlights: string[];
  entityStatus?: { status: EntityStatus; updated_at: string };
}

export interface Investor {
  id: string;
  name: string;
  domain: string;
  logoUrl: string | null;
  HQRegion: string | null;
  rank: number;
  types: string[];
  nInvestments: number;
  nLeadInvestments: number;
  nExits: number;
  InvestorHighlights: Array<{ highlight: string; isNew: boolean }>;
}

export interface PaginatedResponse<T> {
  page: number;
  items: T[];
  total?: number;
}
```

---

## Priority Rules for Codex

1. **Use Railway API** for: People browsing, Quick search, Company team, Data enrichment
2. **Use App API** for: Signals feeds, Entity status, Lists, User context
3. **Always include proper auth headers** based on API type
4. **Test on native** (iOS/Android) to avoid CORS issues
5. **Use `apiRequest` helper** for consistent error handling
