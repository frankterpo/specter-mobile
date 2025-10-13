# Mutually Exclusive Status System ✅

## Overview

The platform uses a **single status per person** system where a person can ONLY be in ONE of these states at a time:

1. **Liked** (swipe right)
2. **Disliked** (swipe left)  
3. **Viewed/Passed** (swipe down) - NEW!
4. **Not Viewed** (no action yet)

---

## Implementation

### Data Structure (UPDATED)
```typescript
entity_status?: {
  status: "viewed" | "liked" | "disliked" | null;  // ONE status only!
  updated_at?: string;
  
  // Team actions (separate)
  viewed_by_team?: boolean;
  liked_by_team?: boolean;
  disliked_by_team?: boolean;
}
```

### API Calls (FIXED)
```javascript
// Like
POST /api/entity-status/people/{personId}
{ "status": "liked" }  // REPLACES previous status

// Dislike
POST /api/entity-status/people/{personId}
{ "status": "disliked" }  // REPLACES previous status

// Pass/Skip (swipe down)
POST /api/entity-status/people/{personId}
{ "status": "viewed" }  // REPLACES previous status
```

---

## User Actions

### 1. Swipe Right → Like
**Gesture:** Swipe card right  
**Status:** `liked`  
**Badge:** `✓ You liked this`  
**Color:** Green (#22c55e)

### 2. Swipe Left → Dislike
**Gesture:** Swipe card left  
**Status:** `disliked`  
**Badge:** `✖ You disliked this`  
**Color:** Red (#ef4444)

### 3. Swipe Down → Pass/Skip (NEW!)
**Gesture:** Swipe card down  
**Status:** `viewed`  
**Badge:** `⏭️ You passed on this`  
**Color:** Blue (#3b82f6)

### 4. Click Info → View Details
**Gesture:** Click info button  
**Status:** NO CHANGE  
**Action:** Navigate to PersonDetailScreen

---

## Behavior Rules

### ✅ ALLOWED:
- Like someone who has no status → status becomes "liked"
- Dislike someone who was "liked" → status becomes "disliked" (replaces)
- Pass on someone who was "disliked" → status becomes "viewed" (replaces)
- Re-like someone you disliked → status becomes "liked" (replaces)

### ❌ NOT ALLOWED:
- Someone can't be both liked AND disliked
- Someone can't be both liked AND viewed
- Someone can't be both disliked AND viewed

### 📝 Status Transitions:
```
null → liked
null → disliked
null → viewed

liked → disliked (user changes mind)
liked → viewed (user changes mind to pass)

disliked → liked (user changes mind)
disliked → viewed (user changes mind to pass)

viewed → liked (user decides to like after viewing)
viewed → disliked (user decides to dislike after viewing)
```

---

## Code Changes

### Files Modified:

1. **src/api/specter.ts**
   - Updated `Person` interface with single `status` field
   - Updated `likePerson()` to send `{ status: "liked" }`
   - Updated `dislikePerson()` to send `{ status: "disliked" }`
   - Updated `markAsViewed()` to send `{ status: "viewed" }`

2. **src/screens/SwipeDeckScreen.tsx**
   - Simplified `handleLike()` to replace status
   - Simplified `handleDislike()` to replace status
   - Added `handlePass()` for swipe down gesture
   - Updated `handleViewProfile()` to NOT change status (just navigates)
   - Added swipe down detection in `panGesture.onEnd()`
   - Updated `renderStatusBadge()` to show ONE badge
   - Added `onPass` prop to `SwipeCard`

3. **src/screens/PersonDetailScreen.tsx**
   - Updated `handleLike()` to replace status
   - Updated `handleDislike()` to replace status

---

## Testing Guide

### Test 1: Swipe Right (Like)
1. Swipe right on a fresh profile
2. **Expected Logs:**
   ```
   👍 Liking profile: person_123
      Previous status: none
   ✅ Setting status to "liked" (REPLACES previous status)
   📤 LIKE API CALL (REPLACES previous status)
   ✅ LIKE API SUCCESS
   ```
3. **Expected Result:** Card shows green "✓ You liked this" badge

### Test 2: Swipe Left (Dislike)
1. Swipe left on a fresh profile
2. **Expected Logs:**
   ```
   👎 Disliking profile: person_456
      Previous status: none
   ✅ Setting status to "disliked" (REPLACES previous status)
   📤 DISLIKE API CALL (REPLACES previous status)
   ✅ DISLIKE API SUCCESS
   ```
3. **Expected Result:** Card shows red "✖ You disliked this" badge

### Test 3: Swipe Down (Pass) - NEW!
1. Swipe down on a fresh profile
2. **Expected Logs:**
   ```
   ⏭️ Passing/Skipping profile: person_789
      Previous status: none
   ✅ Setting status to "viewed" (REPLACES previous status)
   📤 PASS/VIEWED API CALL (REPLACES previous status)
   ✅ VIEWED API SUCCESS
   ```
3. **Expected Result:** Card shows blue "⏭️ You passed on this" badge

### Test 4: Change Mind (Like → Dislike)
1. Swipe right on profile (liked)
2. Find same profile again (apply "Liked" filter)
3. Swipe left on it (dislike)
4. **Expected Result:** Status changes from "liked" to "disliked"
5. **Database:** Only shows `{ status: "disliked" }` (not both)

### Test 5: Status Persistence
1. Like a profile
2. Close and reopen app
3. Filter by "Liked"
4. **Expected Result:** Profile shows up with "✓ You liked this" badge

---

## Status Filter Integration

The status filters at the top of the screen work with this system:

- **Not Viewed**: Shows profiles with `status: null`
- **Viewed**: Shows profiles with `status: "viewed"`
- **Liked**: Shows profiles with `status: "liked"`
- **Disliked**: Shows profiles with `status: "disliked"`

Each person appears in ONLY ONE list at a time!

---

## Summary

✅ **Fixed**: Status system now uses single mutually exclusive status  
✅ **Added**: Swipe down gesture for "Pass/Skip" action  
✅ **Simplified**: API calls send only `{ status: "..." }`  
✅ **Clarified**: A person is in ONE list only (Liked OR Disliked OR Viewed)  

**Key Insight:** The platform is designed for quick decision-making where you:
- Swipe right = I want to engage with this person
- Swipe left = I don't want to engage with this person  
- Swipe down = I'll decide later / skip for now

This makes the filtering and list management clean and simple! 🎯

