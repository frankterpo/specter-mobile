#!/bin/bash

echo "🤖 Setting up Android Emulator for Specter Mobile API Testing"
echo "=========================================================="

# Check if emulator exists
if ! emulator -list-avds | grep -q "specter_test"; then
    echo "📱 Creating Android emulator 'specter_test'..."
    echo "no" | avdmanager create avd -n specter_test -k "system-images;android-34;google_apis;x86_64"
fi

echo "🚀 Starting Android emulator..."
emulator -avd specter_test -no-audio -no-window &

echo "⏳ Waiting for emulator to boot..."
sleep 30

echo "📱 Emulator should be running!"
echo "🌐 Run 'npm start' and press 'a' to open in Android emulator"
echo ""
echo "💻 Once app is running:"
echo "1. Sign in to Clerk"
echo "2. Go to 'API Test' tab (5th tab)"  
echo "3. Use terminal commands like:"
echo "   • help (show commands)"
echo "   • test people (test people endpoint)"
echo "   • test companies (test companies endpoint)"
echo "   • test (test all endpoints)"
echo ""
echo "🎯 The API testing screen will show:"
echo "• Real-time terminal output"
echo "• JWT authentication status"
echo "• Quick action buttons for each endpoint"
echo "• Command-line interface for advanced testing"
