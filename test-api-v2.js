#!/usr/bin/env node
/**
 * API Test Script V2 - Tests both Railway and Staging endpoints
 */

const https = require('https');

const CLERK_TOKEN = process.env.CLERK_TEST_TOKEN || "YOUR_TOKEN_HERE";

console.log("🚀 Testing Specter API (Both Endpoints)...\n");

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
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

async function testRailwayAPI() {
  console.log("\n╔═══════════════════════════════════════════════════╗");
  console.log("║  TEST 1: Railway API (specter-api-staging)       ║");
  console.log("╚═══════════════════════════════════════════════════╝\n");
  
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
  
  const body = { limit: 10, offset: 0 };
  
  console.log(`📤 POST https://${options.hostname}${options.path}`);
  
  try {
    const result = await makeRequest(options, body);
    console.log(`📊 Status: ${result.status}`);
    
    if (result.status === 200) {
      console.log(`✅ SUCCESS! Received ${result.data.items?.length || 0} people`);
      return result.data;
    } else {
      console.log(`❌ FAILED: ${JSON.stringify(result.data)}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return null;
  }
}

async function testStagingAPI() {
  console.log("\n╔═══════════════════════════════════════════════════╗");
  console.log("║  TEST 2: Staging API (app.staging.tryspecter)    ║");
  console.log("╚═══════════════════════════════════════════════════╝\n");
  
  const options = {
    hostname: 'app.staging.tryspecter.com',
    port: 443,
    path: '/api/specter/private/people',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLERK_TOKEN}`,
    },
  };
  
  const body = { limit: 10, offset: 0 };
  
  console.log(`📤 POST https://${options.hostname}${options.path}`);
  
  try {
    const result = await makeRequest(options, body);
    console.log(`📊 Status: ${result.status}`);
    
    if (result.status === 200) {
      console.log(`✅ SUCCESS! Received ${result.data.items?.length || 0} people`);
      if (result.data.items?.[0]) {
        console.log(`\n📝 First person:`);
        console.log(`   Name: ${result.data.items[0].full_name}`);
        console.log(`   ID: ${result.data.items[0].id}`);
        console.log(`   Seniority: ${result.data.items[0].seniority || 'N/A'}`);
      }
      return result.data;
    } else {
      console.log(`❌ FAILED: ${JSON.stringify(result.data)}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return null;
  }
}

async function testEntityStatusAPI(personId) {
  console.log("\n╔═══════════════════════════════════════════════════╗");
  console.log("║  TEST 3: Entity Status API (Like Person)         ║");
  console.log("╚═══════════════════════════════════════════════════╝\n");
  
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
  
  const body = { status: "liked" };
  
  console.log(`📤 POST https://${options.hostname}${options.path}`);
  console.log(`   Body: ${JSON.stringify(body)}`);
  
  try {
    const result = await makeRequest(options, body);
    console.log(`📊 Status: ${result.status}`);
    
    if (result.status === 200 || result.status === 201 || result.status === 204) {
      console.log(`✅ SUCCESS! Person liked`);
      return true;
    } else {
      console.log(`❌ FAILED: ${JSON.stringify(result.data)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log("\n" + "=".repeat(60));
  console.log("  SPECTER API COMPREHENSIVE TEST");
  console.log("=".repeat(60));
  
  if (CLERK_TOKEN === "YOUR_TOKEN_HERE") {
    console.log("\n❌ ERROR: No Clerk token provided!");
    console.log("Run: CLERK_TEST_TOKEN='your_token' node test-api-v2.js");
    return;
  }
  
  console.log(`\n🔑 Using token: ${CLERK_TOKEN.substring(0, 30)}...`);
  
  // Test Railway endpoint
  const railwayResult = await testRailwayAPI();
  
  // Test Staging endpoint
  const stagingResult = await testStagingAPI();
  
  // If we got people, test entity status
  if (stagingResult?.items?.[0]) {
    await testEntityStatusAPI(stagingResult.items[0].id);
  } else if (railwayResult?.items?.[0]) {
    await testEntityStatusAPI(railwayResult.items[0].id);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("  SUMMARY");
  console.log("=".repeat(60));
  console.log(`\nRailway API: ${railwayResult ? '✅ Working' : '❌ Failed'}`);
  console.log(`Staging API: ${stagingResult ? '✅ Working' : '❌ Failed'}`);
  console.log("\n" + "=".repeat(60) + "\n");
  
  if (stagingResult || railwayResult) {
    console.log("✅ At least one endpoint is working!");
    console.log("The mobile app will work correctly.\n");
  } else {
    console.log("❌ Both endpoints failed. Check:");
    console.log("1. Token is fresh (get new one from browser)");
    console.log("2. User has proper permissions");
    console.log("3. API endpoints are up\n");
  }
}

runAllTests();

