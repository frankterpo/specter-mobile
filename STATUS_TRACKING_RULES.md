# Status Tracking Rules ✅

## STRICT RULES

### Rule 1: LIKED Status
- **ONLY SET WHEN**: User swipes right OR clicks like button
- **API ENDPOINT**: POST `/api/entity-status/people/{personId}`
- **API BODY**: `{ liked: true, disliked: false }`
- **DATABASE**: Sets `liked=true`, `disliked=false`, **DOES NOT TOUCH `viewed`**

### Rule 2: DISLIKED Status  
- **ONLY SET WHEN**: User swipes left OR clicks dislike button
- **API ENDPOINT**: POST `/api/entity-status/people/{personId}`
- **API BODY**: `{ disliked: true, liked: false }`
- **DATABASE**: Sets `disliked=true`, `liked=false`, **DOES NOT TOUCH `viewed`**

### Rule 3: VIEWED Status
- **ONLY SET WHEN**: User clicks INFO button to view full profile
- **API ENDPOINT**: POST `/api/entity-status/people/{personId}`
- **API BODY**: `{ viewed: true }`
- **DATABASE**: Sets `viewed=true`, **DOES NOT TOUCH `liked` or `disliked`**

## Status Combinations

### ✅ VALID Combinations:
- `{ }` - No status (fresh profile)
- `{ liked: true }` - Liked but never viewed
- `{ disliked: true }` - Disliked but never viewed
- `{ viewed: true }` - Viewed but not liked/disliked yet
- `{ viewed: true, liked: true }` - Viewed AND liked
- `{ viewed: true, disliked: true }` - Viewed AND disliked

### ❌ INVALID Combinations:
- `{ liked: true, disliked: true }` - Can't be both! Mutually exclusive

## Code Flow

### Scenario 1: Swipe Right (Like) Without Viewing
```
1. User swipes right on card
2. handleLike() called
3. Local state updated: { liked: true, disliked: false }
4. API called: POST with { liked: true, disliked: false }
5. Database: person_id → { liked: true }
6. Card moves to next
```

### Scenario 2: View Profile, Then Like
```
1. User clicks INFO button
2. handleViewProfile() called
3. Local state updated: { viewed: true }
4. API called: POST with { viewed: true }
5. Database: person_id → { viewed: true }
6. Navigate to PersonDetailScreen
7. User clicks LIKE button
8. PersonDetailScreen updates local state: { viewed: true, liked: true }
9. API called: POST with { liked: true, disliked: false }
10. Database: person_id → { viewed: true, liked: true }
11. Navigate back to SwipeDeck
12. Card shows BOTH badges
```

### Scenario 3: Like, Then View, Then Dislike
```
1. User swipes right (like)
2. Database: { liked: true }
3. User goes back, clicks INFO on same profile
4. Database: { liked: true, viewed: true }
5. User clicks DISLIKE button
6. Database: { viewed: true, disliked: true, liked: false }
7. Result: Shows "viewed" and "disliked" badges, no "liked" badge
```

## Current Implementation Check

### ✅ handleLike() - Line 257
```javascript
entity_status: {
  ...card.entity_status,  // Keep existing (including viewed if present)
  disliked: false,        // Remove dislike
  liked: true,            // Add like
  // NEVER sets viewed: true here!
}
```

### ✅ handleDislike() - Line 312
```javascript
entity_status: {
  ...card.entity_status,  // Keep existing (including viewed if present)
  liked: false,           // Remove like
  disliked: true,         // Add dislike
  // NEVER sets viewed: true here!
}
```

### ✅ handleViewProfile() - Line 364
```javascript
entity_status: {
  ...card.entity_status,  // Keep existing (including liked/disliked if present)
  viewed: true,           // Add viewed
  // NEVER changes liked or disliked!
}
```

## API Calls Check

### ✅ likePerson() - specter.ts:510
```javascript
body: JSON.stringify({ 
  liked: true,
  disliked: false
  // NO viewed field!
})
```

### ✅ dislikePerson() - specter.ts:561
```javascript
body: JSON.stringify({ 
  disliked: true,
  liked: false
  // NO viewed field!
})
```

### ✅ markAsViewed() - specter.ts:612
```javascript
body: JSON.stringify({ 
  viewed: true
  // NO liked or disliked field!
})
```

## Debugging Steps

If you see a person marked as viewed when you only liked/disliked them:

### Check 1: Console Logs
Look for these logs when you swipe/like:
```
👍 Liking profile: person_123
   Current entity_status: undefined  ← Should be undefined or only have previous status
✅ Setting liked=true (NOT touching viewed)
   Was viewed? false  ← Should be FALSE
📤 API: Setting liked=true for person_123 (keeping other statuses)
```

### Check 2: API is already returning viewed=true
Maybe the backend is returning profiles with `viewed: true` already set from the API response.

Check the API response logs:
```
📥 API RESPONSE FROM BACKEND:
Items received: 50
```

Then inspect the raw data to see if `entity_status` already has `viewed: true`.

### Check 3: Database was already marked
If you previously clicked INFO on a profile, it's marked as viewed in the database FOREVER.

Even if you see it again in a new session, it will STILL show `viewed: true` because that's in the database.

This is CORRECT behavior! Once viewed, always viewed (unless backend provides an "unview" endpoint).

## Expected Behavior Examples

### Example 1: Fresh Profile
```
API returns: { id: "person_123", entity_status: null }
User swipes right
Result: { id: "person_123", entity_status: { liked: true } }
```

### Example 2: Previously Viewed Profile
```
API returns: { id: "person_456", entity_status: { viewed: true, viewed_at: "..." } }
User swipes left
Result: { id: "person_456", entity_status: { viewed: true, disliked: true } }
Card shows: "👁 Viewed" AND "✖ Disliked" badges
```

### Example 3: Change Mind
```
Initial: { liked: true }
User views profile, clicks dislike
Result: { viewed: true, disliked: true, liked: false }
```

## Summary

✅ Code is correct - we NEVER set `viewed: true` except in `handleViewProfile`
✅ API calls are correct - we ONLY send the specific fields we want to update
✅ Status combinations work correctly - liked/disliked are mutually exclusive, viewed coexists

⚠️ If you're seeing `viewed: true` on profiles you never clicked INFO on, it means:
1. The API is returning them with `viewed: true` already (backend issue)
2. OR you DID click INFO on them before (working correctly!)

**To verify**: Check the console logs when loading profiles to see what `entity_status` the API returns.

