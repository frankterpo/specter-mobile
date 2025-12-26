#!/usr/bin/env node
/**
 * COMPREHENSIVE SPECTER API TESTER
 * 
 * Tests all 64 working endpoints across:
 * 1. Railway API (specter-api-prod.up.railway.app) - Clerk JWT
 * 2. App API (app.tryspecter.com/api) - Clerk JWT
 * 3. User API (api.tryspecter.com/v1) - API Key
 * 
 * Includes 7 working alternatives discovered during troubleshooting
 */

const http = require('http');

// Load environment variables (fallback to defaults for local testing)
require('dotenv').config({ path: '.env.local' });

const CLERK_SECRET = process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET || "";
const CLERK_API = "https://api.clerk.com";
const RAILWAY_API = "https://specter-api-prod.up.railway.app";
const APP_API = "https://app.tryspecter.com/api";
const USER_API = "https://api.tryspecter.com/v1";
const API_KEY = process.env.SPECTER_API_KEY || "";
const PORT = process.env.PORT || 3335;

// Test IDs
const TEST_PERSON_ID = "per_3a3e24bebf3b58133caf138f";
const TEST_COMPANY_ID = "67fd986d1347c417d52bb229";

// All 64 working endpoints (57 original + 7 alternatives)
const ENDPOINTS = [
  // === RAILWAY API (19 endpoints) ===
  { name: "Health Check", method: "GET", path: "/health", auth: false, api: "railway", category: "Public" },
  { name: "API Docs", method: "GET", path: "/docs", auth: false, api: "railway", category: "Public" },
  { name: "People Browse", method: "POST", path: "/private/people", body: { limit: 1, offset: 0 }, auth: true, api: "railway", category: "People" },
  { name: "People Count", method: "POST", path: "/private/people/count", body: {}, auth: true, api: "railway", category: "People" },
  { name: "People Export", method: "POST", path: "/private/people/export", body: { limit: 1, page: 0 }, auth: true, api: "railway", category: "People" },
  { name: "Person by ID", method: "GET", path: `/private/people/${TEST_PERSON_ID}`, auth: true, api: "railway", category: "People" },
  { name: "Person Emails", method: "GET", path: `/private/people/${TEST_PERSON_ID}/emails`, auth: true, api: "railway", category: "People" },
  { name: "Person Export", method: "GET", path: `/private/people/${TEST_PERSON_ID}/export`, auth: true, api: "railway", category: "People" },
  { name: "Company People", method: "GET", path: `/private/companies/${TEST_COMPANY_ID}/people`, auth: true, api: "railway", category: "Companies" },
  { name: "Company People Founders", method: "GET", path: `/private/companies/${TEST_COMPANY_ID}/people?founders=true`, auth: true, api: "railway", category: "Companies" },
  { name: "Company Department Sizes", method: "GET", path: `/private/companies/${TEST_COMPANY_ID}/department-sizes`, auth: true, api: "railway", category: "Companies" },
  { name: "Quick Search History", method: "GET", path: "/private/quick-search/history", auth: true, api: "railway", category: "Quick Search" },
  { name: "Quick Search Company", method: "GET", path: "/private/quick-search/company?term=test", auth: true, api: "railway", category: "Quick Search" },
  { name: "Quick Search People", method: "GET", path: "/private/quick-search/people?term=test", auth: true, api: "railway", category: "Quick Search" },
  { name: "Quick Search Counts", method: "GET", path: "/private/quick-search/counts?term=test", auth: true, api: "railway", category: "Quick Search" },
  { name: "Settings Languages", method: "POST", path: "/private/settings/languages", body: {}, auth: true, api: "railway", category: "Settings" },
  { name: "Settings People", method: "POST", path: "/private/settings/people", body: {}, auth: true, api: "railway", category: "Settings" },
  { name: "Settings Universities", method: "POST", path: "/private/settings/universities", body: {}, auth: true, api: "railway", category: "Settings" },
  
  // === APP API (15 endpoints) ===
  { name: "Signals Company Filters", method: "GET", path: "/signals/company/filters", auth: true, api: "app", category: "Signals" },
  { name: "Signals People Filters", method: "GET", path: "/signals/people/filters", auth: true, api: "app", category: "Signals" },
  { name: "Entity Status People GET", method: "GET", path: `/entity-status/people/${TEST_PERSON_ID}`, auth: true, api: "app", category: "Entity Status" },
  { name: "Entity Status People POST", method: "POST", path: `/entity-status/people/${TEST_PERSON_ID}`, body: { status: "viewed" }, auth: true, api: "app", category: "Entity Status" },
  { name: "Signals Company", method: "POST", path: "/signals/company", body: { page: 0, limit: 10 }, auth: true, api: "app", category: "Signals" },
  { name: "Signals People", method: "POST", path: "/signals/people", body: { page: 0, limit: 10 }, auth: true, api: "app", category: "Signals" },
  { name: "Signals Company Count", method: "POST", path: "/signals/company/count", body: { page: 0, limit: 10 }, auth: true, api: "app", category: "Signals" },
  { name: "Signals People Count", method: "POST", path: "/signals/people/count", body: { page: 0, limit: 10 }, auth: true, api: "app", category: "Signals" },
  { name: "Lists", method: "GET", path: "/lists", auth: true, api: "app", category: "Lists" },
  { name: "Integrations", method: "GET", path: "/integrations", auth: true, api: "app", category: "Integrations" },
  { name: "Integrations Token", method: "GET", path: "/integrations/token", auth: true, api: "app", category: "Integrations" },
  { name: "Network Status", method: "GET", path: "/network/status", auth: true, api: "app", category: "Network" },
  { name: "User Recent People", method: "GET", path: "/user/recent/people", auth: true, api: "app", category: "User" },
  { name: "User Recent Company", method: "GET", path: "/user/recent/company", auth: true, api: "app", category: "User" },
  { name: "Notifications", method: "GET", path: "/notifications", auth: true, api: "app", category: "Notifications" },
  
  // === USER API (23 endpoints) ===
  { name: "Person by ID (User API)", method: "GET", path: `/people/${TEST_PERSON_ID}`, auth: true, api: "user", category: "People", useApiKey: true },
  { name: "Person Email (User API)", method: "GET", path: `/people/${TEST_PERSON_ID}/email`, auth: true, api: "user", category: "People", useApiKey: true },
  { name: "Company by ID (User API)", method: "GET", path: `/companies/${TEST_COMPANY_ID}`, auth: true, api: "user", category: "Companies", useApiKey: true },
  { name: "Company People (User API)", method: "GET", path: `/companies/${TEST_COMPANY_ID}/people`, auth: true, api: "user", category: "Companies", useApiKey: true },
  { name: "Similar Companies (User API)", method: "GET", path: `/companies/${TEST_COMPANY_ID}/similar`, auth: true, api: "user", category: "Companies", useApiKey: true },
  { name: "Search Companies (User API)", method: "GET", path: "/companies/search?term=stripe", auth: true, api: "user", category: "Companies", useApiKey: true },
  { name: "Lists People (User API)", method: "GET", path: "/lists/people", auth: true, api: "user", category: "Lists", useApiKey: true },
  { name: "Lists Companies (User API)", method: "GET", path: "/lists/companies", auth: true, api: "user", category: "Lists", useApiKey: true },
  { name: "List People by ID (User API)", method: "GET", path: "/lists/people/123", auth: true, api: "user", category: "Lists", useApiKey: true },
  { name: "List People Results (User API)", method: "GET", path: "/lists/people/123/results", auth: true, api: "user", category: "Lists", useApiKey: true },
  { name: "List Companies by ID (User API)", method: "GET", path: "/lists/companies/123", auth: true, api: "user", category: "Lists", useApiKey: true },
  { name: "List Companies Results (User API)", method: "GET", path: "/lists/companies/123/results", auth: true, api: "user", category: "Lists", useApiKey: true },
  { name: "Searches (User API)", method: "GET", path: "/searches", auth: true, api: "user", category: "Searches", useApiKey: true },
  { name: "Searches People (User API)", method: "GET", path: "/searches/people", auth: true, api: "user", category: "Searches", useApiKey: true },
  { name: "Searches Companies (User API)", method: "GET", path: "/searches/companies", auth: true, api: "user", category: "Searches", useApiKey: true },
  { name: "Search People by ID (User API)", method: "GET", path: "/searches/people/123", auth: true, api: "user", category: "Searches", useApiKey: true },
  { name: "Search People Results (User API)", method: "GET", path: "/searches/people/123/results", auth: true, api: "user", category: "Searches", useApiKey: true },
  { name: "Search Companies by ID (User API)", method: "GET", path: "/searches/companies/123", auth: true, api: "user", category: "Searches", useApiKey: true },
  { name: "Search Companies Results (User API)", method: "GET", path: "/searches/companies/123/results", auth: true, api: "user", category: "Searches", useApiKey: true },
  { name: "Talent Signal by ID (User API)", method: "GET", path: "/talent/123", auth: true, api: "user", category: "Talent", useApiKey: true },
  { name: "Talent Search Results (User API)", method: "GET", path: "/searches/talent/123/results", auth: true, api: "user", category: "Talent", useApiKey: true },
  { name: "Investor Interest by ID (User API)", method: "GET", path: "/investor-interest/123", auth: true, api: "user", category: "Investor Interest", useApiKey: true },
  { name: "Investor Interest Search Results (User API)", method: "GET", path: "/searches/investor-interest/123/results", auth: true, api: "user", category: "Investor Interest", useApiKey: true },
];

const HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Specter Comprehensive API Tester</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'SF Mono', 'Menlo', monospace; background: #0a0a0a; color: #fff; padding: 20px; }
    h1 { font-size: 24px; margin-bottom: 5px; }
    .subtitle { color: #666; font-size: 12px; margin-bottom: 20px; }
    .section { background: #111; border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid #222; }
    .section-title { color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
    .token-box { background: #0a0a0a; border: 2px solid #166534; border-radius: 8px; padding: 12px; color: #4ade80; font-size: 10px; word-break: break-all; max-height: 80px; overflow: auto; }
    .token-box.expired { border-color: #7f1d1d; color: #f87171; }
    .token-info { color: #666; font-size: 11px; margin-top: 8px; }
    button { background: #2563eb; color: #fff; border: none; padding: 14px 24px; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; font-family: inherit; }
    button:hover { background: #1d4ed8; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button.secondary { background: #333; }
    .btn-row { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .category-btn { background: #1a1a1a; border: 1px solid #333; color: #888; padding: 8px 16px; border-radius: 6px; font-size: 11px; cursor: pointer; }
    .category-btn:hover { background: #222; }
    .category-btn.active { background: #2563eb; color: #fff; border-color: #2563eb; }
    .endpoint { background: #0f0f0f; border-radius: 10px; padding: 12px; margin-bottom: 8px; border: 1px solid #1a1a1a; display: flex; align-items: center; gap: 10px; }
    .method { font-size: 10px; font-weight: bold; padding: 4px 8px; border-radius: 4px; }
    .method.get { background: #166534; color: #4ade80; }
    .method.post { background: #1e40af; color: #60a5fa; }
    .path { flex: 1; color: #fff; font-size: 13px; }
    .api-badge { font-size: 9px; padding: 2px 6px; border-radius: 3px; background: #333; color: #888; }
    .api-badge.railway { background: #7c3aed; color: #fff; }
    .api-badge.app { background: #059669; color: #fff; }
    .api-badge.user { background: #dc2626; color: #fff; }
    .test-btn { background: #1a1a1a; border: 1px solid #333; color: #4af; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; }
    .test-btn:hover { background: #222; }
    .result { border-radius: 10px; padding: 14px; margin-bottom: 10px; border: 1px solid; }
    .result.success { background: #052e16; border-color: #166534; }
    .result.error { background: #1a0505; border-color: #7f1d1d; }
    .result-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .result-endpoint { font-weight: 600; font-size: 12px; }
    .result-status { font-size: 11px; font-weight: bold; }
    .result-status.ok { color: #4ade80; }
    .result-status.err { color: #f87171; }
    .result-api { font-size: 10px; color: #666; margin-top: 4px; }
    .result-data { background: #000; border-radius: 6px; padding: 10px; font-size: 10px; color: #888; max-height: 150px; overflow: auto; white-space: pre-wrap; }
    .stats { display: flex; gap: 20px; margin-bottom: 16px; }
    .stat { text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; }
    .stat-label { font-size: 11px; color: #666; }
    .stat-value.green { color: #4ade80; }
    .stat-value.red { color: #f87171; }
  </style>
</head>
<body>
  <h1>🔬 Specter Comprehensive API Tester</h1>
  <p class="subtitle">64 endpoints across Railway API, App API, and User API</p>

  <div class="section">
    <div class="section-title">JWT Token</div>
    <div id="token-box" class="token-box">Click "Get Token" to generate...</div>
    <div id="token-info" class="token-info"></div>
    <div class="btn-row" style="margin-top: 12px;">
      <button onclick="getToken()">🔑 Get Fresh Token</button>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Quick Actions</div>
    <div class="btn-row">
      <button onclick="runAllTests()" id="run-all-btn">▶ Run All Tests (64 endpoints)</button>
      <button onclick="clearResults()" class="secondary">Clear Results</button>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Filter by Category</div>
    <div class="btn-row" id="category-filters"></div>
  </div>

  <div class="section">
    <div class="section-title">Endpoints (<span id="endpoint-count">64</span>)</div>
    <div id="endpoints"></div>
  </div>

  <div class="section">
    <div class="section-title">Results</div>
    <div class="stats">
      <div class="stat"><div class="stat-value green" id="passed">0</div><div class="stat-label">Passed</div></div>
      <div class="stat"><div class="stat-value red" id="failed">0</div><div class="stat-label">Failed</div></div>
    </div>
    <div id="results"></div>
  </div>

  <script>
    const ENDPOINTS = ${JSON.stringify(ENDPOINTS)};

    let token = null;
    let tokenExp = null;
    let currentCategory = 'all';

    // Get unique categories
    const categories = ['all', ...new Set(ENDPOINTS.map(e => e.category))];

    // Render category filters
    const filtersEl = document.getElementById('category-filters');
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'category-btn' + (cat === 'all' ? ' active' : '');
      btn.textContent = cat === 'all' ? 'All' : cat;
      btn.onclick = () => filterByCategory(cat);
      filtersEl.appendChild(btn);
    });

    function filterByCategory(cat) {
      currentCategory = cat;
      document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      renderEndpoints();
    }

    function renderEndpoints() {
      const endpointsEl = document.getElementById('endpoints');
      const filtered = currentCategory === 'all' 
        ? ENDPOINTS 
        : ENDPOINTS.filter(e => e.category === currentCategory);
      
      document.getElementById('endpoint-count').textContent = filtered.length;
      endpointsEl.innerHTML = '';
      
      filtered.forEach((ep, i) => {
        const idx = ENDPOINTS.indexOf(ep);
        endpointsEl.innerHTML += \`
          <div class="endpoint">
            <span class="method \${ep.method.toLowerCase()}">\${ep.method}</span>
            <span class="path">\${ep.path}</span>
            <span class="api-badge \${ep.api}">\${ep.api.toUpperCase()}</span>
            <button class="test-btn" onclick="testEndpoint(\${idx})">Test →</button>
          </div>
        \`;
      });
    }

    renderEndpoints();

    async function getToken() {
      document.getElementById('token-box').textContent = 'Generating...';
      try {
        const res = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'francisco@tryspecter.com' })
        });
        const data = await res.json();
        if (data.jwt) {
          token = data.jwt;
          const payload = JSON.parse(atob(token.split('.')[1]));
          tokenExp = new Date(payload.exp * 1000);
          document.getElementById('token-box').textContent = token.substring(0, 80) + '...';
          document.getElementById('token-box').className = 'token-box';
          document.getElementById('token-info').textContent = \`Expires: \${tokenExp.toLocaleTimeString()} (in \${Math.round((tokenExp - Date.now()) / 1000)}s)\`;
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (e) {
        document.getElementById('token-box').textContent = 'Error: ' + e.message;
        document.getElementById('token-box').className = 'token-box expired';
      }
    }

    async function testEndpoint(idx) {
      const ep = ENDPOINTS[idx];
      if (ep.auth && !ep.useApiKey && !token) {
        alert('Get a token first!');
        return;
      }

      const start = Date.now();
      try {
        const res = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            method: ep.method, 
            path: ep.path, 
            body: ep.body,
            token: ep.auth && !ep.useApiKey ? token : null,
            api: ep.api,
            useApiKey: ep.useApiKey || false
          })
        });
        const data = await res.json();
        const apiUrl = ep.api === 'railway' ? 'specter-api-prod.up.railway.app' 
                     : ep.api === 'app' ? 'app.tryspecter.com/api'
                     : 'api.tryspecter.com/v1';
        addResult(ep, data.status, data.ok, data.data, Date.now() - start, apiUrl);
      } catch (e) {
        addResult(ep, 0, false, { error: e.message }, Date.now() - start, 'error');
      }
    }

    async function runAllTests() {
      if (!token) await getToken();
      clearResults();
      document.getElementById('run-all-btn').disabled = true;
      document.getElementById('run-all-btn').textContent = '⏳ Running...';
      
      for (let i = 0; i < ENDPOINTS.length; i++) {
        await testEndpoint(i);
        await new Promise(r => setTimeout(r, 100));
      }
      
      document.getElementById('run-all-btn').disabled = false;
      document.getElementById('run-all-btn').textContent = '▶ Run All Tests (64 endpoints)';
    }

    function addResult(ep, status, ok, data, duration, apiUrl) {
      const resultsEl = document.getElementById('results');
      const html = \`
        <div class="result \${ok ? 'success' : 'error'}">
          <div class="result-header">
            <span class="result-endpoint">\${ok ? '✅' : '❌'} \${ep.method} \${ep.path}</span>
            <span class="result-status \${ok ? 'ok' : 'err'}">\${status} • \${duration}ms</span>
          </div>
          <div class="result-api">Target API: \${apiUrl}</div>
          <pre class="result-data">\${JSON.stringify(data, null, 2).substring(0, 1000)}</pre>
        </div>
      \`;
      resultsEl.innerHTML = html + resultsEl.innerHTML;
      
      // Update stats
      const passed = document.querySelectorAll('.result.success').length;
      const failed = document.querySelectorAll('.result.error').length;
      document.getElementById('passed').textContent = passed;
      document.getElementById('failed').textContent = failed;
    }

    function clearResults() {
      document.getElementById('results').innerHTML = '';
      document.getElementById('passed').textContent = '0';
      document.getElementById('failed').textContent = '0';
    }

    // Auto-get token on load
    getToken();
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve HTML
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200);
    res.end(HTML);
    return;
  }

  // Token endpoint
  if (req.url === '/api/token' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { email } = JSON.parse(body);
        console.log(`🔑 Getting token for ${email}...`);
        const userRes = await fetch(`${CLERK_API}/v1/users?email_address=${email}`, {
          headers: { 'Authorization': `Bearer ${CLERK_SECRET}` }
        });
        const users = await userRes.json();
        const user = (Array.isArray(users) ? users : users.data)[0];

        if (!user) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'User not found' }));
          return;
        }

        const sessRes = await fetch(`${CLERK_API}/v1/sessions?user_id=${user.id}`, {
          headers: { 'Authorization': `Bearer ${CLERK_SECRET}` }
        });
        const sessions = await sessRes.json();
        const sessionList = Array.isArray(sessions) ? sessions : (sessions.data || []);
        const activeSession = sessionList.find(s => s.status === 'active');

        if (!activeSession) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No active session found' }));
          return;
        }

        const tokenRes = await fetch(`${CLERK_API}/v1/sessions/${activeSession.id}/tokens`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CLERK_SECRET}`,
            'Content-Type': 'application/json'
          }
        });
        const tokenData = await tokenRes.json();

        if (tokenData.jwt) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jwt: tokenData.jwt, user_id: user.id, email: email }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No JWT in response' }));
        }
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Proxy endpoint
  if (req.url === '/api/proxy' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { method, path, body: reqBody, token, api, useApiKey } = JSON.parse(body);
        
        // Determine base URL
        let baseUrl;
        if (api === 'railway') {
          baseUrl = RAILWAY_API;
        } else if (api === 'app') {
          baseUrl = APP_API;
        } else {
          baseUrl = USER_API;
        }
        
        const headers = { 'Content-Type': 'application/json' };
        if (useApiKey) {
          headers['x-api-key'] = API_KEY;
        } else if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const opts = { method, headers };
        if (reqBody) opts.body = JSON.stringify(reqBody);
        
        const apiRes = await fetch(`${baseUrl}${path}`, opts);
        let data;
        const ct = apiRes.headers.get('content-type');
        if (ct?.includes('json')) {
          try {
            data = await apiRes.json();
          } catch {
            data = { _parseError: true };
          }
        } else {
          const text = await apiRes.text();
          data = { _html: true, preview: text.substring(0, 200) };
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: apiRes.status, ok: apiRes.ok, data }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`
═══════════════════════════════════════════════════════════════
   🔬 SPECTER COMPREHENSIVE API TESTER
   
   Open in browser: http://localhost:${PORT}
   
   Features:
   • 64 working endpoints across 3 APIs
   • Railway API (19 endpoints) - Clerk JWT
   • App API (15 endpoints) - Clerk JWT
   • User API (23 endpoints) - API Key
   • Category filtering
   • Auto-generates Clerk JWT tokens
   • Shows target API URL for each request
═══════════════════════════════════════════════════════════════
`);
});
