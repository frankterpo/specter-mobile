# Specter Mobile V1 - QA Status Report

**Date**: 2024-12-28  
**Status**: ✅ **READY FOR QA**  
**Environment**: Latest Codex changes applied

---

## 🎯 Summary of Codex Changes

### ✅ **Major Improvements**

1. **Removed Proxy-Based Sign-In**
   - App now uses **Clerk SDK directly** (`useSignIn`) for authentication
   - No more `/api/get-jwt` or `/api/auth/sign-in` calls from the app
   - Native apps (iOS/Android) authenticate via Clerk's native SDK

2. **Sign-Up Flow Updated**
   - In-app sign-up removed
   - Users redirected to `https://www.tryspecter.com/contact`
   - `/api/create-user` endpoint returns `410 Gone`

3. **JWT Caching & Auto-Renewal**
   - Tokens cached with expiry derived from JWT `exp` claim
   - Automatic renewal when expired (1-hour tokens)
   - Session ID caching for refresh capability

4. **Auth Store Refactored**
   - `devEmail` → `authEmail` (more accurate naming)
   - Added `bootstrapAuth()` for initial auth state check
   - Better session persistence tracking

5. **Server Improvements**
   - Environment variable loading from `.env.local` and `.env`
   - Proper Clerk Frontend API password verification
   - Better error handling and logging

---

## 🚀 Current Server Status

### ✅ **Proxy Server** (localhost:3333)
- **Status**: ✅ Running
- **Log**: `/tmp/specter_proxy_qa.log`
- **Endpoints Available**:
  - `/api/auth/sign-in` - Password verification + JWT minting
  - `/api/auth/refresh-jwt` - Token renewal
  - `/api/get-jwt` - Back-compat (requires password)
  - `/proxy/app/*` - App API proxy
  - `/proxy/railway/*` - Railway API proxy

### ✅ **Expo Dev Server** (localhost:8081)
- **Status**: ✅ Running
- **Process**: PID 29370
- **Web**: http://localhost:8081

---

## 📋 QA Test Checklist

### 1. **App Loading** ✅
- [x] Splash screen displays correctly
- [x] Animation completes (~2.8 seconds)
- [x] Transitions to Sign In screen

**Status**: ✅ **PASSING**

### 2. **Sign In Flow** ⚠️
**Note**: Web localhost has Clerk origin restrictions (expected)

- [ ] **Native (iOS/Android)**:
  - [ ] Open app on device/simulator
  - [ ] Enter email: `francisco@tryspecter.com`
  - [ ] Enter password
  - [ ] Click "Sign In"
  - [ ] Verify successful login
  - [ ] Check console for: `✅ [Auth] Token cached successfully`

- [ ] **Web (localhost - troubleshooting only)**:
  - [ ] Clerk SDK blocked (expected error in console)
  - [ ] Sign In page still shows (fallback works)
  - [ ] Can test UI but auth won't work (Clerk domain restriction)

**Status**: ⚠️ **NEEDS NATIVE TESTING**

### 3. **Sign Up Flow** ✅
- [x] Click "Sign up" link on Sign In page
- [x] Redirects to contact form screen
- [x] "Go to contact form" button works
- [x] "Back to sign in" button works

**Status**: ✅ **PASSING**

### 4. **Token Caching** ⚠️
- [ ] After successful sign-in, check AsyncStorage:
  - [ ] `specter_jwt_token` exists
  - [ ] `specter_jwt_expiry` is set correctly
  - [ ] `specter_auth_email` is set
  - [ ] `specter_auth_session_id` is set (if available)

- [ ] Close and reopen app:
  - [ ] Should use cached token (no re-login required)
  - [ ] Check console for: `🔑 [TokenCache] Using cached JWT`

**Status**: ⚠️ **NEEDS TESTING**

### 5. **Feed Population** ⚠️
- [ ] After sign-in, navigate to feeds:
  - [ ] Companies feed loads data
  - [ ] People feed loads data
  - [ ] Investors feed loads data
  - [ ] No "Not authenticated" errors

- [ ] Check API calls:
  - [ ] Requests include `Authorization: Bearer <JWT>`
  - [ ] Requests include `x-api-key` header
  - [ ] Responses return data (not empty arrays)

**Status**: ⚠️ **NEEDS TESTING**

### 6. **Token Renewal** ⚠️
- [ ] Wait for token to expire (or manually expire in AsyncStorage)
- [ ] Make an API call
- [ ] Verify token is automatically renewed
- [ ] Check console for: `🔑 [API] Using Clerk JWT authentication`

**Status**: ⚠️ **NEEDS TESTING**

### 7. **Sign Out** ⚠️
- [ ] Go to Settings screen
- [ ] Click "Sign Out"
- [ ] Verify:
  - [ ] Token cache cleared
  - [ ] User context cleared
  - [ ] Redirected to Sign In screen
  - [ ] Cannot access feeds without re-login

**Status**: ⚠️ **NEEDS TESTING**

---

## 🔍 Known Issues & Limitations

### 1. **Clerk Domain Restriction (Web Only)**
- **Issue**: Production Clerk keys reject `localhost` origins
- **Impact**: Web localhost cannot authenticate via Clerk SDK
- **Workaround**: Use native devices/simulators for testing
- **Status**: Expected behavior, not a bug

### 2. **Proxy Server Password Sign-In**
- **Issue**: Clerk Frontend API may return "Signed out" or incomplete status
- **Impact**: Proxy `/api/auth/sign-in` may fail
- **Status**: App doesn't use this anymore (native only)

### 3. **Session Persistence**
- **Issue**: If Clerk session expires, cached JWT becomes invalid
- **Impact**: User may need to re-login even with cached token
- **Mitigation**: Token renewal checks Clerk session validity

---

## 📊 File Changes Summary

### Modified Files:
- `server.js` - Environment loading, Clerk Frontend API integration
- `src/screens/SignInScreen.tsx` - Removed proxy sign-in, uses Clerk SDK
- `src/screens/SignUpScreen.tsx` - Redirects to contact form
- `src/hooks/useClerkToken.ts` - Simplified, uses Clerk getToken()
- `src/utils/tokenCache.ts` - Added session ID caching
- `src/utils/jwt.ts` - NEW - JWT parsing utilities
- `src/stores/authStore.ts` - Refactored auth state management
- `src/navigation/MainNavigator.tsx` - Updated auth checking logic

### New Files:
- `src/utils/jwt.ts` - JWT payload parsing

---

## 🧪 Quick Test Commands

```bash
# Check proxy server
curl http://localhost:3333/

# Test proxy sign-in (for troubleshooting)
curl -X POST http://localhost:3333/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"francisco@tryspecter.com","password":"YOUR_PASSWORD"}'

# Check Expo status
curl http://localhost:8081

# View proxy logs
tail -f /tmp/specter_proxy_qa.log
```

---

## ✅ Next Steps

1. **Test on Native Device/Simulator** (iOS or Android)
   - This is the primary target platform
   - Web localhost is troubleshooting-only

2. **Verify Token Caching**
   - Sign in → Close app → Reopen → Should stay signed in

3. **Test Feed Loading**
   - After sign-in, verify all feeds populate with data

4. **Test Sign Out**
   - Verify all auth state is cleared properly

---

## 📝 Notes

- **Web localhost testing**: Limited due to Clerk domain restrictions
- **Native testing**: Full functionality available
- **Proxy server**: Still running for API proxying, but auth is Clerk-native
- **Token expiry**: 1 hour (3600 seconds), auto-renewed when expired

---

**QA Lead**: Ready for native device testing  
**Last Updated**: 2024-12-28
