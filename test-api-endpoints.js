// API Integration Test Script for Specter Mobile
// Run with: node test-api-endpoints.js

const https = require('https');
const http = require('http');
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

const API_BASE_URL = process.env.EXPO_PUBLIC_SPECTER_API_URL || "https://app.tryspecter.com/api";
const RAILWAY_API_BASE_URL = process.env.EXPO_PUBLIC_SPECTER_RAILWAY_URL || "https://specter-api-prod.up.railway.app";
const DEFAULT_API_KEY = process.env.EXPO_PUBLIC_SPECTER_API_KEY;
const PROXY_ORIGIN = process.env.SPECTER_PROXY_ORIGIN || "http://localhost:3333";
const TEST_EMAIL = process.env.SPECTER_TEST_EMAIL;
const TEST_PASSWORD = process.env.SPECTER_TEST_PASSWORD;
const CLERK_SECRET = process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET;
const CLERK_API = "https://api.clerk.com";

async function getJwtFromProxy() {
  if (!TEST_EMAIL || !TEST_PASSWORD) return null;
  const response = await fetch(`${PROXY_ORIGIN}/api/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.jwt || null;
}

async function getJwtFromClerk() {
  if (!CLERK_SECRET || !TEST_EMAIL) return null;
  const usersRes = await fetch(`${CLERK_API}/v1/users?email_address=${encodeURIComponent(TEST_EMAIL)}`, {
    headers: { Authorization: `Bearer ${CLERK_SECRET}` },
  });
  const users = await usersRes.json();
  if (!Array.isArray(users) || users.length === 0) return null;
  const sessRes = await fetch(`${CLERK_API}/v1/sessions?user_id=${users[0].id}`, {
    headers: { Authorization: `Bearer ${CLERK_SECRET}` },
  });
  const sessions = await sessRes.json();
  const sessionList = Array.isArray(sessions) ? sessions : sessions.data || [];
  const activeSession = sessionList.find((s) => s.status === "active");
  if (!activeSession) return null;
  const tokenRes = await fetch(`${CLERK_API}/v1/sessions/${activeSession.id}/tokens`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CLERK_SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expires_in_seconds: 3600 }),
  });
  const tokenData = await tokenRes.json();
  return tokenData.jwt || null;
}

async function resolveJwt() {
  if (process.env.SPECTER_TEST_JWT) return process.env.SPECTER_TEST_JWT;
  const fromProxy = await getJwtFromProxy();
  if (fromProxy) return fromProxy;
  const fromClerk = await getJwtFromClerk();
  if (fromClerk) return fromClerk;
  throw new Error(
    [
      "No JWT available for tests.",
      "Provide one of:",
      "- SPECTER_TEST_JWT",
      "- Run `node server.js` and set SPECTER_TEST_EMAIL + SPECTER_TEST_PASSWORD",
      "- Set CLERK_SECRET_KEY + SPECTER_TEST_EMAIL (requires an active Clerk session for that user)",
    ].join("\n")
  );
}

class APITester {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.railwayBaseURL = RAILWAY_API_BASE_URL;
    this.authToken = null;
    this.apiKey = DEFAULT_API_KEY || null;
  }

  async makeRequest(endpoint, options = {}, baseUrlOverride = null) {
    return new Promise((resolve, reject) => {
      const baseUrl = baseUrlOverride || this.baseURL;
      const url = `${baseUrl}${endpoint}`;
      const requestOptions = {
        method: options.method || 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'x-api-key': this.apiKey } : {}),
          'x-user-id': 'test-user-id',
          ...options.headers
        }
      };

      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.request(url, requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = {
              statusCode: res.statusCode,
              headers: res.headers,
              data: data ? JSON.parse(data) : null
            };
            resolve(response);
          } catch (error) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: data,
              parseError: error.message
            });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  async testEndpoint(name, endpoint, options = {}) {
    const expect = options.expect || { ok: true };
    const api = options.api || "app";
    delete options.expect;
    delete options.api;

    console.log(`\n🔍 Testing ${name}...`);
    console.log(`   Endpoint: ${endpoint}`);
    console.log(`   Method: ${options.method || 'GET'}`);

    try {
      const startTime = Date.now();
      const response = await this.makeRequest(endpoint, options, api === "railway" ? this.railwayBaseURL : null);
      const duration = Date.now() - startTime;

      console.log(`   ✅ Status: ${response.statusCode}`);
      console.log(`   ⏱️  Duration: ${duration}ms`);

      const is2xx = response.statusCode >= 200 && response.statusCode < 300;
      const isExpected =
        typeof expect.statusCode === "number" ? response.statusCode === expect.statusCode : expect.ok ? is2xx : !is2xx;

      if (isExpected) {
        console.log(`   ✅ ${is2xx ? "SUCCESS" : "EXPECTED FAILURE"}`);
        if (response.data && typeof response.data === 'object') {
          if (Array.isArray(response.data)) {
            console.log(`   📊 Data: Array with ${response.data.length} items`);
          } else if (response.data.count !== undefined) {
            console.log(`   📊 Count: ${response.data.count}`);
          } else {
            console.log(`   📊 Data: Object with ${Object.keys(response.data).length} keys`);
          }
        }
        return { success: true, response, duration, expected: expect };
      } else {
        console.log(`   ❌ FAILED - Status: ${response.statusCode} (expected ${expect.ok ? "2xx" : "non-2xx"})`);
        if (response.data) {
          console.log(`   Error:`, response.data);
        }
        return { success: false, response, duration, expected: expect };
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Specter API Integration Tests');
    console.log('=' .repeat(50));

    this.authToken = await resolveJwt();
    if (!this.apiKey) {
      console.warn("⚠️ Missing EXPO_PUBLIC_SPECTER_API_KEY; requests may be rejected by the API.");
    }

    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      tests: []
    };

    // Test People API
    console.log('\n👥 TESTING PEOPLE API');
    console.log('=' .repeat(30));

    // 1. Get People Signals (main feed)
    const peopleSignals = await this.testEndpoint(
      'People Signals',
      '/signals/people',
      {
        method: 'POST',
        body: { page: 0, limit: 5 }
      }
    );
    results.tests.push(peopleSignals);

    // 2. Get People Filters
    results.tests.push(await this.testEndpoint(
      'People Filters',
      '/signals/people/filters'
    ));

    // 3. Get People Count
    results.tests.push(await this.testEndpoint(
      'People Count',
      '/signals/people/count',
      {
        method: 'POST',
        body: {}
      }
    ));

    // Test Companies API
    console.log('\n🏢 TESTING COMPANIES API');
    console.log('=' .repeat(30));

    // 4. Get Company Signals
    const companySignals = await this.testEndpoint(
      'Company Signals',
      '/signals/company',
      {
        method: 'POST',
        body: { page: 0, limit: 5 }
      }
    );
    results.tests.push(companySignals);

    // 5. Get Company Filters
    results.tests.push(await this.testEndpoint(
      'Company Filters',
      '/signals/company/filters?page=1'
    ));

    // Test Lists API
    console.log('\n📋 TESTING LISTS API');
    console.log('=' .repeat(30));

    // 6. Get Lists
    results.tests.push(await this.testEndpoint(
      'Get Lists',
      '/lists?product=people&limit=10'
    ));

    // 6b. Create list (currently unsupported by the backend)
    results.tests.push(await this.testEndpoint('Create People List (railway - expected unsupported)', '/private/lists/people', {
      api: 'railway',
      method: 'POST',
      body: { name: `Codex Smoke ${new Date().toISOString()}` },
      expect: { ok: false },
    }));

    // Test Searches API
    console.log('\n🔍 TESTING SEARCHES API');
    console.log('=' .repeat(30));

    // 7. Get Saved Searches
    results.tests.push(await this.testEndpoint(
      'Saved Searches',
      '/v1/searches',
      { expect: { ok: false } }
    ));

    // Test Error Handling
    console.log('\n🚨 TESTING ERROR HANDLING');
    console.log('=' .repeat(30));

    // 8. Test with invalid endpoint
    results.tests.push(await this.testEndpoint(
      'Invalid Endpoint',
      '/nonexistent/endpoint',
      { expect: { ok: false } }
    ));

    // 9. Sanity: investor signals (used by the app)
    console.log('\n💰 TESTING INVESTORS API');
    console.log('=' .repeat(30));
    results.tests.push(await this.testEndpoint('Investor Signals', '/signals/investors', { method: 'POST', body: { page: 0, limit: 5 } }));
    results.tests.push(await this.testEndpoint('Investor Filters', '/signals/investors/filters'));
    results.tests.push(await this.testEndpoint('Investor Count', '/signals/investors/count', { method: 'POST', body: {} }));

    // 10. Sanity: revenue signals (used by the app)
    console.log('\n📈 TESTING REVENUE SIGNALS');
    console.log('=' .repeat(30));
    results.tests.push(await this.testEndpoint('Revenue Signals', '/signals/revenue', { method: 'POST', body: { page: 0, limit: 5 } }));
    results.tests.push(await this.testEndpoint('Revenue Filters', '/signals/revenue/filters'));
    results.tests.push(await this.testEndpoint('Revenue Count', '/signals/revenue/count', { method: 'POST', body: {} }));

    // 11. Sanity: transactions feeds (used by the app)
    console.log('\n🧾 TESTING TRANSACTION SIGNALS');
    console.log('=' .repeat(30));
    results.tests.push(await this.testEndpoint('Funding Signals', '/signals/funding-rounds', { method: 'POST', body: { page: 0, limit: 5 } }));
    results.tests.push(await this.testEndpoint('Acquisition Signals', '/signals/acquisition', { method: 'POST', body: { page: 0, limit: 5 } }));
    results.tests.push(await this.testEndpoint('IPO Signals', '/signals/ipo', { method: 'POST', body: { page: 0, limit: 5 } }));
    results.tests.push(await this.testEndpoint('Strategic Signals', '/signals/strategic', { method: 'POST', body: { page: 0, limit: 5 } }));

    // 12. Detail + mutation flow (exercise what the app does after sign-in)
    console.log('\n🧪 TESTING DETAIL + MUTATION FLOWS');
    console.log('=' .repeat(30));
    const firstPersonId = peopleSignals?.response?.data?.items?.[0]?.id || peopleSignals?.response?.data?.items?.[0]?.person_id;
    const firstCompanyId = companySignals?.response?.data?.items?.[0]?.id || companySignals?.response?.data?.items?.[0]?.company_id;
    if (firstPersonId) {
      results.tests.push(await this.testEndpoint('Person Detail (railway)', `/private/people/${firstPersonId}`, { api: 'railway' }));
      results.tests.push(await this.testEndpoint('Like Person (app)', `/entity-status/people/${firstPersonId}`, { method: 'POST', body: { status: 'liked' } }));
    } else {
      results.tests.push({ success: false, error: 'Could not derive person id from /signals/people response' });
    }
    if (firstCompanyId) {
      results.tests.push(await this.testEndpoint('Company Team (railway)', `/private/companies/${firstCompanyId}/people`, { api: 'railway' }));
      results.tests.push(await this.testEndpoint('Department Sizes (railway)', `/private/companies/${firstCompanyId}/department-sizes`, { api: 'railway' }));
      results.tests.push(await this.testEndpoint('Like Company (app)', `/entity-status/company/${firstCompanyId}`, { method: 'POST', body: { status: 'liked' } }));
    } else {
      results.tests.push({ success: false, error: 'Could not derive company id from /signals/company response' });
    }

    // Calculate results
    results.total = results.tests.length;
    results.passed = results.tests.filter(t => t.success).length;
    results.failed = results.total - results.passed;

    // Print summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('=' .repeat(50));
    console.log(`Total Tests: ${results.total}`);
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);

    if (results.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      results.tests.forEach((test, index) => {
        if (!test.success) {
          console.log(`   ${index + 1}. ${test.error || 'HTTP ' + (test.response?.statusCode || 'Unknown')}`);
        }
      });
    }

    console.log('\n🏁 API Integration Testing Complete!');
    return results;
  }
}

// Run the tests
if (require.main === module) {
  const tester = new APITester();
  tester.runAllTests().catch(console.error);
}

module.exports = APITester;
