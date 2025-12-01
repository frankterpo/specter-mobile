# Railway API Endpoints - Staging Environment

## Base URLs

- **Railway API**: `https://specter-api-staging.up.railway.app`
- **Entity Status API**: `https://app.staging.tryspecter.com/api/entity-status`
- **Lists API**: `https://app.staging.tryspecter.com/api/lists`

## Authentication

All endpoints require Bearer token authentication:
```
Authorization: Bearer <clerk_token>
Content-Type: application/json
```

---

## People Endpoints

### 1. Create Query
**POST** `/private/queries`

Create a query with filters and get a `query_id` for subsequent pagination.

**Request Body:**
```json
{
  "type": "people",
  "filters": {
    "SeniorityLevel": ["OR", ["senior", "lead"]],
    "Department": ["Current", ["OR", ["Engineering", "Product"]]],
    "Location": ["OR", ["San Francisco", "New York"]],
    "MyEntityStatus": "not_viewed",
    "TeamViewed": true,
    "TeamLiked": true
  }
}
```

**Response:**
```json
{
  "query_id": "abc123",
  "total": 1500
}
```

**Implementation:** `src/api/specter.ts:240-307`

---

### 2. Fetch People (Query-based)
**GET** `/private/queries/:queryId/people?limit=50&offset=0`

Fetch people from an existing query. Recommended approach for pagination.

**Query Parameters:**
- `limit` (number): Number of items to return (default: 50)
- `offset` (number): Pagination offset (default: 0)

**Response:**
```json
{
  "items": [...],
  "total": 1500,
  "has_more": true
}
```

**Implementation:** `src/api/specter.ts:321-368`

---

### 3. Fetch People (Direct)
**POST** `/private/people`

Direct fetch with filters (legacy mode). Still supported but query-based approach is recommended.

**Request Body:**
```json
{
  "limit": 50,
  "offset": 0,
  "filters": {
    "SeniorityLevel": ["OR", ["senior", "lead"]],
    "Department": ["Current", ["OR", ["Engineering"]]],
    "MyEntityStatus": "not_viewed"
  }
}
```

**Response:**
```json
{
  "items": [...],
  "total": 1500,
  "has_more": true,
  "query_id": "abc123"
}
```

**Implementation:** `src/api/specter.ts:370-472`

---

### 4. Get Person Details
**GET** `/private/people/:id`

Fetch detailed information about a specific person.

**Response:**
```json
{
  "id": "person_123",
  "first_name": "John",
  "last_name": "Doe",
  "full_name": "John Doe",
  "profile_image_url": "https://...",
  "tagline": "Senior Engineer",
  "location": "San Francisco, CA",
  "seniority": "senior",
  "years_of_experience": 8,
  "experience": [...],
  "entity_status": {
    "status": "liked",
    "updated_at": "2024-01-15T10:30:00Z",
    "viewed_by_team": true,
    "liked_by_team": false
  }
}
```

**Implementation:** `src/api/specter.ts:477-516`

---

## Company Endpoints

### 5. Fetch Companies
**POST** `/private/companies`

Fetch companies list with optional filters.

**Request Body:**
```json
{
  "limit": 20,
  "offset": 0,
  "filters": {
    "CompanyIndustries": ["Current", ["OR", ["Technology", "SaaS"]]],
    "CompanySize": ["Current", ["OR", ["51-200", "201-500"]]]
  }
}
```

**Response:**
```json
{
  "items": [...],
  "total": 500,
  "has_more": true
}
```

**Implementation:** `src/api/specter.ts:1131-1184`

---

### 6. Get Company Details
**GET** `/private/companies/:id`

Fetch detailed information about a specific company.

**Response:**
```json
{
  "id": "company_123",
  "name": "Acme Corp",
  "description": "...",
  "logo_url": "https://...",
  "industries": ["Technology", "SaaS"],
  "employee_count": 150,
  "funding": {
    "total_funding_usd": 50000000,
    "last_funding_date": "2023-06-01"
  },
  ...
}
```

**Implementation:** `src/api/specter.ts:1189-1230`

---

### 7. Search Companies
**GET** `/private/companies/search?name=acme&limit=10`

Search companies by name.

**Query Parameters:**
- `name` (string, required): Search query
- `limit` (number, optional): Max results to return

**Response:**
```json
{
  "items": [...]
}
```

**Implementation:** `src/api/specter.ts:1235-1280`

---

## Entity Status Endpoints

*Note: These endpoints are on the staging domain, not Railway directly*

### 8. Update Person Status
**POST** `/api/entity-status/people/:personId`

Update the status of a person (liked/disliked/viewed). **Replaces** any previous status.

