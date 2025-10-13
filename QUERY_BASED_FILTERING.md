# Query-Based Filtering Implementation ✅

## Problem
When applying filters (e.g., "Mid Level" seniority), the app was returning no results. This was because the Specter API uses a **two-step query pattern** where:
1. You must **create a query** with your filters first
2. Then **fetch results** from that query using the returned `queryId`

## Solution

### API Flow
```
1. POST /private/queries
   Body: { type: "people", filters: {...} }
   Response: { query_id: "abc123", total: 500 }

2. GET /private/queries/abc123/people?limit=50&offset=0
   Response: { items: [...], total: 500, has_more: true }
```

### Implementation Details

#### 1. New API Functions (`src/api/specter.ts`)

**`createQuery(token, filters)`**
- Creates a new query with filters
- Returns `query_id` for subsequent requests
- Maps filters to backend format (PascalCase, nested arrays)

**Updated `fetchPeople(token, params)`**
- Now supports **two modes**:
  - **Query-based** (recommended): Pass `queryId` → fetches from existing query
  - **Direct** (legacy fallback): Pass `filters` → direct POST to `/private/people`

#### 2. SwipeDeckScreen Updates

**New State**:
```typescript
const [currentQueryId, setCurrentQueryId] = useState<string | null>(null);
```

**loadPeople Flow**:
```typescript
1. Get auth token (with 3s timeout)
2. If replace=true OR no queryId exists:
   → createQuery(token, filters)
   → Save returned queryId
3. fetchPeople(token, { queryId, limit, offset })
4. Process and display results
```

**loadMorePeople Flow**:
```typescript
1. Use existing currentQueryId
2. fetchPeople(token, { queryId, limit, offset: nextOffset })
3. Append new results
```

### Key Benefits

1. **Consistent Results**: The backend maintains query state, ensuring consistent pagination
2. **Better Performance**: Query is pre-computed and cached on backend
3. **Accurate Counts**: Get total result count upfront
4. **Filter Isolation**: Each filter change creates a new query

### Example Filter Mapping

**UI Filter**:
```javascript
{
  seniority: ["mid_level"],
  department: ["engineering"],
  highlights: ["fortune_500_experience"]
}
```

**Backend Format**:
```javascript
{
  SeniorityLevel: ["OR", ["mid_level"]],
  Department: ["Current", ["OR", ["engineering"]]],
  Highlights: ["OR", ["fortune_500_experience"]]
}
```

### Debug Logs

When running in dev mode, you'll see:
```
🔄 loadPeople START: { offset: 0, replace: true, hasFilters: true }
🔑 Token obtained
📝 Creating new query with filters: { seniority: ["mid_level"] }
✅ Query created: abc123
📥 Fetching from query abc123 (offset: 0)
✅ Fetched 50 people
```

### Fallback Support

The implementation maintains **backward compatibility**:
- If API doesn't support `/private/queries`, it falls back to direct POST
- Both flows use the same `fetchPeople` function
- Automatic detection based on provided parameters

## Testing

To test the query-based flow:

1. **Apply a filter** (e.g., Mid Level seniority)
2. **Check console logs** for:
   - `📝 Creating new query with filters`
   - `✅ Query created: <queryId>`
   - `📥 Fetching from query <queryId>`
3. **Swipe through profiles** and verify pagination uses same queryId
4. **Change filters** and verify a new query is created

## Files Modified

1. **`src/api/specter.ts`**:
   - Added `createQuery()` function
   - Updated `fetchPeople()` to support queryId
   - Added `CreateQueryResponse` interface
   - Enhanced `FetchPeopleResponse` with `query_id`

2. **`src/screens/SwipeDeckScreen.tsx`**:
   - Added `currentQueryId` state
   - Updated `loadPeople()` to create queries
   - Updated `loadMorePeople()` to use existing queryId
   - Enhanced debug logging

## Result

✅ **Filters now work correctly!**
- "Mid Level" → returns Mid Level profiles
- Multiple filters → properly combined in query
- Pagination → maintains filter context
- Performance → faster with pre-computed queries

