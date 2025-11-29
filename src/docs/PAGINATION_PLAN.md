# Specter API Pagination Plan

## Goal
Infinite scroll: User scrolls → detects bottom → loads more → appends → repeat until exhausted.

## Specter API Pagination

All search result endpoints support:
- `limit` (default: 20) - number of items per page
- `offset` (default: 0) - starting index

Endpoints:
- `/searches/people/{id}/results?limit=20&offset=0`
- `/searches/companies/{id}/results?limit=20&offset=0`
- `/searches/talent/{id}/results?limit=20&offset=0`
- `/searches/investor-interest/{id}/results?limit=20&offset=0`

Response format:
```json
{
  "items": [...],
  "total": 1500  // May be unreliable - treat items.length as source of truth
}
```

## Implementation Architecture

### State Variables
```typescript
const [resultsOffset, setResultsOffset] = useState(0);      // Current offset
const [hasMoreResults, setHasMoreResults] = useState(false); // Can load more?
const [isLoadingMore, setIsLoadingMore] = useState(false);   // Loading indicator
```

### Pagination Logic

1. **Initial Load** (when saved search selected):
   - Reset: `offset=0`, `hasMore=false`
   - Fetch with `limit=20, offset=0`
   - Set `hasMore = items.length === 20` (assume more if full page)
   - Set `offset = 20`

2. **Load More** (on scroll):
   - Guard: `if (!hasMore || isLoadingMore) return`
   - Set `isLoadingMore = true`
   - Fetch with `limit=20, offset=currentOffset`
   - Append to results
   - Set `hasMore = items.length === 20`
   - Increment `offset += 20`
   - Set `isLoadingMore = false`

3. **Scroll Detection**:
   - Use `onScroll` on ScrollView
   - Calculate: `isNearBottom = scrollY + viewHeight >= contentHeight - threshold`
   - Threshold: 400-600px
   - Throttle: 16ms (60fps)

### Key Rule
**`hasMoreResults = fetchedItems.length === PAGE_SIZE`**

If API returns fewer than requested, we've hit the end.

## Execution Checklist

- [ ] Ensure `offset` param is passed to all API calls
- [ ] Use `PAGE_SIZE` constant (20) everywhere
- [ ] Set `hasMore` based on items.length, NOT api.total
- [ ] Guard `loadMore` with `!isLoadingMore && hasMore`
- [ ] Reset pagination on search change
- [ ] Show loading spinner at bottom
- [ ] Log pagination state for debugging

