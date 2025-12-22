# Entity Status Analysis

## Summary
`entity_status` is **critical** for tracking user interactions (like/dislike/view) with people and companies. This analysis reveals how it works in the Railway API.

## ✅ What Works (Reading Entity Status)

### Entity Status is Returned in API Responses

1. **`POST /private/people`** - Returns `entity_status` field for each person
   ```json
   {
     "id": "per_xxx",
     "full_name": "John Doe",
     "entity_status": null,  // or "liked", "disliked", "viewed"
     ...
   }
   ```

2. **`GET /private/quick-search/history`** - Returns `entityStatus` for companies
   ```json
   {
     "id": "company_xxx",
     "name": "Company Name",
     "entityStatus": null,  // or status value
     ...
   }
   ```

3. **`GET /private/companies/{id}/people`** - Team members may include entity status

### Internal Function Calls
- `entity_status` is called internally as part of `quick_search_history` function
- Timing logs show it takes ~30-40ms to fetch entity status
- It's automatically included in responses when fetching people/companies

## ❌ What Doesn't Work (Writing Entity Status)

### Entity Status Update Endpoints Return 404

The mobile app expects these endpoints (from `src/api/specter.ts`):

**Expected:**
- `POST /private/entity-status/people/{personId}` 
  - Body: `{ status: "liked" }` or `{ status: "disliked" }`
- `POST /private/entity-status/companies/{companyId}`
  - Body: `{ status: "liked" }` or `{ status: "disliked" }`

**Reality:**
- All variations return **404 Not Found**
- Tested patterns:
  - `POST /private/entity-status/people/{id}`
  - `POST /private/entity-status/companies/{id}`
  - `PUT /private/entity-status/people/{id}`
  - `PATCH /private/entity-status/people/{id}`

## Current Mobile App Configuration

The codebase (`src/api/specter.ts`) currently uses:
```typescript
const ENTITY_STATUS_BASE_URL_RAW = "https://app.tryspecter.com/api/entity-status";
```

This means:
- **Reading** entity status: ✅ Works via Railway (included in responses)
- **Writing** entity status: ⚠️ Currently uses `app.tryspecter.com` (not Railway)

## Status Values

Based on codebase analysis, expected status values:
- `null` - No interaction
- `"liked"` - User liked the entity
- `"disliked"` - User disliked the entity  
- `"viewed"` - User viewed the entity (possibly)

## Recommendations

### Option 1: Use app.tryspecter.com for Updates (Current)
- Keep reading from Railway
- Keep writing to `app.tryspecter.com/api/entity-status`
- Requires dual API setup

### Option 2: Implement on Railway (Recommended)
- Backend team needs to implement:
  - `POST /private/entity-status/people/{id}`
  - `POST /private/entity-status/companies/{id}`
- Accept body: `{ status: "liked" | "disliked" | "viewed" }`
- Return updated entity status

### Option 3: Alternative Endpoint Pattern
- Check if Railway uses different pattern:
  - `/private/users/entity-status` with body containing entity IDs
  - `/api/entity-status/people/{id}` (without `/private/`)

## Testing Results

All tested endpoint patterns returned 404:
```
❌ POST /private/entity-status/people/{id} (liked) - 404
❌ POST /private/entity-status/people/{id} (disliked) - 404  
❌ POST /private/entity-status/companies/{id} (liked) - 404
❌ PUT /private/entity-status/people/{id} - 404
❌ PATCH /private/entity-status/people/{id} - 404
```

## Conclusion

**Entity status reading works perfectly** - it's automatically included in Railway API responses.

**Entity status writing is not available** on Railway API - endpoints return 404. The mobile app currently uses `app.tryspecter.com` for updates, which requires a dual API setup.

**Next Steps:**
1. Confirm with backend team if entity-status endpoints exist on Railway
2. If not, request implementation of `/private/entity-status/people/{id}` and `/private/entity-status/companies/{id}`
3. Update mobile app to use Railway endpoints once available