**Request Body:**
```json
{
  "status": "liked"  // or "disliked" or "viewed"
}
```

**Response:** `200 OK` or `201 Created` or `204 No Content`

**Implementation:** 
- Like: `src/api/specter.ts:521-582`
- Dislike: `src/api/specter.ts:587-648`
- Viewed: `src/api/specter.ts:653-714`

---

### 9. Get Team Status
**GET** `/api/entity-status/people/:personId/team`

Get team activity for a person (who has viewed/liked/disliked).

**Response:**
```json
{
  "viewed_by": ["user_1", "user_2"],
  "liked_by": ["user_1"],
  "disliked_by": []
}
```

**Implementation:** `src/api/specter.ts:719-767`

---

### 10. Update Company Status
**POST** `/api/entity-status/companies/:companyId`

Update the status of a company (liked/disliked).

**Request Body:**
```json
{
  "status": "liked"  // or "disliked"
}
```

**Implementation:**
- Like: `src/api/specter.ts:1285-1322`
- Dislike: `src/api/specter.ts:1327-1364`

---

## Lists Endpoints

*Note: These endpoints are on the staging domain, not Railway directly*

### 11. Fetch All Lists
**GET** `/api/lists`

Get all lists for the current user.

**Response:**
```json
{
  "lists": [
    {
      "id": "list_123",
      "name": "Engineering Leads",
      "description": "...",
      "person_count": 25,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Implementation:** `src/api/specter.ts:957-991`

---

### 12. Get Person Lists
**GET** `/api/lists/people/:personId`

Get all lists that a person belongs to.

**Response:**
```json
{
  "list_ids": ["list_123", "list_456"]
}
```

**Implementation:** `src/api/specter.ts:996-1033`

---

### 13. Add Person to List
**POST** `/api/lists/:listId/people`

Add a person to a list.

**Request Body:**
```json
{
  "person_id": "person_123"
}
```

**Response:** `200 OK` or `201 Created`

**Implementation:** `src/api/specter.ts:1038-1078`

---

### 14. Remove Person from List
**DELETE** `/api/lists/:listId/people/:personId`

Remove a person from a list.

**Response:** `200 OK` or `204 No Content`

**Implementation:** `src/api/specter.ts:1083-1122`

---

## Filter Format Reference

The backend expects filters in a specific format:

```typescript
{
  // Status filters
  "MyEntityStatus": "viewed" | "not_viewed" | "liked" | "disliked" | null,
  "TeamViewed": true,
  "TeamLiked": true,

  // People filters
  "SeniorityLevel": ["OR", ["senior", "lead", "principal"]],
  "Department": ["Current", ["OR", ["Engineering", "Product"]]],
  "Location": ["OR", ["San Francisco", "New York"]],
  "EducationLevel": ["OR", ["Bachelor's", "Master's"]],
  "FieldOfStudy": ["OR", ["Computer Science", "Engineering"]],
  "Highlights": ["OR", ["unicorn_founder", "yc_alumni"]],
  "HasLinkedIn": true,
  "HasTwitter": true,
  "HasGitHub": true,
  "HasCurrentPosition": true,
  "MinYearsOfExperience": 5,
  "MaxYearsOfExperience": 15,

  // Company filters
  "CompanyIndustries": ["Current", ["OR", ["Technology", "SaaS"]]],
  "CompanySize": ["Current", ["OR", ["51-200", "201-500"]]],
  "CompanyGrowthStage": ["Current", ["OR", ["Series A", "Series B"]]]
}
```

**Filter Mapping Implementation:** `src/api/specter.ts:144-234`

---

## Error Handling

All endpoints return standard HTTP status codes:
- `200 OK` - Success
- `201 Created` - Resource created
- `204 No Content` - Success, no content
- `400 Bad Request` - Invalid request
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

**AuthError Implementation:** `src/api/specter.ts:117-122`

---

## Timeout Configuration

- **API Timeout**: 15 seconds (`API_TIMEOUT_MS`)
- **Auth Timeout**: 3 seconds (`AUTH_TIMEOUT_MS`)

**Timeout Implementation:** `src/api/specter.ts:127-138`

---

## Notes

1. **Query-based approach** is recommended for better performance and consistent pagination
2. **Status updates** (like/dislike/viewed) are **mutually exclusive** - setting a new status replaces the previous one
3. **Entity Status** and **Lists** endpoints are hosted on `app.staging.tryspecter.com`, not Railway
4. All endpoints support CORS and use Bearer token authentication
5. Filter format uses nested arrays for OR logic: `["OR", ["value1", "value2"]]`
6. Time-based filters use `["Current", ...]` wrapper for current position filters

