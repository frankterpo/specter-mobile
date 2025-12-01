# Clear Auth Data - Manual Instructions

If you're stuck and can't sign out, here are manual ways to clear authentication:

## Option 1: Use Force Logout in App

1. Go to **Settings** tab
2. Scroll to bottom
3. Tap **"Force Logout (Clear All Data)"**
4. Confirm
5. Close and reopen the app
6. Sign in again

## Option 2: Clear App Data (Android)

If Force Logout doesn't work:

1. Go to Android Settings
2. Apps → Find "Expo Go" or your app name
3. Storage → Clear Data
4. Reopen app and sign in

## Option 3: Uninstall and Reinstall

1. Uninstall the app
2. Reinstall from Expo
3. Sign in fresh

## Option 4: Check Console Logs

Look for these logs when trying to sign out:

```
🚪 [Settings] Starting sign out...
✅ [Settings] Clerk signOut() completed
✅ [Settings] Cleared __clerk_client_jwt
✅ [Settings] All Clerk keys cleared from SecureStore
✅ [Settings] Sign out process completed
```

If you see errors, share them for debugging.

