# Codex Execution Prompt - Specter Mobile V1

## 🎯 MISSION CRITICAL

**Goal**: Make Specter Mobile V1 fully functional on native iOS/Android with working authentication and populated data feeds.

---

## 📚 REQUIRED READING (in order)

Before starting ANY task, read these files completely:

1. **`AGENTS.md`** - Project structure, commands, coding conventions
2. **`init/CODEX_AGENT_DIRECTIONS.md`** - Architecture, blockers, authentication strategy
3. **`init/API_ROUTES_CODEX.md`** - Complete API routes for Railway (private) and App APIs
4. **`QA_STATUS.md`** - Current test status and known issues

---

## ✅ MANDATORY TASKS

### Task 1: Verify Authentication Flow Works on Native
**Files**: `src/screens/SignInScreen.tsx`, `src/hooks/useClerkToken.ts`, `src/stores/authStore.ts`

**Steps**:
1. Ensure `useSignIn` and `useAuth` from `@clerk/clerk-expo` are used correctly
2. Verify token caching in `src/utils/tokenCache.ts` works with JWT expiry
3. Confirm `setAuthEmail()` is called after successful sign-in
4. Test that cached tokens persist across app restarts

**Success Criteria**:
- User can sign in with email/password on native
- JWT token is cached in AsyncStorage
- App stays signed in after restart

---

### Task 2: Populate All Data Feeds
**Files**: `src/screens/CompaniesFeedScreen.tsx`, `src/screens/PeopleFeedScreen.tsx`, `src/screens/InvestorsFeedScreen.tsx`, `src/hooks/useSignals.ts`

**Steps**:
1. Verify `useClerkToken().getAuthToken()` returns valid JWT
2. Ensure API calls include both `Authorization: Bearer <JWT>` AND `x-api-key` headers
3. Check `src/api/public-client/client.ts` - the `apiRequest` function must send correct headers
4. Implement loading states and error handling for empty responses

**Success Criteria**:
- Companies feed shows company cards with logos, names, industries
- People feed shows person cards with photos, names, titles
- Investors feed shows investor data with ranks, investments
- No "Not authenticated" or 401 errors in console

---

### Task 3: Implement Quick Search
**Reference**: `init/API_ROUTES_CODEX.md` → Private Routes → Quick Search Router

**Files to create/modify**: `src/components/GlobalSearchBar.tsx`, `src/api/public-client/client.ts`

**Steps**:
1. Add `quickSearch` method to `SpecterPublicAPI` class:
```typescript
quickSearch = {
  async search(query: string, authToken: string): Promise<QuickSearchResults> {
    return apiRequest<QuickSearchResults>(
      `/quick-search?q=${encodeURIComponent(query)}&limit=10`,
      { method: "GET" },
      authToken,
      'railway'
    );
  },
};
```
2. Create debounced search input in GlobalSearchBar
3. Display categorized results (companies, people, investors)

**Success Criteria**:
- Typing in search bar triggers API call after 300ms debounce
- Results show in dropdown with entity type icons
- Clicking result navigates to detail page

---

### Task 4: Add Company Team View
**Reference**: `init/API_ROUTES_CODEX.md` → Private Routes → Companies Router → `GET /{company_id}/people`

**Files to modify**: `src/screens/CompanyDetailScreen.tsx`, `src/api/public-client/client.ts`

**Steps**:
1. Add `getCompanyPeople` method:
```typescript
companies = {
  // ... existing methods
  async getCompanyPeople(companyId: string, authToken: string, options?: {
    department?: string;
    founders?: boolean;
    ceo?: boolean;
    page?: number;
    limit?: number;
  }): Promise<BasicPerson[]> {
    const params = new URLSearchParams();
    if (options?.department) params.set('department', options.department);
    if (options?.founders !== undefined) params.set('founders', String(options.founders));
    if (options?.ceo !== undefined) params.set('ceo', String(options.ceo));
    params.set('page', String(options?.page || 0));
    params.set('limit', String(options?.limit || 25));
    
    return apiRequest<BasicPerson[]>(
      `/companies/${companyId}/people?${params.toString()}`,
      { method: "GET" },
      authToken,
      'railway'
    );
  },
};
```
2. Add "Team" tab/section to CompanyDetailScreen
3. Display team members with role filtering (founders, CEO, by department)

**Success Criteria**:
- Company detail page shows team members
- Can filter by founders only
- Tapping team member navigates to person detail

---

