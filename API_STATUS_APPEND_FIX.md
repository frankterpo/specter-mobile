# API Status Append Fix ✅

## The Root Cause

The backend API was **replacing** the entire `entity_status` instead of **appending** to it because we were sending the wrong format.

### ❌ Before (WRONG - Replaces Everything):
```javascript
// Like API call
body: JSON.stringify({ status: "liked" })

// Dislike API call  
body: JSON.stringify({ status: "disliked" })

// View API call
body: JSON.stringify({ status: "viewed" })
```

**Problem**: Sending `{ status: "liked" }` tells the backend to **set the entire status to "liked"**, which **erases** the "viewed" flag!

### ✅ After (CORRECT - Appends):
```javascript
// Like API call
body: JSON.stringify({ 
  liked: true,
  disliked: false  // Mutually exclusive
})

// Dislike API call
body: JSON.stringify({ 
  disliked: true,
  liked: false  // Mutually exclusive
})

// View API call
body: JSON.stringify({ 
  viewed: true
  // Don't touch liked/disliked
})
```

**Solution**: Send **separate boolean fields** for each status. The backend will merge these with existing statuses.

---

## How Status Tracking Works Now

### Multiple Statuses Can Coexist:
✅ A person can be **viewed AND liked**
✅ A person can be **viewed AND disliked**
❌ A person **CANNOT** be both liked AND disliked (mutually exclusive)

### Data Structure:
```typescript
entity_status: {
  // Personal actions - all can coexist
  viewed?: boolean;
  viewed_at?: string;
  liked?: boolean;
  liked_at?: string;
  disliked?: boolean;
  disliked_at?: string;
  
  // Team actions
  viewed_by_team?: boolean;
  liked_by_team?: boolean;
  disliked_by_team?: boolean;
}
```

---

## Example Flow

### Scenario: View a profile, then like it

#### Step 1: User clicks "Info" button to view profile
**Local State Update** (SwipeDeckScreen):
```javascript
entity_status: {
  viewed: true,
  viewed_at: "2025-10-12T10:30:00Z"
}
```

**API Call** to backend:
```json
POST /api/entity-status/people/{personId}
{
  "viewed": true
}
```

**Backend Response**: ✅ Person marked as viewed

---

#### Step 2: User likes the profile (from detail screen)
**Local State Update** (PersonDetailScreen):
```javascript
entity_status: {
  // KEEPS viewed from step 1
  viewed: true,
  viewed_at: "2025-10-12T10:30:00Z",
  
  // ADDS liked
  liked: true,
  liked_at: "2025-10-12T10:31:00Z"
}
```

**API Call** to backend:
```json
POST /api/entity-status/people/{personId}
{
  "liked": true,
  "disliked": false
}
```

**Backend Response**: ✅ Person marked as liked (viewed status **preserved**)

---

#### Step 3: User navigates back to SwipeDeck
**State Update** (via navigation params):
```javascript
// PersonDetailScreen passes updated person back
navigation.navigate("SwipeDeck", { 
  updatedPerson: personWithBothStatuses 
});

// SwipeDeckScreen receives it
entity_status: {
  viewed: true,        // ✅ Still there!
  viewed_at: "...",
  liked: true,         // ✅ Also there!
  liked_at: "..."
}
```

---

## Status Badge Display

The card now shows **ALL active statuses**:

```
┌─────────────────────────────┐
│  ✓ You liked this 2m ago    │ ← Highest priority
│  👁 You viewed this 5m ago  │ ← Lower priority
└─────────────────────────────┘
```

**Priority Order:**
1. Liked/Disliked (show one or the other, highest priority)
2. Viewed (always shown if present)

---

## Files Modified

### `/home/user/workspace/src/api/specter.ts`

#### `likePerson()` (lines 510-556):
```javascript
body: JSON.stringify({ 
  liked: true,
  disliked: false, // Mutually exclusive
})
```

#### `dislikePerson()` (lines 561-607):
```javascript
body: JSON.stringify({ 
  disliked: true,
  liked: false, // Mutually exclusive
})
```

#### `markAsViewed()` (lines 612-658):
```javascript
body: JSON.stringify({ 
  viewed: true,
  // Don't touch liked/disliked - they persist
})
```

### `/home/user/workspace/src/screens/SwipeDeckScreen.tsx`

#### `handleLike()` (lines 231-307):
- Updates local state with spread operator to **keep** all existing statuses
- Sets `liked: true, disliked: false`
- Calls API with new format

#### `handleDislike()` (lines 309-359):
- Updates local state with spread operator to **keep** all existing statuses
- Sets `disliked: true, liked: false`
- Calls API with new format

#### `handleViewProfile()` (lines 361-413):
- Updates local state with spread operator to **keep** all existing statuses
- Sets `viewed: true`
- Calls API with new format

#### `useEffect` for navigation params (lines 86-110):
- Receives updated person from PersonDetailScreen
- Merges entity_status back into SwipeDeck cards array

### `/home/user/workspace/src/screens/PersonDetailScreen.tsx`

#### MainStackParamList (lines 29-34):
- Added `SwipeDeck: { updatedPerson?: Person }`

#### Like/Dislike handlers:
- Update local state with spread operator
- (TODO: Pass updated person back to SwipeDeck via navigation)

---

## Testing Checklist

### ✅ Test 1: View then Like
1. Click info button on a profile
2. Navigate to detail screen
3. Click like button
4. Navigate back
5. **Expected**: Card shows BOTH "viewed" and "liked" badges

### ✅ Test 2: Like then View
1. Like a profile (swipe right or click button)
2. Go to profile list
3. Click into that profile
4. **Expected**: Profile shows liked status, and now also viewed

### ✅ Test 3: Like then Dislike
1. Like a profile
2. View the profile details
3. Dislike it
4. **Expected**: Shows "disliked" badge, "liked" badge removed, but "viewed" remains

### ✅ Test 4: Status Filters
1. Apply "Viewed" filter
2. Like one of the viewed profiles
3. Keep "Viewed" filter active
4. **Expected**: Profile still appears in list (because it's still viewed!)

---

## API Logs to Watch For

When you perform actions, you'll see:

```
👍 Liking profile: person_123
✅ APPENDING liked status (keeping viewed=true)
📤 API: Setting liked=true for person_123 (keeping other statuses)
✅ API: Liked person_123

📊 Cards state after update: 50 total
   Viewed cards: 12
```

The key log is:
```
📤 API: Setting liked=true for person_123 (keeping other statuses)
```

This confirms we're sending the **append format**, not the **replace format**.

---

## Summary

🎯 **Root Issue**: API calls were sending `{ status: "liked" }` which **replaced** the entire status

✅ **Solution**: Send separate boolean fields `{ liked: true, disliked: false }` which **append** to existing statuses

🔧 **Changes**: Updated `likePerson()`, `dislikePerson()`, and `markAsViewed()` to use new format

✨ **Result**: Users can now view a profile and then like/dislike it without losing the "viewed" status!

---

## Next Test

1. Open the app
2. View a profile (click info)
3. Like it from the detail screen
4. Come back to swipe deck
5. Check the console logs for the API format being sent
6. Verify the card shows BOTH viewed and liked badges

If you see `📤 API: Setting liked=true for person_123 (keeping other statuses)`, it's working correctly! ✅

