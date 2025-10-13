#!/usr/bin/env node
/**
 * Get a fresh Clerk token for testing
 * Uses Clerk's publishable key to get a session token
 */

const https = require('https');

// From your .env file
const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  console.error("❌ No CLERK_PUBLISHABLE_KEY found in environment");
  console.log("\nThe key should be in your .env file:");
  console.log("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...");
  process.exit(1);
}

console.log("🔑 Attempting to get Clerk token...");
console.log(`   Using key: ${CLERK_PUBLISHABLE_KEY.substring(0, 20)}...`);

// Extract domain from publishable key
const keyParts = CLERK_PUBLISHABLE_KEY.split('.');
if (keyParts.length < 2) {
  console.error("❌ Invalid publishable key format");
  process.exit(1);
}

const clerkDomain = keyParts.slice(1).join('.');
console.log(`   Clerk domain: ${clerkDomain}`);

console.log("\n⚠️  Note: To get a valid token, you need to:");
console.log("1. Already be signed in through the browser/app");
console.log("2. Use the browser's session");
console.log("\nClerk tokens are session-based and require user authentication.");
console.log("The token from the browser console is the correct approach.\n");

console.log("📋 INSTRUCTIONS:");
console.log("════════════════════════════════════════════════════════");
console.log("1. Open http://localhost:8084 in your browser");
console.log("2. Sign in with Clerk");
console.log("3. Open Console (F12)");
console.log("4. Type: await clerk.session.getToken()");
console.log("5. Copy the returned token");
console.log("6. Run: CLERK_TEST_TOKEN='token' node test-api-v2.js");
console.log("════════════════════════════════════════════════════════\n");

