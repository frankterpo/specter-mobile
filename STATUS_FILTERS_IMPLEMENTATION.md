# Status Filters Implementation ✅

## Overview
Added a **top bar status filter system** that allows users to quickly filter profiles based on their personal actions and team activity. These filters are separate from the main filter modal and are always visible for quick access.

## Features

### Personal Status Filters
Users can filter profiles they have:
- **Not Viewed** - Profiles they haven't clicked to view details
- **Viewed** - Profiles they've clicked to see full details (marked as "viewed" only when user taps INFO/view profile, not just by swiping)
- **Liked** - Profiles they've swiped right on
- **Disliked** - Profiles they've swiped left on

### Team Status Filters
Users can see what their team has done:
- **Team Viewed** - Profiles that any team member has viewed
- **Team Liked** - Profiles that any team member has liked

## UI Design

### Location
Horizontal scrollable chip bar positioned directly below the main header, above the card stack.

### Visual Style
- **Chip Design**: Rounded pills with icons + text
- **Inactive State**: Gray background (#F3F4F6) with gray text
- **Active State**: Blue background (#4299E1) with white text
- **Icons**: Relevant Ionicons for each filter type
- **Divider**: Vertical line separating personal and team filters

### Interaction
- **Single-tap** to activate a filter
- **Tap again** to deactivate
- **Personal status filters** are mutually exclusive (only one can be active)
- **Team filters** can be combined with each other and personal filters

## Technical Implementation

### 1. API Changes (`src/api/specter.ts`)

**New Interface**:
```typescript
export interface StatusFilters {
  myStatus?: "viewed" | "not_viewed" | "liked" | "disliked" | null;
  teamViewed?: boolean;
  teamLiked?: boolean;
}
```

**Updated Params**:
```typescript
export interface FetchPeopleParams {
  limit: number;
  offset: number;
  filters?: FilterOptions;
  statusFilters?: StatusFilters;  // NEW
  queryId?: string;
}
```

**Backend Mapping**:
```typescript
function mapFiltersToBackendFormat(filters, statusFilters) {
  const apiFilters = {};
  
  if (statusFilters?.myStatus) {
    apiFilters.MyEntityStatus = statusFilters.myStatus;
  }
  if (statusFilters?.teamViewed) {
    apiFilters.TeamViewed = true;
  }
  if (statusFilters?.teamLiked) {
    apiFilters.TeamLiked = true;
  }
  // ... other filters
}
```

### 2. SwipeDeckScreen Updates

**New State**:
```typescript
const [statusFilters, setStatusFilters] = useState<StatusFilters>({});
```

**Toggle Function**:
```typescript
const toggleStatusFilter = (filterType: keyof StatusFilters, value: any) => {
  setStatusFilters(prev => {
    const newFilters = { ...prev };
    if (newFilters[filterType] === value) {
      delete newFilters[filterType];  // Toggle off
    } else {
      newFilters[filterType] = value;  // Set new value
    }
    return newFilters;
  });
  loadPeople(0, true);  // Reload with new filters
};
```

**API Integration**:
```typescript
const response = await fetchPeople(token, {
  limit: LIMIT,
  offset: newOffset,
  filters,
  statusFilters,  // Passed to API
});
```

### 3. "Viewed" Status Logic

**Important**: "Viewed" status is only set when:
1. User taps the **INFO button** on a card
2. User taps a card to **open the detail view**

**NOT set when**:
- User swipes through cards
- Cards are displayed in the stack
- User likes/dislikes without viewing details

**Implementation**:
```typescript
const handleViewProfile = async (person: Person) => {
  try {
    const token = await getToken();
    if (token) {
      await markAsViewed(token, person.id);  // ✅ Mark as viewed here
    }
  } catch (err) {
    console.error("Mark viewed error:", err);
  }
  navigation.navigate("PersonDetail", { personId: person.id });
};
```

## Usage Examples

### Shortlist Workflow
1. **Filter for "Not Viewed"** → See all profiles you haven't reviewed yet
2. **Quickly swipe through** to like/dislike without viewing details
3. **Tap INFO** on interesting profiles to mark as viewed and see full details

### Team Collaboration
1. **Filter for "Team Liked"** → See what your team is interested in
2. **Add your own review** by liking/disliking
3. **Filter for "Not Viewed"** → Focus on profiles the team hasn't reviewed yet

### Filter Combinations
- **"Not Viewed" + Seniority: "Mid Level"** → New mid-level profiles
- **"Team Liked" + "Not Viewed" by me** → Team favorites I haven't seen
- **"Liked" by me** → Review my shortlist

## Backend API Format

### Request Body
```json
{
  "limit": 50,
  "offset": 0,
  "filters": {
    "MyEntityStatus": "not_viewed",
    "TeamViewed": true,
    "SeniorityLevel": ["OR", ["mid_level"]],
    "Department": ["Current", ["OR", ["engineering"]]]
  }
}
```

### Response
```json
{
  "items": [
    {
      "id": "person123",
      "entity_status": {
        "status": "not_viewed",
        "viewed_by_team": true,
        "liked_by_team": false
      }
    }
  ]
}
```

## Files Modified

1. **`src/api/specter.ts`**:
   - Added `StatusFilters` interface
   - Updated `FetchPeopleParams` with `statusFilters`
   - Enhanced `mapFiltersToBackendFormat` to handle status filters
   - Updated `createQuery` and `fetchPeople` functions

2. **`src/screens/SwipeDeckScreen.tsx`**:
   - Added `statusFilters` state
   - Imported `ScrollView` for horizontal chip bar
   - Created `toggleStatusFilter` function
   - Added status filter bar UI with 6 chips
   - Added styles for chips and divider
   - Integrated status filters with `loadPeople`

## Styling

### CSS Classes
```typescript
statusFilterBar: {
  backgroundColor: "white",
  borderBottomWidth: 1,
  borderBottomColor: "#E5E7EB",
  maxHeight: 60,
}

statusChip: {
  flexDirection: "row",
  gap: 6,
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 20,
  backgroundColor: "#F3F4F6",  // Inactive
}

statusChipActive: {
  backgroundColor: "#4299E1",  // Active (Specter blue)
  borderColor: "#4299E1",
}
```

## Benefits

1. **Quick Access**: No need to open filter modal for common status filters
2. **Visual Clarity**: Always visible, shows active filters at a glance
3. **Team Awareness**: See what team members have reviewed
4. **Efficient Workflow**: Quickly filter between viewed/not viewed for shortlisting
5. **Persistent Context**: Filters stay visible while swiping

## Troubleshooting

### Metro Bundler Cache Issue
If you see "Property 'ScrollView' doesn't exist" error after adding the import:

```bash
# Clear Metro bundler cache
npm start -- --reset-cache

# Or restart with clean cache
npx expo start -c
```

### TypeScript Check
```bash
npx tsc --noEmit --skipLibCheck
# Should pass with no errors ✅
```

## Next Steps

Optional enhancements:
1. **Filter Presets**: Save common filter combinations
2. **Filter Count Badge**: Show number of results for each status
3. **Clear All**: Quick button to reset all status filters
4. **Animation**: Smooth transitions when toggling filters
5. **Haptic Feedback**: Tactile response when tapping chips

## Result

✅ **Fully functional status filter system!**
- Personal status filters: Not Viewed, Viewed, Liked, Disliked
- Team status filters: Team Viewed, Team Liked
- Clean, accessible UI always visible at top
- Proper "viewed" logic (only on detail view)
- Integrated with existing filter and pagination system

