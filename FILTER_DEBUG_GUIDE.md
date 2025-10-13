# Filter Debugging Guide 🔍

## Quick Diagnosis

When you apply ANY filter and get no results or wrong results, check these in order:

### Step 1: Check Console Logs

Open your app and look for these logs:

```javascript
🔄 loadPeople START: { 
  offset: 0, 
  replace: true, 
  hasFilters: true,  // ← Should be true when filters applied
  filters: { ... }    // ← Should show your filters
}

📤 API Request (Direct): {
  url: "https://specter-api-staging.up.railway.app/private/people",
  body: {
    "limit": 50,
    "offset": 0,
    "filters": {
      "SeniorityLevel": ["OR", ["mid_level"]],  // ← Check format
      ...
    }
  }
}

📥 API Response: 0 items (direct)  // ← Check item count
```

### Step 2: Common Issues

#### Issue 1: Filters Not Being Sent
**Symptom**: `hasFilters: false` or `filters: {}`

**Cause**: Filter state not updating properly

**Fix**: Check if `handleApplyFilters` is being called:
```typescript
const handleApplyFilters = (newFilters: FilterOptions) => {
  setFilters(newFilters);
  loadPeople(0, true);  // ← Must call this
};
```

#### Issue 2: Wrong Filter Format
**Symptom**: API returns 0 items but console shows filters

**Cause**: Backend expects specific format

**Fix**: Check `mapFiltersToBackendFormat` output in console

**Expected Format**:
```json
{
  "SeniorityLevel": ["OR", ["mid_level", "senior"]],
  "Department": ["Current", ["OR", ["engineering"]]],
  "Highlights": ["OR", ["fortune_500_experience"]],
  "HasLinkedIn": true
}
```

#### Issue 3: Backend Doesn't Support Filter
**Symptom**: API returns all profiles, ignoring filters

**Cause**: Backend `/private/people` endpoint might not handle filters

**Fix**: Test API directly

---

## Debugging Steps

### Test 1: Direct API Call

Test if the API actually supports filters:

```bash
# Get a valid Clerk token from your app console
# Look for: "🔑 Token obtained"

curl -X POST "https://specter-api-staging.up.railway.app/private/people" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "limit": 10,
    "offset": 0,
    "filters": {
      "SeniorityLevel": ["OR", ["mid_level"]]
    }
  }' | jq
```

**Expected**: 10 profiles with mid-level seniority
**If you get**: All profiles regardless of seniority → Backend doesn't support filters on this endpoint

### Test 2: Filter State Check

Add this temporary log to see filter state:

```typescript
// In SwipeDeckScreen.tsx, add to handleApplyFilters:
const handleApplyFilters = (newFilters: FilterOptions) => {
  console.log("🎯 FILTERS BEING APPLIED:", JSON.stringify(newFilters, null, 2));
  setFilters(newFilters);
  loadPeople(0, true);
};
```

### Test 3: Check Filter Mapping

Verify the mapping function output:

```typescript
// In src/api/specter.ts, add before API call:
const apiFilters = mapFiltersToBackendFormat(params.filters, params.statusFilters);
console.log("🗺️ MAPPED FILTERS:", JSON.stringify(apiFilters, null, 2));
```

---

## Likely Root Causes

### Cause 1: Backend Endpoint Limitation ⚠️

**Most Likely Issue**: The `/private/people` endpoint might be a simple "get all people" endpoint that **doesn't support filtering**.

