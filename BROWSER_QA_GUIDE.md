# Browser QA Testing Guide

## 🌐 How to Test in Browser

### Step 1: Start the Development Server

```bash
npx expo start --web
```

This will start Expo in web mode and open your browser automatically.

### Step 2: Access the App

The app will be available at:
```
http://localhost:8081
```

Or it may use port 19006:
```
http://localhost:19006
```

### Step 3: Open Diagnostics Dashboard

Once logged in, look for the **red bug icon (🐛)** in the top right corner of the SwipeDeck screen. Click it to open the Diagnostics Dashboard.

## 🔬 Diagnostics Dashboard Features

### Real-Time Logging
- **Auto-refresh**: Logs update every second
- **Color-coded**: Errors (red), Warnings (yellow), Info (blue)
- **Categorized**: API, AUTH, LOAD_PEOPLE, ACTION, etc.

### Stats Display
- Total log count
- Error count
- Warning count
- Authentication status (✓ signed in / ✗ signed out)

### Filtering
- **All**: Show all logs
- **Error**: Show only errors
- **Warn**: Show only warnings
- **Info**: Show only info messages
- **🔄 Button**: Toggle auto-refresh on/off

### Export Logs
Click the **share icon** to export all logs as JSON. This includes:
- All log entries with timestamps
- User ID and auth status
- Summary statistics

## 📊 What to Monitor

### During Login
Look for:
- `AUTH` category logs
- "Token obtained" success message
- Any authentication errors

### During Profile Loading
Look for:
- `LOAD_PEOPLE` logs showing offset and replace status
- `API` logs showing request/response details
- Duplicate detection logs
- Card count after deduplication

### During Swipe Actions
Look for:
- `ACTION` logs for Like/Dislike/Pass
- Previous status vs new status
- API call success/failure

### Common Issues to Watch For

1. **Infinite Loading Loop**
   - Check if `LOAD_PEOPLE` is called repeatedly with the same offset
   - Look for duplicate person IDs in the logs

2. **API Errors**
   - 401/403: Authentication expired
   - 404: Endpoint not found
   - 500: Server error
   - Network errors: Internet/API down

3. **Filter Issues**
   - Check API logs for filter payload
   - Verify filters are being sent correctly

4. **Rendering Errors**
   - Look for "Card render error" messages
   - Check for null/undefined data issues

## 🐛 Debugging Workflow

### Step 1: Reproduce the Issue
1. Perform the action that causes the problem
2. Immediately switch to Diagnostics screen

### Step 2: Review Recent Logs
- Filter by "Error" to see only failures
- Look at the timestamp to find relevant logs
- Check the data payload for clues

### Step 3: Export and Share
- Click the share icon
- Copy the JSON output
- Share with developer for analysis

## 📱 Browser vs Mobile Differences

### Works in Browser:
- ✅ All core functionality
- ✅ API calls
- ✅ Authentication (Clerk)
- ✅ Navigation
- ✅ Filters
- ✅ Status tracking

### May behave differently:
- ⚠️ Swipe gestures (use buttons instead)
- ⚠️ Haptic feedback (not available)
- ⚠️ Performance (slower than native)

### Browser Keyboard Shortcuts:
- **Cmd/Ctrl + R**: Reload app
- **Cmd/Ctrl + Shift + R**: Hard reload (clear cache)
- **F12**: Open browser DevTools (additional logging)

## 🔍 Advanced Debugging

### Browser Console
Open browser DevTools (F12) and go to Console tab to see:
- Network requests (XHR/Fetch)
- React warnings
- JavaScript errors
- All logger output

### Network Tab
In DevTools > Network tab, monitor:
- API calls to specter-api-staging.up.railway.app
- Request/response headers
- Response body
- Request timing

### React DevTools
Install React DevTools extension to:
- Inspect component state
- View props
- Track re-renders

## 📝 Log Categories Explained

| Category | What it tracks |
|----------|---------------|
| `AUTH` | Clerk authentication, token requests |
| `LOAD_PEOPLE` | Profile fetching, pagination |
| `API` | API calls, responses, errors |
| `ACTION` | User actions (like, dislike, pass) |
| `FILTER` | Filter application, changes |
| `NAVIGATION` | Screen transitions |

## 🚨 Critical Errors to Report

If you see these, export logs immediately:

1. **"Authentication expired"** - Token refresh failed
2. **"Invalid server response"** - API returned bad data
3. **"Card render error"** - Component crashed
4. **Repeated API calls with same offset** - Infinite loop
5. **"No token received"** - Clerk auth broken

## ✅ Success Indicators

Healthy app logs should show:

1. Successful auth: `AUTH: Token obtained`
2. Progressive loading: `LOAD_PEOPLE` with increasing offsets (0, 50, 100...)
3. No duplicate IDs: Deduplication should filter out 0-1 duplicates, not many
4. Actions persisting: After Like, status should remain "liked"

## 🎯 Test Scenarios

### Scenario 1: Fresh Login
1. Open app → Sign in
2. Check Diagnostics:
   - AUTH logs successful?
   - LOAD_PEOPLE called with offset=0?
   - 50 profiles loaded?

### Scenario 2: Infinite Scroll
1. Swipe through 25 profiles (halfway)
2. Check Diagnostics:
   - LOAD_PEOPLE called with offset=50?
   - New profiles appended (not replaced)?
   - No duplicate IDs?

### Scenario 3: Filter Application
1. Open filter modal
2. Apply filters (e.g., Seniority: Executive)
3. Check Diagnostics:
   - LOAD_PEOPLE called with replace=true?
   - API logs show filter in request?
   - Cards reset to index 0?

### Scenario 4: Status Persistence
1. Like a profile
2. View profile details
3. Go back
4. Check Diagnostics:
   - ACTION log for like?
   - Status remains "liked"?
   - Badge visible on card?

## 📤 Exporting for Developer

When reporting issues:

1. Click share icon in Diagnostics
2. Copy the JSON
3. Include:
   - What you were doing when it broke
   - Expected behavior vs actual behavior
   - Screenshot if visual issue
   - Exported logs JSON

Example report:
```
Issue: Profiles loop after swiping 10 times
Expected: Should load new profiles at position 25
Actual: Shows same 10 profiles repeatedly

Steps to reproduce:
1. Login
2. Swipe right 10 times
3. Swipe right 10 more times
4. See same profiles again

Exported logs: [paste JSON here]
```

