#!/usr/bin/env node
/**
 * API Test Script - Tests Specter API endpoints with Clerk authentication
 * Run: node test-api.js
 */

const https = require('https');

// You need to provide a valid Clerk token
// Get it from: https://dashboard.clerk.com or from the app after login
const CLERK_TOKEN = process.env.CLERK_TEST_TOKEN || "YOUR_TOKEN_HERE";

console.log("🚀 Testing Specter API...\n");

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      console.log(`📊 Response Status: ${res.statusCode}`);
      console.log(`📊 Response Headers:`, JSON.stringify(res.headers, null, 2));
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function testFetchPeople() {
  console.log("\n╔═══════════════════════════════════════════════╗");
  console.log("║  TEST 1: Fetch People (POST /private/people) ║");
  console.log("╚═══════════════════════════════════════════════╝\n");
  
  const options = {
    hostname: 'specter-api-staging.up.railway.app',
    port: 443,
    path: '/private/people',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLERK_TOKEN}`,
    },
  };
  
  const body = {
    limit: 10,
    offset: 0,
  };
  
  console.log("📤 Request:");
  console.log(`   URL: https://${options.hostname}${options.path}`);
  console.log(`   Method: ${options.method}`);
  console.log(`   Body:`, JSON.stringify(body, null, 2));
  console.log(`   Token: ${CLERK_TOKEN.substring(0, 30)}...`);
  
  try {
    const result = await makeRequest(options, body);
    
    if (result.status === 200) {
      console.log("\n✅ SUCCESS!");
      console.log(`📥 Received ${result.data.items?.length || 0} people`);
      if (result.data.items?.[0]) {
        console.log("\n📝 First person:");
        console.log(`   Name: ${result.data.items[0].full_name}`);
        console.log(`   ID: ${result.data.items[0].id}`);
        console.log(`   Seniority: ${result.data.items[0].seniority}`);
        console.log(`   Region: ${result.data.items[0].region}`);
      }
    } else {
      console.log("\n❌ FAILED!");
      console.log("Response:", JSON.stringify(result.data, null, 2));
    }
    
    return result;
  } catch (error) {
    console.log("\n❌ ERROR!");
    console.log(error);
    return null;
  }
}

async function testLikePerson(personId) {
  console.log("\n╔═══════════════════════════════════════════════╗");
  console.log("║  TEST 2: Like Person (Entity Status API)     ║");
  console.log("╚═══════════════════════════════════════════════╝\n");
  
  const options = {
    hostname: 'app.staging.tryspecter.com',
    port: 443,
    path: `/api/entity-status/people/${personId}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLERK_TOKEN}`,
    },
  };
  
  const body = {
    status: "liked",
  };
  
  console.log("📤 Request:");
  console.log(`   URL: https://${options.hostname}${options.path}`);
  console.log(`   Method: ${options.method}`);
  console.log(`   Body:`, JSON.stringify(body, null, 2));
  
  try {
    const result = await makeRequest(options, body);
    
    if (result.status === 200 || result.status === 201) {
      console.log("\n✅ SUCCESS! Person liked");
    } else {
      console.log("\n❌ FAILED!");
      console.log("Response:", JSON.stringify(result.data, null, 2));
    }
    
    return result;
  } catch (error) {
    console.log("\n❌ ERROR!");
    console.log(error);
    return null;
  }
}

async function runAllTests() {
  console.log("\n" + "=".repeat(50));
  console.log("  SPECTER API TEST SUITE");
  console.log("=".repeat(50));
  
  if (CLERK_TOKEN === "YOUR_TOKEN_HERE") {
    console.log("\n❌ ERROR: No Clerk token provided!");
    console.log("\nTo get a token:");
    console.log("1. Run the app: npx expo start");
    console.log("2. Sign in with Clerk");
    console.log("3. Open browser console");
    console.log("4. Look for: 🚨 TOKEN OBTAINED: eyJh...");
    console.log("5. Copy that token");
    console.log("6. Run: CLERK_TEST_TOKEN='your_token' node test-api.js");
    return;
  }
  
  // Test 1: Fetch people
  const peopleResult = await testFetchPeople();
  
  if (peopleResult && peopleResult.data.items?.[0]) {
    // Test 2: Like first person
    await testLikePerson(peopleResult.data.items[0].id);
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("  TESTS COMPLETED");
  console.log("=".repeat(50) + "\n");
}

runAllTests();

