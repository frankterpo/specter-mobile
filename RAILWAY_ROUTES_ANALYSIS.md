# Railway API Routes Analysis

## Summary
Comprehensive analysis of Railway API routes based on log analysis and direct testing.

## Routes Tested

### ❌ Not Implemented (404)
- `GET /private/users/entity-status` - 404
- `POST /private/users/entity-status` - 404  
- `GET /private/users` - 404
- `GET /private/users/me` - 404
- `GET /private/users/profile` - 404
- `GET /private/users/settings` - 404
- `GET /private/users/recent` - 404
- `GET /private/users/recent/people` - 404
- `GET /private/users/recent/companies` - 404
- `GET /private/users/favorites` - 404
- `GET /private/users/notifications` - 404
- `GET /private/users/activity` - 404
- `GET /private/lists` - 404
- `POST /private/lists` - 404
- `GET /private/searches` - 404
- `POST /private/searches` - 404
- `GET /private/saved-searches` - 404
- `POST /private/saved-searches` - 404
- `GET /private/people/saved-searches` - 404

**Note:** `entity_status` appears in timing logs as an internal function call (part of `quick_search_history`), but there's no direct endpoint for it.

### ✅ Working Routes (Already in API Tester)

#### Public
- `GET /health` - Health check
- `GET /docs` - API documentation

#### People
- `POST /private/people` - Browse people with filters
- `POST /private/people/count` - Get people count
- `POST /private/people/export` - Export people data
- `GET /private/people/{id}` - Get person by ID

#### Companies
- `GET /private/companies/{id}/people` - Get company team
- `GET /private/companies/{id}/people?founders=false` - Get company team (non-founders)
- `GET /private/companies/{id}/department-sizes` - Get department sizes

#### Quick Search
- `GET /private/quick-search/history` - Get search history
- `GET /private/quick-search/company?term={term}` - Search companies
- `GET /private/quick-search/counts?term={term}` - Get search counts

#### User Connections
- `POST /private/users/people-connections` - Get people connections
  - **Body:** `{ people_ids: string[], user_id: string }`
  - **Dynamic:** Uses `user_id` from token and `people_ids` from collected API responses
- `POST /private/users/company-connections` - Get company connections
  - **Body:** `{ company_ids: string[], user_id: string }`
  - **Dynamic:** Uses `user_id` from token and `company_ids` from collected API responses

#### Settings
- `POST /private/settings/languages` - Get languages
- `POST /private/settings/people` - Get people settings
- `POST /private/settings/universities` - Get universities

## Route Dynamics

### Connections Endpoints Pattern
Both `/private/users/people-connections` and `/private/users/company-connections` follow the same pattern:

1. **Require `user_id`** - Extracted from JWT token (`sub` claim)
2. **Require ID arrays** - `people_ids` or `company_ids` arrays
3. **Dynamic in mobile** - IDs come from:
   - Previous API responses (e.g., `POST /private/people` returns person IDs)
   - User selections in the UI
   - Search results

### ID Extraction Patterns
From log analysis, IDs can be extracted from:
- `id` field (e.g., `per_3a3e24bebf3b58133caf138f`)
- `SpecterPersonID` field
- `person_id` field
- `company_id` field

## Implementation Notes

### Current API Tester Implementation
- ✅ Automatically extracts `user_id` from JWT token
- ✅ Collects `people_ids` from people-related API responses
- ✅ Collects `company_ids` from company-related API responses  
- ✅ Dynamically populates connections endpoints with collected IDs
- ✅ Shows clear messages for empty results (not errors)

### Mobile App Considerations
1. **User ID**: Extract from Clerk JWT token (`sub` claim)
2. **People IDs**: Collect from:
   - `POST /private/people` responses
   - `GET /private/quick-search/company` (if people are included)
   - User selections
3. **Company IDs**: Collect from:
   - `GET /private/quick-search/company` responses
   - `GET /private/companies/{id}/people` (parent company)
   - User selections

## Total Working Endpoints: 19

All working endpoints are currently in the API Tester at `http://localhost:3335`
