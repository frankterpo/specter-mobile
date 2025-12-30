#!/bin/bash
echo "🔧 Setting up Specter Mobile workspace..."

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

echo "📦 Installing Expo CLI..."
npm install expo

# Fix index.ts (remove global.css import if it exists)
echo "🔧 Fixing index.ts (removing global.css import)..."
sed -i '' '/import "\.\/global\.css";/d' index.ts

# Ensure .env.local exists with Clerk keys
echo "🔐 Setting up environment variables..."
if [ ! -f .env.local ]; then
  echo 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsudHJ5c3BlY3Rlci5jb20k' > .env.local
  echo 'EXPO_PUBLIC_CLERK_DOMAIN=https://clerk.tryspecter.com' >> .env.local
  echo "✅ Created .env.local with Clerk keys"
else
  echo "✅ .env.local already exists"
fi

# Verify setup
echo "🔍 Verifying setup..."
if grep -q "global.css" index.ts; then
  echo "❌ ERROR: global.css import still exists in index.ts"
  exit 1
else
  echo "✅ index.ts is clean (no global.css import)"
fi

if command -v npx expo &> /dev/null; then
  echo "✅ Expo CLI is available"
else
  echo "❌ ERROR: Expo CLI not found"
  exit 1
fi

echo ""
echo "🎉 Workspace setup complete!"
echo ""
echo "🚀 Next: Run 'npx expo start --web' to test"
echo "📱 Or run 'npx expo start' and press 's' for Expo Go"
