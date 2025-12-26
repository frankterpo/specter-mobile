# Specter Mobile - Team Build Instructions

## Prerequisites

1. **EAS CLI Installed:**
   ```bash
   npm install -g eas-cli
   ```

2. **EAS Account Setup:**
   ```bash
   eas login
   ```

3. **Project Linked:**
   ```bash
   eas build:configure
   ```

4. **API Key Configured:**
   - Add `EXPO_PUBLIC_SPECTER_API_KEY` to your EAS secrets or `.env.local`
   - The `eas.json` file already includes environment variable placeholders

## Development Builds

### iOS Development Build

```bash
# Build for iOS Simulator (faster, for local testing)
eas build --platform ios --profile development

# Build for physical iOS devices (requires Apple Developer account)
eas build --platform ios --profile development --non-interactive
```

**Requirements:**
- Apple Developer account ($99/year)
- Device UDIDs registered in Apple Developer portal (for physical devices)
- Valid provisioning profile

**Distribution:**
- EAS provides a shareable link
- Team members install via link (TestFlight not required for development builds)
- Simulator builds can be downloaded directly

### Android Development Build

```bash
# Build for Android (APK for direct install)
eas build --platform android --profile development
```

**Requirements:**
- Google Play Console account (free)
- No device registration needed (APK can be installed directly)

**Distribution:**
- EAS provides direct APK download link
- Team members download and install APK
- No Play Store required for development builds

## Production Builds

### iOS Production Build

```bash
eas build --platform ios --profile production
```

**Requirements:**
- Apple Developer account
- App Store Connect app created
- Valid certificates and provisioning profiles

### Android Production Build

```bash
eas build --platform android --profile production
```

**Requirements:**
- Google Play Console account
- Play Store app created
- Signing key configured

### One-Command Deployment

```bash
# Build and submit to both stores
eas build --platform all --profile production --auto-submit
```

## Environment Variables

The `eas.json` file includes environment variables for all profiles:

```json
{
  "build": {
    "development": {
      "env": {
        "EXPO_PUBLIC_SPECTER_API_KEY": "",
        "EXPO_PUBLIC_SPECTER_API_URL": "https://app.tryspecter.com/api/__public/v1"
      }
    },
    "preview": {
      "env": {
        "EXPO_PUBLIC_SPECTER_API_KEY": "",
        "EXPO_PUBLIC_SPECTER_API_URL": "https://app.tryspecter.com/api/__public/v1"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_SPECTER_API_KEY": "",
        "EXPO_PUBLIC_SPECTER_API_URL": "https://app.tryspecter.com/api/__public/v1"
      }
    }
  }
}
```

**To add API key:**
1. Use EAS secrets (recommended):
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_SPECTER_API_KEY --value your_api_key
   ```

2. Or update `eas.json` directly (less secure):
   - Replace empty strings with your actual API key
   - **Warning**: Don't commit API keys to git!

## Build Status

Check build status:
```bash
eas build:list
```

View build logs:
```bash
eas build:view [build-id]
```

## Team Distribution Workflow

### Recommended Flow

1. **Local Development:**
   ```bash
   npx expo start --dev-client
   ```

2. **Local Testing:**
   ```bash
   npx expo run:ios    # iOS Simulator
   npx expo run:android  # Android Emulator
   ```

3. **Team Testing:**
   ```bash
   eas build --platform ios --profile development
   eas build --platform android --profile development
   ```

4. **Production:**
   ```bash
   eas build --platform all --profile production --auto-submit
   ```

## Troubleshooting

### Build Fails: Missing API Key
**Solution**: Add API key to EAS secrets or update `eas.json`

### iOS Build Fails: Provisioning Profile
**Solution**: Run `eas build:configure` to regenerate profiles

### Android Build Fails: Signing Key
**Solution**: EAS will generate signing key automatically on first build

### Build Takes Too Long
**Solution**: 
- Use `--local` flag for faster builds (requires local setup)
- Development builds are faster than production builds

## Additional Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [Environment Variables Guide](https://docs.expo.dev/build-reference/variables/)

