# API MERGE vs REPLACE Test 🧪

## THE CRITICAL QUESTION

When we send:
```json
POST /api/entity-status/people/person_123
{ "liked": true, "disliked": false }
```

Does the backend:
- ✅ **MERGE** with existing status: `{ viewed: true }` → `{ viewed: true, liked: true }`
- ❌ **REPLACE** entire status: `{ viewed: true }` → `{ liked: true }` (viewed lost!)

---

## Test Steps

### Step 1: View a profile
1. Open the app
2. Click the INFO button on a profile
3. **Check logs:**
   ```
   👁️ Viewing profile: person_ABC123
   ✅ APPENDING viewed status to card
   📤 API: Setting viewed=true for person_ABC123 (keeping other statuses)
   ```
4. Navigate back to swipe deck

### Step 2: Like that SAME profile
1. Find the same profile (it should show "👁 You viewed this" badge)
2. Swipe right or click like button
3. **Check logs:**
   ```
   👍 Liking profile: person_ABC123
      Current entity_status: { viewed: true, viewed_at: "..." }  ← Should show viewed
   ✅ Setting liked=true (NOT touching viewed)
      Was viewed? true  ← Should be TRUE
   📤 API: Setting liked=true for person_ABC123 (keeping other statuses)
   ✅ API: Successfully liked person_ABC123 in database
   ```

### Step 3: Reload or filter to see that profile again
1. Apply a filter (like "Liked") OR close and reopen the app
2. Find that same profile in the results
3. **Check what the API returns:**
   ```
   📥 API RESPONSE FROM BACKEND:
   Sample items with entity_status:
     [0] John Doe
         entity_status: {"viewed":true,"liked":true}  ← SHOULD HAVE BOTH!
   ```

---

## What You Should See

### ✅ If Backend is MERGING (CORRECT):
```
Profile after reload shows:
  ✓ You liked this
  👁 You viewed this

Console shows:
  entity_status: {"viewed":true,"viewed_at":"...","liked":true,"liked_at":"..."}
```

### ❌ If Backend is REPLACING (BROKEN):
```
Profile after reload shows:
  ✓ You liked this
  (NO viewed badge)

Console shows:
  entity_status: {"liked":true,"liked_at":"..."}
  (viewed is missing!)
```

---

## If Backend is REPLACING - The Fix

If the backend is replacing instead of merging, we need to **send ALL fields** in every API call:

### Current (assumes backend merges):
```javascript
// Like call
body: { liked: true, disliked: false }  // Only sends liked/disliked

// View call  
body: { viewed: true }  // Only sends viewed
```

### Fixed (explicitly preserves all fields):
```javascript
// Like call - must include current viewed status!
body: { 
  viewed: person.entity_status?.viewed || false,  // Preserve viewed
  viewed_at: person.entity_status?.viewed_at,
  liked: true, 
  disliked: false 
}

// View call - must include current liked/disliked status!
body: { 
  viewed: true,
  liked: person.entity_status?.liked || false,  // Preserve liked
  liked_at: person.entity_status?.liked_at,
  disliked: person.entity_status?.disliked || false,  // Preserve disliked
  disliked_at: person.entity_status?.disliked_at
}
```

---

## Action Required

**Run the 3-step test above and share the console logs**, specifically:

1. The log from Step 2 showing the API call body
2. The log from Step 3 showing what the API returns

This will tell us definitively if the backend is merging or replacing, and I'll fix it accordingly.

---

## Quick Debug

Add this to see what's being sent and received:

```javascript
// In likePerson() - src/api/specter.ts
console.log("📤 SENDING TO API:", JSON.stringify({ liked: true, disliked: false }));

// After API response
console.log("📥 API RESPONSE STATUS:", response.status);
const responseData = await response.json();
console.log("📥 API RESPONSE BODY:", JSON.stringify(responseData));
```

Share these logs and I'll know exactly what's wrong! 🔍