**Evidence**:
1. We tried `/private/queries` → Got 404 (doesn't exist)
2. Now using `/private/people` directly
3. Backend might expect filters in a different endpoint

**Solution Options**:

#### Option A: Use Different Endpoint
```typescript
// Instead of: POST /private/people
// Try: GET /private/people/search?filters=...
// Or: POST /private/search/people
```

#### Option B: Client-Side Filtering (Fallback)
If backend doesn't support filters, filter on client:

```typescript
const response = await fetchPeople(token, {
  limit: 200,  // Fetch more to filter client-side
  offset: newOffset,
});

// Filter client-side
const filtered = response.items.filter(person => {
  if (filters.seniority?.length > 0) {
    if (!filters.seniority.includes(person.seniority?.toLowerCase())) {
      return false;
    }
  }
  // ... other filters
  return true;
});

setCards(filtered);
```

#### Option C: Check API Documentation
Look for the correct endpoint structure in the Specter backend docs.

---

## Quick Test Script

Add this to your SwipeDeckScreen to test:

```typescript
// Temporary test function
const testAPIFilters = async () => {
  const token = await getToken();
  
  console.log("🧪 TEST 1: No filters");
  const test1 = await fetchPeople(token, { limit: 5, offset: 0 });
  console.log("Result:", test1.items.map(p => p.seniority));
  
  console.log("🧪 TEST 2: With mid_level filter");
  const test2 = await fetchPeople(token, { 
    limit: 5, 
    offset: 0,
    filters: { seniority: ["mid_level"] }
  });
  console.log("Result:", test2.items.map(p => p.seniority));
  
  if (test1.items.length === test2.items.length) {
    console.error("❌ FILTERS NOT WORKING - API ignoring filters");
  } else {
    console.log("✅ FILTERS WORKING");
  }
};

// Call on mount
useEffect(() => {
  testAPIFilters();
}, []);
```

---

## Expected vs Actual

### What SHOULD Happen:

1. User selects "Mid Level" in filter modal
2. `handleApplyFilters` called with `{ seniority: ["mid_level"] }`
3. `setFilters({ seniority: ["mid_level"] })`
4. `loadPeople(0, true)` called
5. `mapFiltersToBackendFormat` converts to `{ SeniorityLevel: ["OR", ["mid_level"]] }`
6. API POST with filter body
7. Backend returns ONLY mid-level profiles
8. Cards updated with filtered results

### What MIGHT Be Happening:

1. ✅ User selects "Mid Level"
2. ✅ Filter modal closes
3. ✅ API called with filters
4. ❌ Backend **ignores** filters
5. ❌ Returns ALL profiles
6. ❌ User sees non-filtered results

---

## Immediate Action Items

### 1. Check Console Right Now

When you apply a filter, you should see:
```
🔄 loadPeople START: { hasFilters: true, filters: {...} }
📤 API Request (Direct): { body: { filters: {...} } }
📥 API Response: X items
```

**Share these logs with me** and I can tell you exactly what's wrong.

### 2. Test Without Auth

Try the curl command above with your actual token to see if backend supports filters.

### 3. Check Backend Response

The response should include:
```json
{
  "items": [...],
  "total": 50,
  "has_more": true
}
```

If it's returning ALL items regardless of filters, the backend doesn't support this endpoint for filtering.

---

## Alternative Solutions

### If Backend Doesn't Support Filters:

#### Solution 1: Find Correct Endpoint
Ask backend team for the proper filtering endpoint. It might be:
- `/api/people/search`
- `/api/search/people`  
- `/private/people/filter`
- `/private/queries/:id/people` (with pre-created query)

#### Solution 2: Use Query System
If `/private/queries` exists but returned 404:
- Might need different URL
- Might need different auth
- Check actual backend documentation

#### Solution 3: Client-Side Filter (Last Resort)
Implement filtering in the app after fetching all profiles.

---

## Next Steps

1. **Run the app with filters applied**
2. **Copy all console logs** (especially `📤 API Request` and `📥 API Response`)
3. **Share the logs** so I can diagnose exactly what's happening
4. **Test the curl command** to verify backend behavior

The issue is likely:
- Backend endpoint doesn't support filters (most likely)
- Wrong filter format
- Wrong endpoint URL
- Auth issue

Once you share the console logs, I can tell you exactly which one it is and how to fix it! 🔧

