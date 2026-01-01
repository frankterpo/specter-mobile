# Specter Mobile V1 - Codex Agent Technical Directions

**Priority: CRITICAL - Mobile V1 Must Work**

> 📚 **Related Documentation:**
> - [`API_ROUTES_CODEX.md`](./API_ROUTES_CODEX.md) - Complete API routes reference for Railway (private) and App APIs

## Executive Summary

This document provides all technical context and blockers for achieving a working Specter Mobile V1. The four critical requirements are:

1. ✅ Load app (Working with fallbacks)
2. ⚠️ Sign in app (Partially working - needs session bootstrap)
3. ❌ Get auth/credentials via Clerk (MAIN BLOCKER)
4. ⚠️ Ping database to populate feeds (Works when auth is valid)

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SPECTER MOBILE APP                           │
│  (React Native + Expo, runs on localhost:8081)                  │
├─────────────────────────────────────────────────────────────────┤
│  Clerk Provider (pk_live_*)  →  BLOCKED ON LOCALHOST            │
│  - useAuth() returns isLoaded=true BUT isSignedIn=undefined     │
│  - Production keys reject requests from localhost origin        │
├─────────────────────────────────────────────────────────────────┤
│  Local Proxy Server (localhost:3333)                            │
│  - /api/get-jwt → Uses CLERK_SECRET to generate JWT             │
│  - /proxy/app/* → Routes to https://app.tryspecter.com/api      │
│  - /proxy/railway/* → Routes to Railway API                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND APIS                                  │
├─────────────────────────────────────────────────────────────────┤
│  App API:     https://app.tryspecter.com/api (23 endpoints)     │
│  Railway API: https://specter-api-prod.up.railway.app (14)      │
│  Clerk API:   https://api.clerk.com (Backend API - BAPI)        │
└─────────────────────────────────────────────────────────────────┘
```

---

## BLOCKER #1: Clerk Domain Restriction (CRITICAL)

### The Problem
```
Clerk: Production Keys are only allowed for domain "tryspecter.com".
API Error: The Request HTTP Origin header must be equal to or a subdomain of the requesting URL.
```

**Root Cause**: Clerk's production publishable key (`pk_live_*`) is restricted to `tryspecter.com` domains. When running on `localhost:8081`, Clerk's frontend SDK cannot initialize sessions.

### Current Workaround (Partial)
The local proxy (`server.js`) uses `CLERK_SECRET` to:
1. Look up user by email via Backend API
2. Find any existing active session for that user
3. Generate a JWT from that session

**PROBLEM**: If the user has NO active Clerk session (never logged into app.tryspecter.com), this fails with:
```json
{"error": "No active Clerk session found. Please login to app.tryspecter.com once to initialize."}
```

### Required Fix
We need ONE of these solutions:

#### Option A: Create Session Without Browser (Recommended)
Use Clerk's sign-in tokens to create a programmatic session:
```javascript
// In server.js /api/get-jwt
// Step 1: Verify password using Clerk's verify endpoint (if available) or skip
// Step 2: Create a sign-in token
const sitRes = await fetch(CLERK_API + '/v1/sign_in_tokens', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + CLERK_SECRET, 'Content-Type': 'application/json' },
  body: JSON.stringify({ user_id: userId, expires_in_seconds: 3600 })
});

// Step 3: Create session from sign-in token
const tokenUrl = `https://clerk.tryspecter.com/v1/client/sign_in_tokens/${sitData.token}`;
// Note: This requires client-side completion OR using session creation endpoint
```

#### Option B: Use Clerk Development Keys
Get Clerk development/test keys that work on localhost:
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_*`
- These allow localhost origins

#### Option C: Bypass Clerk Entirely for Dev Mode
Generate a mock JWT that the backend accepts for development:
```javascript
// If SPECTER_DEV_MODE=true, backend accepts x-api-key only without JWT
headers.set("x-api-key", "iJXZPM060qU32m0UKCSfrtIVFzSt09La");
// Skip Authorization header entirely
```

---

## BLOCKER #2: Session Persistence Issues

### The Problem
When a user logs in via the proxy, the `devEmail` is stored in AsyncStorage. On subsequent app loads, the app sees `devEmail` and assumes the user is logged in, but the JWT may be expired or never fetched.

### Current Files Involved
- `src/stores/authStore.ts` - Stores `devEmail` in AsyncStorage
- `src/stores/userStore.ts` - Stores `userContext` with userId, apiKey
- `src/navigation/MainNavigator.tsx` - Checks `devEmail` to determine `isSignedIn`
- `src/hooks/useClerkToken.ts` - Fetches token from proxy using stored email

### Required Fix
The `useClerkToken` hook should:
1. Always try to get a fresh token on app load (not just when making API calls)
2. Clear `devEmail` and `userContext` if token fetch fails
3. Cache the token with expiry tracking

```typescript
// In useClerkToken.ts
const getAuthToken = async (): Promise<string | null> => {
  // Check for cached token with valid expiry first
  const cachedToken = await AsyncStorage.getItem("specter_jwt_token");
  const cachedExpiry = await AsyncStorage.getItem("specter_jwt_expiry");
  
  if (cachedToken && cachedExpiry && Date.now() < parseInt(cachedExpiry)) {
    return cachedToken;
  }
  
  // Otherwise fetch new token...
  const response = await fetch("http://localhost:3333/api/get-jwt", {...});
  // Cache with expiry
  await AsyncStorage.setItem("specter_jwt_token", data.jwt);
  await AsyncStorage.setItem("specter_jwt_expiry", (Date.now() + 55 * 60 * 1000).toString());
};
```

---

## BLOCKER #3: Empty Feeds Due to Auth Failures

### The Problem
When feeds show empty or "Not authenticated" errors, it's because:
1. No valid JWT token is available
2. The x-api-key is missing or invalid
3. The proxy is not running

### Current API Flow
```
Feed Screen → useSignals() → useClerkToken().getAuthToken() → specterPublicAPI.*()
                                    │
                                    ▼
                            [If token is null] → AuthError thrown → Empty feed
```

### Debug Checklist
1. Is proxy running? `node server.js` → Should see "🔬 SPECTER API TESTER"
2. Is token valid? Check console for `🔑 [API] Using Clerk JWT authentication`
3. API responding? Visit http://localhost:3333 and test endpoints

### Required Fix
Ensure every API call has a valid token before proceeding:
```typescript
// In client.ts apiRequest()
if (!authToken || authToken === 'undefined' || authToken === 'null') {
  console.error('[API] No valid auth token - redirecting to login');
  throw new AuthError("Please sign in to continue");
}
```

---

## File Reference Map

### Authentication Flow
| File | Purpose |
|------|---------|
| `server.js` | Local proxy with JWT generation |
| `src/stores/authStore.ts` | Dev email persistence (Zustand) |
| `src/stores/userStore.ts` | User context with apiKey |
| `src/hooks/useClerkToken.ts` | Token retrieval hook |
| `src/navigation/MainNavigator.tsx` | Auth state checking |
| `src/screens/SignInScreen.tsx` | Login UI and logic |
| `src/screens/SignUpScreen.tsx` | Registration UI and logic |

### API Client
| File | Purpose |
|------|---------|
| `src/api/public-client/client.ts` | Main API client with all endpoints |
| `src/hooks/useSignals.ts` | React Query hooks for feeds |
| `src/hooks/useMutations.ts` | Optimistic updates for like/dislike |

### Key Constants
```javascript
// In server.js
const CLERK_SECRET = process.env.CLERK_SECRET_KEY;
const RAILWAY_API = "https://specter-api-prod.up.railway.app";
const APP_API = "https://app.tryspecter.com/api";

// In client.ts
const PROXY_BASE = "http://localhost:3333/proxy/app";
const defaultApiKey = "iJXZPM060qU32m0UKCSfrtIVFzSt09La";
```

---

## Step-by-Step Fix Implementation

### Step 1: Fix JWT Generation Without Browser Session

Modify `server.js` `/api/get-jwt` to create sessions programmatically:

```javascript
// After getting user by email, if no active session exists:
if (!jwt) {
  console.log(`⚠️ [Auth] No active session, creating one programmatically...`);
  
  // Create a new session directly using Clerk BAPI
  // Note: This may require Clerk plan that supports programmatic session creation
  const createSessionRes = await fetch(CLERK_API + '/v1/sessions', {
    method: 'POST',
    headers: { 
      'Authorization': 'Bearer ' + CLERK_SECRET, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({ user_id: userId })
  });
  
  if (createSessionRes.ok) {
    const newSession = await createSessionRes.json();
    // Now get token from new session
    const tokenRes = await fetch(CLERK_API + '/v1/sessions/' + newSession.id + '/tokens', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + CLERK_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expires_in_seconds: 3600 })
    });
    
    if (tokenRes.ok) {
      const tokenData = await tokenRes.json();
      jwt = tokenData.jwt;
    }
  }
}
```

### Step 2: Add Token Caching with Expiry

Create `src/utils/tokenCache.ts`:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'specter_jwt_token';
const EXPIRY_KEY = 'specter_jwt_expiry';

export async function getCachedToken(): Promise<string | null> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const expiry = await AsyncStorage.getItem(EXPIRY_KEY);
  
  if (token && expiry && Date.now() < parseInt(expiry)) {
    return token;
  }
  return null;
}

export async function cacheToken(token: string, expiresInMs: number = 55 * 60 * 1000) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(EXPIRY_KEY, (Date.now() + expiresInMs).toString());
}

export async function clearTokenCache() {
  await AsyncStorage.multiRemove([TOKEN_KEY, EXPIRY_KEY]);
}
```

### Step 3: Update useClerkToken to Use Cache

```typescript
import { getCachedToken, cacheToken, clearTokenCache } from '../utils/tokenCache';

export function useClerkToken() {
  const getAuthToken = async (): Promise<string | null> => {
    // 1. Check cache first
    const cached = await getCachedToken();
    if (cached) {
      console.log('🔑 [API] Using cached JWT');
      return cached;
    }
    
    // 2. Try Clerk SDK
    // ...existing code...
    
    // 3. Try proxy
    const response = await fetch("http://localhost:3333/api/get-jwt", {...});
    if (response.ok) {
      const data = await response.json();
      if (data.jwt) {
        await cacheToken(data.jwt);
        return data.jwt;
      }
    }
    
    return null;
  };
  
  return { getAuthToken, clearTokenCache };
}
```

### Step 4: Add Proper Error Boundaries

Wrap feed screens to catch auth errors and redirect:
```typescript
// In each feed screen
const { data, error, isLoading } = useSignals('COMPANY', filters);

useEffect(() => {
  if (error?.message?.includes('Authentication')) {
    // Clear auth state and redirect to login
    clearDevEmail();
    clearUserContext();
    navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
  }
}, [error]);
```

---

## Testing Commands

```bash
# Terminal 1: Start proxy
cd /Users/franciscoterpolilli/Projects/specter-mobile
node server.js

# Terminal 2: Start Expo web
cd /Users/franciscoterpolilli/Projects/specter-mobile
npx expo start --web

# Browser: Test login
http://localhost:8081?logout=1  # Force logout first
# Then sign in with valid Specter credentials

# Test API directly
curl -X POST http://localhost:3333/api/get-jwt \
  -H "Content-Type: application/json" \
  -d '{"email":"francisco@tryspecter.com"}'
```

---

## Environment Variables Required

```bash
# .env.local (must exist in project root)
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsudHJ5c3BlY3Rlci5jb20k
CLERK_SECRET_KEY=<set_in_.env.local_do_not_commit>
EXPO_PUBLIC_SPECTER_API_KEY=iJXZPM060qU32m0UKCSfrtIVFzSt09La
EXPO_PUBLIC_SPECTER_API_URL=https://app.tryspecter.com/api
```

---

## Success Criteria

The mobile app V1 is considered WORKING when:

1. ✅ **App Loads**: Splash screen completes, shows Sign In or Main App
2. ✅ **Sign In Works**: User enters email/password, gets authenticated
3. ✅ **JWT Generated**: Proxy returns valid JWT token
4. ✅ **Feeds Populate**: Companies, People, Investors show real data
5. ✅ **Actions Work**: Like/Dislike/View update correctly
6. ✅ **Session Persists**: Refreshing page doesn't require re-login

---

## Quick Debug Commands

```javascript
// In browser console at localhost:8081

// Check stored auth state
localStorage.getItem('specter_dev_email')
localStorage.getItem('specter_jwt_token')

// Clear all auth (force fresh login)
localStorage.clear()
location.reload()

// Check console logs for:
// "🔑 [API] Using Clerk JWT authentication" → Good
// "🛠️ [API] Fetching dev token..." → Fallback mode
// "❌ [API] Dev fallback token retrieval failed" → Problem!
```

---

## Contact Points

- **Clerk Dashboard**: https://dashboard.clerk.com
- **App API Docs**: https://specter-api-prod.up.railway.app/docs
- **Local Proxy Test**: http://localhost:3333

---

*Last Updated: 2024-12-28*
*Priority: P0 - Mobile V1 Launch Blocker*
