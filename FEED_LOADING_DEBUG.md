# Why Feeds Aren't Loading - Debug Guide

## Quick Diagnosis

The feeds (Companies/People) may not be loading for several reasons. Here's how to diagnose and fix:

## Common Issues

### 1. **Authentication Required** ⚠️ MOST COMMON

**Problem:** You're not signed in via Clerk.

**Symptoms:**
- Feed shows loading spinner forever
- Error message: "Authentication required. Please sign in again."
- Console shows: `❌ [CompaniesFeed] No token` or `❌ [PeopleFeed] No token`

**Solution:**
1. Make sure you're signed in via the Auth screen
2. Check that Clerk is properly configured with `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in your `.env` file
3. Try signing out and signing back in

**How to Check:**
- Look at the Expo dev server console for authentication logs
- Check if you see `✅ [CompaniesFeed] Token obtained:` in the logs

---

### 2. **Network Connectivity**

**Problem:** Your device can't reach the Railway API.

**Symptoms:**
- Error: "Failed to fetch" or "Network request failed"
- Timeout errors
- Console shows network errors

**Solution:**
1. Ensure your device has internet connectivity
2. If using tunnel mode, check that ngrok is running properly
3. Verify the API endpoints are accessible:
   - `https://specter-api-staging.up.railway.app`
   - `https://app.staging.tryspecter.com`

**How to Check:**
- Try opening the API URL in your device's browser
- Check Expo dev server logs for network errors

---

### 3. **API Endpoint Configuration**

**Problem:** The app is using wrong API URLs.

**How It Works:**
- **On Mobile (Expo):** Uses direct Railway URLs:
  - `https://specter-api-staging.up.railway.app/private/companies`
  - `https://specter-api-staging.up.railway.app/private/people`
- **On Web:** Uses localhost proxy (if running `npm run proxy`)

**Current Configuration:**
```typescript
// src/api/specter.ts
const API_BASE_URL = isWeb 
  ? `${PROXY_BASE}/specter-api` 
  : "https://specter-api-staging.up.railway.app";
```

**This is CORRECT for mobile** - no changes needed.

---

### 4. **API Response Format**

**Problem:** API returns unexpected data structure.

**Symptoms:**
- Feed loads but shows empty list
- Console shows: `📥 [CompaniesFeed] Response received: { itemsCount: 0 }`
- Error: "Cannot read property 'items' of undefined"

**Solution:**
- Check the API response format matches expected structure:
  ```json
  {
    "items": [...],
    "total": 1234,
    "has_more": true
  }
  ```

**How to Check:**
- Look at console logs for `📥 [CompaniesFeed] Response received:`
- Check the actual API response in network tab (if available)

---

### 5. **Error Handling**

**Problem:** Errors are being silently swallowed.

**Symptoms:**
- Feed just shows loading spinner
- No error messages visible
- Console shows errors but UI doesn't update

**Solution:**
- Check the error state in the feed screens
- Look for red error banners at the top of the feed
- Check Expo dev server console for detailed error logs

---

## Debugging Steps

### Step 1: Check Authentication

1. Open the app on your device
2. Make sure you're signed in (check the Auth screen)
3. Look at Expo dev server console for:
   ```
   ✅ [CompaniesFeed] Token obtained: eyJh...
   ```
   OR
   ```
   ❌ [CompaniesFeed] No token: Authentication required...
   ```

### Step 2: Check Network Requests

1. Look at Expo dev server console for API calls:
   ```
   📤 [CompaniesFeed] Calling fetchCompanies { limit: 30, offset: 0 }
   📥 [CompaniesFeed] Response received: { itemsCount: 20, total: 1234 }
   ```

2. If you see errors, check:
   - Network connectivity
   - API endpoint accessibility
   - CORS issues (shouldn't happen on mobile)

### Step 3: Check Error Messages

1. Look for red error banners in the UI
2. Check console for detailed error logs:
   ```
   ❌ [CompaniesFeed] Failed to load companies: [error details]
   ```

### Step 4: Verify API Endpoints

Test the API directly:

```bash
# Test Companies API (requires auth token)
curl -X POST https://specter-api-staging.up.railway.app/private/companies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"limit": 10, "offset": 0}'

# Test People API
curl -X POST https://specter-api-staging.up.railway.app/private/people \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"limit": 10, "offset": 0}'
```

---

## Enhanced Logging

I've added detailed logging to help debug:

- `🔄 [Feed] Starting load...` - Feed load started
- `✅ [Feed] Token obtained` - Authentication successful
- `📤 [Feed] Calling API...` - API request sent
- `📥 [Feed] Response received` - API response received
- `❌ [Feed] Error...` - Error occurred

**Check your Expo dev server console** for these logs when testing.

---

## Quick Fixes

### If "Authentication required" error:
```bash
# Make sure Clerk key is set
echo $EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY

# Restart Expo dev server
npx expo start --tunnel --clear
```

### If "Network request failed":
```bash
# Check internet connectivity
ping specter-api-staging.up.railway.app

# Restart tunnel
npx expo start --tunnel --clear
```

### If feed loads but is empty:
- Check API response in console logs
- Verify API is returning data
- Check filters aren't excluding all items

---

## Still Not Working?

1. **Check Expo Dev Server Console** - Look for error messages
2. **Check Device Logs** - Use React Native Debugger or Flipper
3. **Test API Directly** - Use curl or Postman to verify API works
4. **Check Environment Variables** - Ensure Clerk key is set
5. **Verify Network** - Ensure device can reach Railway API

---

## Expected Behavior

When everything works correctly, you should see:

1. **On App Load:**
   ```
   🔄 [CompaniesFeed] Starting loadCompanies { refresh: true }
   ✅ [CompaniesFeed] Token obtained: eyJh...
   📤 [CompaniesFeed] Calling fetchCompanies { limit: 30, offset: 0 }
   📥 [CompaniesFeed] Response received: { itemsCount: 30, total: 1234, hasMore: true }
   ```

2. **In UI:**
   - Loading spinner appears briefly
   - Companies/People cards appear
   - Total count shows in header
   - Pull-to-refresh works
   - Infinite scroll loads more items

---

## Need More Help?

Check these files for implementation details:
- `src/api/specter.ts` - API service functions
- `src/screens/CompaniesFeedScreen.tsx` - Companies feed implementation
- `src/screens/PeopleFeedScreen.tsx` - People feed implementation

