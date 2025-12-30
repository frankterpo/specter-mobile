#!/usr/bin/env node
/**
 * Mobile V1 Debug Script
 * Quick troubleshooting for Mobile V1 testing via browser
 */

const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const contents = fs.readFileSync(filePath, "utf8");
    for (const line of contents.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (e) {
    console.warn(`⚠️ [Env] Failed loading ${filePath}: ${e.message}`);
  }
}

loadEnvFile(path.join(__dirname, ".env.local"));
loadEnvFile(path.join(__dirname, ".env"));

const CLERK_SECRET = process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET;
const CLERK_API = "https://api.clerk.com";
const APP_API = "https://app.tryspecter.com/api";
const TEST_EMAIL = process.env.SPECTER_TEST_EMAIL;

if (!CLERK_SECRET) {
  console.error("❌ Missing CLERK_SECRET_KEY in environment (.env.local or shell).");
  process.exit(1);
}
if (!TEST_EMAIL) {
  console.error("❌ Missing SPECTER_TEST_EMAIL in environment (e.g. your@email.com).");
  process.exit(1);
}

async function getToken() {
  try {
    const usersRes = await fetch(CLERK_API + "/v1/users?email_address=" + encodeURIComponent(TEST_EMAIL), {
      headers: { 'Authorization': 'Bearer ' + CLERK_SECRET }
    });
    const users = await usersRes.json();
    if (!Array.isArray(users) || users.length === 0) throw new Error("No Clerk user found for " + TEST_EMAIL);
    const sessRes = await fetch(CLERK_API + '/v1/sessions?user_id=' + users[0].id, {
      headers: { 'Authorization': 'Bearer ' + CLERK_SECRET }
    });
    const sessions = await sessRes.json();
    const sessionList = Array.isArray(sessions) ? sessions : (sessions.data || []);
    const activeSession = sessionList.find(s => s.status === 'active');
    if (!activeSession) throw new Error('No active session found');
    const tokenRes = await fetch(CLERK_API + '/v1/sessions/' + activeSession.id + '/tokens', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + CLERK_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expires_in_seconds: 3600 })
    });
    const tokenData = await tokenRes.json();
    return tokenData.jwt;
  } catch (e) {
    console.error('❌ Auth failed:', e.message);
    return null;
  }
}

async function testCriticalEndpoints(token) {
  console.log('\n🔍 Testing Critical Mobile V1 Endpoints...\n');
  
  const tests = [
    { name: 'Auth Token', test: () => !!token },
    { name: 'Companies Feed', endpoint: '/signals/company' },
    { name: 'People Feed', endpoint: '/signals/people' },
    { name: 'Like Company', endpoint: '/entity-status/company/67fd986d1347c417d52bb229' },
    { name: 'Like Person', endpoint: '/entity-status/people/per_3a3e24bebf3b58133caf138f' },
  ];
  
  for (const test of tests) {
    try {
      if (test.test) {
        const result = test.test();
        console.log(`${result ? '✅' : '❌'} ${test.name}`);
      } else if (test.endpoint) {
        const res = await fetch(APP_API + test.endpoint, {
          method: test.endpoint.includes('entity-status') ? 'POST' : 'POST',
          headers: { 
            'Authorization': 'Bearer ' + token, 
            'Content-Type': 'application/json' 
          },
          body: test.endpoint.includes('entity-status') ? JSON.stringify({ status: 'liked' }) : JSON.stringify({ page: 0, limit: 5 })
        });
        console.log(`${res.ok ? '✅' : '❌'} ${test.name} (${res.status})`);
      }
    } catch (e) {
      console.log(`❌ ${test.name} - ERROR: ${e.message}`);
    }
  }
}

async function main() {
  console.log('🚀 Mobile V1 Browser Testing Debug Script');
  console.log('==========================================');
  
  const token = await getToken();
  if (token) {
    console.log('✅ Authentication: Working');
    await testCriticalEndpoints(token);
  } else {
    console.log('❌ Authentication: Failed - Check Clerk setup');
  }
  
  console.log('\n📋 Next Steps:');
  console.log('1. Start API tester: node server.js');  
  console.log('2. Run web app: npm run web');
  console.log('3. Open browser DevTools Network tab');
  console.log('4. Check console for JavaScript errors');
}

main().catch(console.error);