### Task 5: Implement Strategic Intelligence Feed
**Reference**: `init/API_ROUTES_CODEX.md` → Private Routes → Strategic Intelligence Router

**Files to create**: `src/screens/StrategicSignalsScreen.tsx`, `src/api/public-client/client.ts`

**Steps**:
1. Add `stratIntel` method:
```typescript
stratIntel = {
  async getSignals(authToken: string, filters?: {
    signal_types?: string[];
    industries?: string[];
    regions?: string[];
    limit?: number;
    offset?: number;
  }): Promise<StratIntelSignal[]> {
    return apiRequest<StratIntelSignal[]>(
      '/strat-intel',
      {
        method: "POST",
        body: JSON.stringify(filters || { limit: 50, offset: 0 })
      },
      authToken,
      'railway'
    );
  },
};
```
2. Create StrategicSignalsScreen with signal cards
3. Add filtering UI for signal types (funding, acquisition, IPO)
4. Add to navigation (new tab or menu item)

**Success Criteria**:
- Strat Intel screen shows curated signals
- Can filter by signal type
- Signal cards show company info, signal type, date

---

### Task 6: Fix Token Renewal
**Files**: `src/hooks/useClerkToken.ts`, `src/utils/tokenCache.ts`

**Steps**:
1. Check token expiry before each API call
2. If expired, call `getToken({ skipCache: true })` from Clerk
3. Update cached token with new expiry
4. Handle renewal failures gracefully (redirect to sign-in)

**Success Criteria**:
- App doesn't show auth errors after 1 hour
- Tokens auto-renew seamlessly
- Console shows: `🔑 [TokenCache] Token renewed successfully`

---

### Task 7: Implement Fallback Strategy
**Reference**: `init/API_ROUTES_CODEX.md` → Mobile Implementation Strategy → Fallback Strategy

**Files**: `src/api/public-client/client.ts`

**Steps**:
1. Create wrapper function for Railway → App fallback:
```typescript
async function fetchWithFallback<T>(
  railwayEndpoint: string,
  appEndpoint: string,
  options: RequestInit,
  authToken: string
): Promise<T> {
  try {
    return await apiRequest<T>(railwayEndpoint, options, authToken, 'railway');
  } catch (error) {
    if (error instanceof SpecterAPIError && [500, 502, 503].includes(error.statusCode)) {
      console.warn(`Railway failed, falling back to App API`);
      return await apiRequest<T>(appEndpoint, options, authToken, 'app');
    }
    throw error;
  }
}
```
2. Apply to critical data fetching routes

**Success Criteria**:
- App continues working if Railway service is down
- Console shows fallback warnings when triggered
- User experience is seamless

---

## 🧪 TESTING COMMANDS

After implementing each task, run these tests:

```bash
# Terminal 1: Start proxy server
cd /Users/franciscoterpolilli/Projects/specter-mobile
node server.js

# Terminal 2: Start Expo
npm run start

# For native testing:
npm run ios      # or
npm run android

# Verify API connectivity
curl http://localhost:3333/
curl -X GET "http://localhost:3333/proxy/railway/health"
```

---

## 🚨 CRITICAL RULES

1. **NEVER commit secrets** - API keys, JWT tokens, passwords go in `.env.local`
2. **Always use TypeScript** - All new code must be typed
3. **Test on native** - Web localhost has Clerk restrictions (expected)
4. **Follow conventions** - See `AGENTS.md` for coding style
5. **Commit often** - Use conventional commits: `feat:`, `fix:`, `docs:`

---

## 📊 SUCCESS METRICS

All tasks complete when:
- [ ] User can sign in on native iOS/Android
- [ ] All feeds (Companies, People, Investors) populate with data
- [ ] Quick search returns results
- [ ] Company detail shows team members
- [ ] Strategic Intelligence feed works
- [ ] Token renewal happens automatically
- [ ] App gracefully handles Railway outages

---

## 🔗 API Quick Reference

| Route | API | Method | Purpose |
|-------|-----|--------|---------|
| `/quick-search` | Railway | GET | Universal entity search |
| `/companies/{id}/people` | Railway | GET | Company team members |
| `/companies/{id}/department-sizes` | Railway | GET | Department breakdown |
| `/strat-intel` | Railway | POST | Strategic intelligence signals |
| `/signals/company` | App | POST | Company signals feed |
| `/signals/people` | App | POST | People signals feed |
| `/signals/investors` | App | POST | Investor signals feed |

---

**START NOW**: Begin with Task 1 (Authentication), then proceed sequentially. Each task builds on the previous one.
