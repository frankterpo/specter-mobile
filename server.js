#!/usr/bin/env node
/**
 * Specter API Tester - Definitive V1 Endpoints
 * 
 * 37 Working Endpoints:
 * - Railway API: 14 endpoints
 * - App API: 23 endpoints
 * - User API: NOT AN API (returns HTML - do not use)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const contents = fs.readFileSync(filePath, 'utf8');
    for (const line of contents.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
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

// Load local env files for convenience (Node doesn't auto-load these)
loadEnvFile(path.join(__dirname, '.env.local'));
loadEnvFile(path.join(__dirname, '.env'));

const CLERK_SECRET = process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET;
const CLERK_API = "https://api.clerk.com";
const CLERK_FRONTEND_BASE = (process.env.EXPO_PUBLIC_CLERK_DOMAIN || process.env.CLERK_FRONTEND_BASE || "https://clerk.tryspecter.com").replace(/\/+$/, "");
const RAILWAY_API = "https://specter-api-prod.up.railway.app";
const APP_API = "https://app.tryspecter.com/api";
const PORT = 3333;
const HOST = process.env.SPECTER_PROXY_HOST || "127.0.0.1";
const DEFAULT_API_KEY = process.env.EXPO_PUBLIC_SPECTER_API_KEY || "iJXZPM060qU32m0UKCSfrtIVFzSt09La";

if (!CLERK_SECRET) {
  console.error("❌ Missing CLERK_SECRET_KEY (set it in .env.local or your shell env) — cannot mint JWTs.");
  process.exit(1);
}

async function mintJwtForSession(sessionId) {
  const tokenRes = await fetch(CLERK_API + '/v1/sessions/' + sessionId + '/tokens', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + CLERK_SECRET, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expires_in_seconds: 3600 })
  });
  if (!tokenRes.ok) return null;
  const tokenData = await tokenRes.json();
  return tokenData.jwt || null;
}

async function signInWithPasswordWithoutBrowser(email, password) {
  // Uses Clerk Frontend API (no CORS from the app because this is server-side).
  // This verifies the user's password and returns a real session id when successful.
  function buildCookieHeader(setCookieHeader) {
    if (!setCookieHeader) return null;
    const header = String(setCookieHeader);
    const parts = [];
    let start = 0;
    let inExpires = false;
    for (let i = 0; i < header.length; i++) {
      const ch = header[i];
      if (!inExpires && header.slice(i, i + 8).toLowerCase() === "expires=") {
        inExpires = true;
        continue;
      }
      if (inExpires && ch === ";") {
        inExpires = false;
        continue;
      }
      if (!inExpires && ch === ",") {
        parts.push(header.slice(start, i).trim());
        start = i + 1;
      }
    }
    parts.push(header.slice(start).trim());
    const cookiePairs = parts
      .map((p) => p.split(";")[0]?.trim())
      .filter(Boolean);
    return cookiePairs.length ? cookiePairs.join("; ") : null;
  }

  // Clerk's frontend API sometimes supports a one-shot password sign-in.
  // Try it first because it avoids cookie juggling and tends to be more resilient.
  try {
    const oneShotUrl = `${CLERK_FRONTEND_BASE}/v1/client/sign_ins`;
    const oneShotRes = await fetch(oneShotUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy: "password", identifier: email, password }),
    });
    const oneShotText = await oneShotRes.text();
    if (oneShotRes.ok && oneShotText && oneShotText.trim()) {
      const oneShotJson = JSON.parse(oneShotText);
      const response = oneShotJson.response || null;
      const signIn = oneShotJson.sign_in || response?.sign_in || response?.signIn || null;
      const client = oneShotJson.client || response?.client || null;
      const sessionId =
        signIn?.created_session_id ||
        signIn?.createdSessionId ||
        response?.created_session_id ||
        response?.last_active_session_id ||
        client?.last_active_session_id ||
        client?.sessions?.[0]?.id ||
        null;

      if (sessionId) {
        return { sessionId, userId: signIn?.user_id || signIn?.userId || null };
      }
    }
  } catch (_) {
    // Fall back to the 2-step approach below.
  }

  const createUrl = `${CLERK_FRONTEND_BASE}/v1/client/sign_ins`;
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email }),
  });
  const cookieHeader = buildCookieHeader(createRes.headers.get('set-cookie'));

  const createText = await createRes.text();
  if (!createRes.ok) {
    let message = 'Invalid credentials';
    try {
      const json = JSON.parse(createText);
      message = json.errors?.[0]?.message || json.message || message;
    } catch (_) {}
    const err = new Error(message);
    err.statusCode = createRes.status;
    throw err;
  }

  if (!createText || !createText.trim()) {
    throw new Error(`Sign-in failed (empty response from Clerk Frontend API, status ${createRes.status}).`);
  }

  const createJson = JSON.parse(createText);
  const createResponse = createJson.response || null;
  const signInId = createResponse?.id || createJson?.sign_in?.id || createJson?.client?.sign_in?.id || null;
  if (!signInId) {
    throw new Error('Sign-in failed (missing sign-in id).');
  }

  const attemptUrl = `${CLERK_FRONTEND_BASE}/v1/client/sign_ins/${signInId}/attempt_first_factor`;
  const attemptRes = await fetch(attemptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
    body: JSON.stringify({ strategy: 'password', password }),
  });

  const attemptText = await attemptRes.text();
  if (!attemptRes.ok) {
    let message = 'Invalid credentials';
    try {
      const json = JSON.parse(attemptText);
      message = json.errors?.[0]?.message || json.message || message;
    } catch (_) {}
    const err = new Error(message);
    err.statusCode = attemptRes.status;
    throw err;
  }

  if (!attemptText || !attemptText.trim()) {
    throw new Error(`Sign-in failed (empty attempt response from Clerk Frontend API, status ${attemptRes.status}).`);
  }

  const json = JSON.parse(attemptText);

  const response = json.response || null;
  const client = json.client || null;
  const signIn = json.sign_in || response?.sign_in || response?.signIn || null;
  const sessionId =
    signIn?.created_session_id ||
    signIn?.session_id ||
    signIn?.session?.id ||
    json.created_session_id ||
    json.session?.id ||
    response?.created_session_id ||
    response?.last_active_session_id ||
    client?.last_active_session_id ||
    client?.sessions?.[0]?.id ||
    null;
  const userId =
    signIn?.user_id ||
    signIn?.user?.id ||
    client?.user?.id ||
    json.user?.id ||
    null;

  if (!sessionId) {
    const status = signIn?.status || response?.status || json.status || 'unknown';
    const ffv = signIn?.first_factor_verification;
    const sfv = signIn?.second_factor_verification;
    console.log(
      `⚠️ [Auth] Sign-in incomplete for ${email}: http=${attemptRes.status} status=${status} ffv=${ffv?.status || 'n/a'} sfv=${sfv?.status || 'n/a'} keys=${Object.keys(json).join(',')} responseKeys=${Object.keys(response || {}).join(',')} clientKeys=${Object.keys(client || {}).join(',')}`
    );
    throw new Error(`Sign-in incomplete (status: ${status}).`);
  }

  return { sessionId, userId };
}

// Cache for DEV tokens to avoid repeated Clerk API calls
const DEV_TOKEN_CACHE = new Map();

// Test IDs for dynamic endpoints
const TEST_PERSON_ID = "per_3a3e24bebf3b58133caf138f";
const TEST_COMPANY_ID = "67fd986d1347c417d52bb229";
const TEST_INVESTOR_ID = "inv_9eb8496a579270b753955764";
const TEST_USER_ID = "user_2BTdH3yJshxoCcFIUW8PnMp4AJJ";

const HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Specter API Tester - V1 Definitive</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'SF Mono', 'Menlo', monospace; background: #0a0a0a; color: #fff; padding: 20px; }
    h1 { font-size: 24px; margin-bottom: 5px; }
    .subtitle { color: #666; font-size: 12px; margin-bottom: 20px; }
    .section { background: #111; border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid #222; }
    .section-title { color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
    .input-group { margin-bottom: 12px; }
    .input-group label { display: block; color: #888; font-size: 11px; margin-bottom: 6px; }
    .input-group input { width: 100%; background: #0a0a0a; border: 1px solid #333; border-radius: 6px; padding: 10px; color: #fff; font-size: 13px; font-family: inherit; }
    .input-group input:focus { outline: none; border-color: #2563eb; }
    .token-box { background: #0a0a0a; border: 2px solid #166534; border-radius: 8px; padding: 12px; color: #4ade80; font-size: 10px; word-break: break-all; max-height: 100px; overflow: auto; }
    .token-box.expired { border-color: #7f1d1d; color: #f87171; }
    .token-info { color: #666; font-size: 11px; margin-top: 8px; }
    button { background: #2563eb; color: #fff; border: none; padding: 14px 24px; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; font-family: inherit; }
    button:hover { background: #1d4ed8; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button.secondary { background: #333; }
    .btn-row { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .filter-btn { background: #1a1a1a; border: 1px solid #333; color: #888; padding: 8px 16px; border-radius: 6px; font-size: 12px; cursor: pointer; }
    .filter-btn:hover { background: #222; color: #fff; }
    .filter-btn.active { background: #2563eb; border-color: #2563eb; color: #fff; }
    .endpoint { background: #0f0f0f; border-radius: 10px; padding: 12px; margin-bottom: 8px; border: 1px solid #1a1a1a; display: flex; align-items: center; gap: 10px; }
    .method { font-size: 10px; font-weight: bold; padding: 4px 8px; border-radius: 4px; min-width: 45px; text-align: center; }
    .method.get { background: #166534; color: #4ade80; }
    .method.post { background: #1e40af; color: #60a5fa; }
    .path { flex: 1; color: #fff; font-size: 13px; }
    .api-badge { font-size: 9px; padding: 2px 6px; border-radius: 3px; margin-left: 8px; font-weight: bold; }
    .api-badge.railway { background: #7c3aed; color: #e9d5ff; }
    .api-badge.app { background: #059669; color: #d1fae5; }
    .category-badge { font-size: 9px; padding: 2px 6px; border-radius: 3px; margin-left: 4px; background: #333; color: #888; }
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
    .result-data { background: #000; border-radius: 6px; padding: 10px; font-size: 10px; color: #888; max-height: 150px; overflow: auto; white-space: pre-wrap; }
    .stats { display: flex; gap: 20px; margin-bottom: 16px; }
    .stat { text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; }
    .stat-label { font-size: 11px; color: #666; }
    .stat-value.green { color: #4ade80; }
    .stat-value.red { color: #f87171; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <h1>🔬 Specter API Tester - V1 Definitive</h1>
  <p class="subtitle">37 Working Endpoints | Railway: ${RAILWAY_API} | App: ${APP_API}</p>

  <div class="section">
    <div class="section-title">Authentication (JWT for Railway/App APIs)</div>
    <div class="input-group">
      <label>User Email</label>
      <input type="email" id="user-email" placeholder="francisco@tryspecter.com" value="francisco@tryspecter.com">
    </div>
    <div class="btn-row">
      <button onclick="getJWT()">🔑 Get JWT Token (60 min)</button>
    </div>
    <div style="margin-top: 12px;">
      <div style="color: #888; font-size: 11px; margin-bottom: 4px;">JWT Token:</div>
      <div id="jwt-token-box" class="token-box">Click button above to generate...</div>
      <div id="jwt-token-info" class="token-info"></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Quick Actions</div>
    <div class="btn-row">
      <button onclick="runAllTests()" id="run-all-btn">▶ Run All Tests (37)</button>
      <button onclick="clearResults()" class="secondary">Clear Results</button>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Filter by Category</div>
    <div class="btn-row">
      <button class="filter-btn active" onclick="filterEndpoints('all')">All (37)</button>
      <button class="filter-btn" onclick="filterEndpoints('railway')">Railway (14)</button>
      <button class="filter-btn" onclick="filterEndpoints('app')">App (23)</button>
      <button class="filter-btn" onclick="filterEndpoints('signals')">Signals (25)</button>
      <button class="filter-btn" onclick="filterEndpoints('entity-status')">Entity Status (3)</button>
      <button class="filter-btn" onclick="filterEndpoints('search')">Search (4)</button>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Endpoints</div>
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
    const TEST_PERSON_ID = "${TEST_PERSON_ID}";
    const TEST_COMPANY_ID = "${TEST_COMPANY_ID}";
    const TEST_INVESTOR_ID = "${TEST_INVESTOR_ID}";
    const TEST_USER_ID = "${TEST_USER_ID}";

    const ENDPOINTS = [
      // === RAILWAY API (14 endpoints) ===
      // Health & Docs
      { name: "Health Check", method: "GET", path: "/health", auth: false, api: "railway", category: "health" },
      { name: "API Docs", method: "GET", path: "/docs", auth: false, api: "railway", category: "health" },
      
      // People
      { name: "People Browse", method: "POST", path: "/private/people", body: { limit: 5, offset: 0 }, auth: true, api: "railway", category: "people" },
      { name: "Person by ID", method: "GET", path: "/private/people/" + TEST_PERSON_ID, auth: true, api: "railway", category: "people" },
      { name: "People Count", method: "POST", path: "/private/people/count", body: {}, auth: true, api: "railway", category: "people" },
      { name: "People Export", method: "POST", path: "/private/people/export", body: { limit: 5 }, auth: true, api: "railway", category: "people" },
      
      // Companies
      { name: "Company Team", method: "GET", path: "/private/companies/" + TEST_COMPANY_ID + "/people", auth: true, api: "railway", category: "companies" },
      { name: "Department Sizes", method: "GET", path: "/private/companies/" + TEST_COMPANY_ID + "/department-sizes", auth: true, api: "railway", category: "companies" },
      
      // Quick Search
      { name: "Search History", method: "GET", path: "/private/quick-search/history", auth: true, api: "railway", category: "search" },
      { name: "Search Companies", method: "GET", path: "/private/quick-search/company?term=apple", auth: true, api: "railway", category: "search" },
      { name: "Search People", method: "GET", path: "/private/quick-search/people?term=john", auth: true, api: "railway", category: "search" },
      { name: "Search Counts", method: "GET", path: "/private/quick-search/counts?term=apple", auth: true, api: "railway", category: "search" },
      
      // Connections
      { name: "People Connections", method: "POST", path: "/private/users/people-connections", body: { people_ids: [TEST_PERSON_ID], user_id: TEST_USER_ID }, auth: true, api: "railway", category: "connections" },
      { name: "Company Connections", method: "POST", path: "/private/users/company-connections", body: { company_ids: [TEST_COMPANY_ID], user_id: TEST_USER_ID }, auth: true, api: "railway", category: "connections" },

      // === APP API (23 endpoints) ===
      // Signals - Company
      { name: "Company Signals", method: "POST", path: "/signals/company", body: { page: 0, limit: 5 }, auth: true, api: "app", category: "signals" },
      { name: "Company Count", method: "POST", path: "/signals/company/count", body: {}, auth: true, api: "app", category: "signals" },
      { name: "Company Filters", method: "GET", path: "/signals/company/filters", auth: true, api: "app", category: "signals" },
      
      // Signals - People
      { name: "People Signals", method: "POST", path: "/signals/people", body: { page: 0, limit: 5 }, auth: true, api: "app", category: "signals" },
      { name: "People Count", method: "POST", path: "/signals/people/count", body: {}, auth: true, api: "app", category: "signals" },
      { name: "People Filters", method: "GET", path: "/signals/people/filters", auth: true, api: "app", category: "signals" },
      
      // Signals - Talent
      { name: "Talent Signals", method: "POST", path: "/signals/talent", body: { page: 0, limit: 5 }, auth: true, api: "app", category: "signals" },
      { name: "Talent Count", method: "POST", path: "/signals/talent/count", body: {}, auth: true, api: "app", category: "signals" },
      { name: "Talent Filters", method: "GET", path: "/signals/talent/filters", auth: true, api: "app", category: "signals" },
      
      // Signals - Investors
      { name: "Investor Signals", method: "POST", path: "/signals/investors", body: { page: 0, limit: 5 }, auth: true, api: "app", category: "signals" },
      { name: "Investor Count", method: "POST", path: "/signals/investors/count", body: {}, auth: true, api: "app", category: "signals" },
      { name: "Investor Filters", method: "GET", path: "/signals/investors/filters", auth: true, api: "app", category: "signals" },
      
      // Signals - Revenue
      { name: "Revenue Signals", method: "POST", path: "/signals/revenue", body: { page: 0, limit: 5 }, auth: true, api: "app", category: "signals" },
      { name: "Revenue Count", method: "POST", path: "/signals/revenue/count", body: {}, auth: true, api: "app", category: "signals" },
      { name: "Revenue Filters", method: "GET", path: "/signals/revenue/filters", auth: true, api: "app", category: "signals" },
      
      // Signals - Strategic
      { name: "Strategic Signals", method: "POST", path: "/signals/strategic", body: { page: 0, limit: 5 }, auth: true, api: "app", category: "signals" },
      { name: "Strategic Count", method: "POST", path: "/signals/strategic/count", body: {}, auth: true, api: "app", category: "signals" },
      
      // Signals - Funding Rounds
      { name: "Funding Signals", method: "POST", path: "/signals/funding-rounds", body: { page: 0, limit: 5 }, auth: true, api: "app", category: "signals" },
      { name: "Funding Count", method: "POST", path: "/signals/funding-rounds/count", body: {}, auth: true, api: "app", category: "signals" },
      
      // Signals - Acquisition
      { name: "Acquisition Signals", method: "POST", path: "/signals/acquisition", body: { page: 0, limit: 5 }, auth: true, api: "app", category: "signals" },
      { name: "Acquisition Count", method: "POST", path: "/signals/acquisition/count", body: {}, auth: true, api: "app", category: "signals" },
      { name: "Acquisition Filters", method: "GET", path: "/signals/acquisition/filters", auth: true, api: "app", category: "signals" },
      
      // Signals - IPO
      { name: "IPO Signals", method: "POST", path: "/signals/ipo", body: { page: 0, limit: 5 }, auth: true, api: "app", category: "signals" },
      { name: "IPO Count", method: "POST", path: "/signals/ipo/count", body: {}, auth: true, api: "app", category: "signals" },
      { name: "IPO Filters", method: "GET", path: "/signals/ipo/filters", auth: true, api: "app", category: "signals" },
      
      // Lists & User
      { name: "Get Lists", method: "GET", path: "/lists", auth: true, api: "app", category: "lists" },
      { name: "Recent Companies", method: "GET", path: "/user/recent/company", auth: true, api: "app", category: "user" },
      { name: "Recent People", method: "GET", path: "/user/recent/people", auth: true, api: "app", category: "user" },
      
      // Integrations & System
      { name: "Integrations", method: "GET", path: "/integrations", auth: true, api: "app", category: "system" },
      { name: "Integration Token", method: "GET", path: "/integrations/token", auth: true, api: "app", category: "system" },
      { name: "Notifications", method: "GET", path: "/notifications", auth: true, api: "app", category: "system" },
      { name: "Network Status", method: "GET", path: "/network/status", auth: true, api: "app", category: "system" },
      
      // Entity Status (3 working endpoints - with workaround mapping for missing types)
      // WORKAROUND: For signal types without native entity-status endpoints, map to working ones:
      // - Talent signals → use /entity-status/people/{personId} (talent contains person data)
      // - Revenue/Strategic/Funding/Acquisition/IPO signals → use /entity-status/company/{companyId}
      { name: "Like Person", method: "POST", path: "/entity-status/people/" + TEST_PERSON_ID, body: { status: "liked" }, auth: true, api: "app", category: "entity-status" },
      { name: "Like Company", method: "POST", path: "/entity-status/company/" + TEST_COMPANY_ID, body: { status: "liked" }, auth: true, api: "app", category: "entity-status" },
      { name: "Like Investor", method: "POST", path: "/entity-status/investors/" + TEST_INVESTOR_ID, body: { status: "liked" }, auth: true, api: "app", category: "entity-status" },
    ];

    let jwtToken = null;
    let jwtTokenExp = null;
    let currentFilter = 'all';

    function renderEndpoints() {
      const endpointsEl = document.getElementById('endpoints');
      endpointsEl.innerHTML = '';
      
      ENDPOINTS.forEach((ep, i) => {
        const show = currentFilter === 'all' || 
                     currentFilter === ep.api || 
                     currentFilter === ep.category ||
                     (currentFilter === 'signals' && ep.category === 'signals');
        
        const apiBadge = '<span class="api-badge ' + ep.api + '">' + ep.api.toUpperCase() + '</span>';
        const categoryBadge = '<span class="category-badge">' + ep.category + '</span>';
        
        endpointsEl.innerHTML += '<div class="endpoint' + (show ? '' : ' hidden') + '" data-api="' + ep.api + '" data-category="' + ep.category + '"><span class="method ' + ep.method.toLowerCase() + '">' + ep.method + '</span><span class="path">' + ep.name + apiBadge + categoryBadge + '</span><button class="test-btn" onclick="testEndpoint(' + i + ')">Test →</button></div>';
      });
    }

    function filterEndpoints(filter) {
      currentFilter = filter;
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      renderEndpoints();
    }

    renderEndpoints();

    async function getJWT() {
      const email = document.getElementById('user-email').value.trim();
      if (!email) { alert('Please enter an email'); return; }
      
      const jwtBox = document.getElementById('jwt-token-box');
      const jwtInfo = document.getElementById('jwt-token-info');
      
      jwtBox.textContent = 'Generating JWT token (60 min validity)...';
      jwtBox.className = 'token-box';
      
      try {
        const res = await fetch('/api/get-jwt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        
        if (data.jwt) {
          jwtToken = data.jwt;
          const payload = JSON.parse(atob(jwtToken.split('.')[1]));
          jwtTokenExp = new Date(payload.exp * 1000);
          jwtBox.textContent = jwtToken;
          jwtBox.className = 'token-box';
          const mins = Math.round((jwtTokenExp - Date.now()) / 60000);
          jwtInfo.textContent = 'Expires: ' + jwtTokenExp.toLocaleTimeString() + ' (in ' + mins + ' minutes)';
        } else {
          throw new Error(data.error || 'Failed to get JWT token');
        }
      } catch (e) {
        jwtBox.textContent = 'Error: ' + e.message;
        jwtBox.className = 'token-box expired';
      }
    }

    async function testEndpoint(idx) {
      const ep = ENDPOINTS[idx];
      if (ep.auth && !jwtToken) {
        alert('Get JWT Token first!');
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
            token: ep.auth ? jwtToken : null,
            api: ep.api
          })
        });
        const data = await res.json();
        addResult(ep, data.status, data.ok, data.data, Date.now() - start, data.apiBase);
      } catch (e) {
        addResult(ep, 0, false, { error: e.message }, Date.now() - start, null);
      }
    }

    async function runAllTests() {
      const email = document.getElementById('user-email').value.trim();
      if (!email) { alert('Please enter an email first'); return; }
      if (!jwtToken) await getJWT();
      clearResults();
      document.getElementById('run-all-btn').disabled = true;
      document.getElementById('run-all-btn').textContent = '⏳ Running...';
      
      for (let i = 0; i < ENDPOINTS.length; i++) {
        await testEndpoint(i);
        await new Promise(r => setTimeout(r, 150));
      }
      
      document.getElementById('run-all-btn').disabled = false;
      document.getElementById('run-all-btn').textContent = '▶ Run All Tests (37)';
    }

    function addResult(ep, status, ok, data, duration, apiBase) {
      const resultsEl = document.getElementById('results');
      const apiInfo = apiBase ? ' → ' + apiBase : '';
      
      let displayData = data;
      if (data === null) {
        displayData = '✅ Success (null response - entity status updated)';
      } else if (typeof data === 'object' && data._html) {
        displayData = '[HTML Response - Expected for /docs]';
      } else {
        displayData = JSON.stringify(data, null, 2).substring(0, 800);
      }
      
      const html = '<div class="result ' + (ok ? 'success' : 'error') + '"><div class="result-header"><span class="result-endpoint">' + (ok ? '✅' : '❌') + ' ' + ep.method + ' ' + ep.name + '<span style="color:#666;font-size:10px">' + apiInfo + '</span></span><span class="result-status ' + (ok ? 'ok' : 'err') + '">' + status + ' • ' + duration + 'ms</span></div><pre class="result-data">' + displayData + '</pre></div>';
      resultsEl.innerHTML = html + resultsEl.innerHTML;
      document.getElementById('passed').textContent = document.querySelectorAll('.result.success').length;
      document.getElementById('failed').textContent = document.querySelectorAll('.result.error').length;
    }

    function clearResults() {
      document.getElementById('results').innerHTML = '';
      document.getElementById('passed').textContent = '0';
      document.getElementById('failed').textContent = '0';
    }
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-api-key, X-API-KEY');
  
  if (req.method === 'OPTIONS') { 
    res.writeHead(204); 
    res.end(); 
    return; 
  }

  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  // Sign-up is handled via https://www.tryspecter.com/contact (no in-app user creation).
  if (req.url === '/api/create-user' && req.method === 'POST') {
    res.writeHead(410, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Sign-up is not available in-app. Please use https://www.tryspecter.com/contact' }));
    return;
  }

  // Sign-in: verify password and mint 1h JWT (auto-renewable via /api/auth/refresh-jwt).
  if (req.url === '/api/auth/sign-in' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { email, password } = JSON.parse(body);

        if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing or invalid email/password' }));
          return;
        }

        console.log(`🔐 [Auth] Password sign-in attempt for: ${email}`);

        const signIn = await signInWithPasswordWithoutBrowser(email, password);
        const sessionId = signIn.sessionId;

        const jwt = await mintJwtForSession(sessionId);
        if (!jwt) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to mint JWT for session' }));
          return;
        }

        let apiKey = null;
        let userId = signIn.userId || null;
        try {
          const usersRes = await fetch(CLERK_API + '/v1/users?email_address=' + encodeURIComponent(email), {
            headers: { 'Authorization': 'Bearer ' + CLERK_SECRET }
          });
          if (usersRes.ok) {
            const users = await usersRes.json();
            const user = users?.[0];
            userId = user?.id || userId;
            apiKey = user?.public_metadata?.apiKey || user?.private_metadata?.apiKey || apiKey;
          }
        } catch (_) {}

        const responseData = { jwt, sessionId, userId, email, apiKey, expiresInSeconds: 3600 };

        DEV_TOKEN_CACHE.set(email, { exp: Date.now() + (55 * 60 * 1000), data: responseData });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseData));
      } catch (e) {
        const status = e.statusCode || 401;
        console.error(`❌ [Auth] Sign-in failed: ${e.message}`);
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Refresh JWT for an existing session id (1h tokens, renewable while session remains active).
  if (req.url === '/api/auth/refresh-jwt' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { sessionId, email } = JSON.parse(body);
        if (!sessionId || typeof sessionId !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing sessionId' }));
          return;
        }

        const jwt = await mintJwtForSession(sessionId);
        if (!jwt) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Session is not valid or token minting failed' }));
          return;
        }

        const responseData = { jwt, sessionId, expiresInSeconds: 3600 };
        if (email && typeof email === 'string' && DEV_TOKEN_CACHE.has(email)) {
          const prev = DEV_TOKEN_CACHE.get(email);
          DEV_TOKEN_CACHE.set(email, { exp: Date.now() + (55 * 60 * 1000), data: { ...prev.data, ...responseData } });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseData));
      } catch (e) {
        console.error(`❌ [Auth] Refresh failed: ${e.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Fetch API key by email (dev-only helper). Returns null if not set in Clerk metadata.
  if (req.url === '/api/auth/get-api-key' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { email } = JSON.parse(body);
        if (!email || typeof email !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing or invalid email' }));
          return;
        }

        let apiKey = null;
        let userId = null;
        const usersRes = await fetch(CLERK_API + '/v1/users?email_address=' + encodeURIComponent(email), {
          headers: { 'Authorization': 'Bearer ' + CLERK_SECRET }
        });

        if (usersRes.ok) {
          const users = await usersRes.json();
          const user = users?.[0];
          userId = user?.id || null;
          apiKey = user?.public_metadata?.apiKey || user?.private_metadata?.apiKey || null;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ apiKey, userId, email }));
      } catch (e) {
        console.error(`❌ [Auth] get-api-key failed: ${e.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Back-compat: /api/get-jwt behaves like /api/auth/sign-in (requires password).
  if (req.url === '/api/get-jwt' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { email, password } = JSON.parse(body);
        if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing or invalid email/password' }));
          return;
        }

        if (DEV_TOKEN_CACHE.has(email)) {
          const cached = DEV_TOKEN_CACHE.get(email);
          if (cached.exp > Date.now()) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(cached.data));
            return;
          }
          DEV_TOKEN_CACHE.delete(email);
        }

        const signIn = await signInWithPasswordWithoutBrowser(email, password);
        const jwt = await mintJwtForSession(signIn.sessionId);
        if (!jwt) throw new Error('Failed to mint JWT for session');

        let apiKey = null;
        let userId = signIn.userId || null;
        try {
          const usersRes = await fetch(CLERK_API + '/v1/users?email_address=' + encodeURIComponent(email), {
            headers: { 'Authorization': 'Bearer ' + CLERK_SECRET }
          });
          if (usersRes.ok) {
            const users = await usersRes.json();
            const user = users?.[0];
            userId = user?.id || userId;
            apiKey = user?.public_metadata?.apiKey || user?.private_metadata?.apiKey || apiKey;
          }
        } catch (_) {}

        const responseData = { jwt, sessionId: signIn.sessionId, userId, email, apiKey, expiresInSeconds: 3600 };
        DEV_TOKEN_CACHE.set(email, { exp: Date.now() + (55 * 60 * 1000), data: responseData });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseData));
      } catch (e) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Flexible Proxy endpoint (supports /proxy/app/* and /proxy/railway/*)
  if (req.url.startsWith('/proxy/') && (req.method === 'GET' || req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const parts = req.url.split('/');
        const apiType = parts[2]; // 'app' or 'railway'
        const apiPath = '/' + parts.slice(3).join('/').split('?')[0];
        const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
        
        let apiBase = apiType === 'app' ? APP_API : RAILWAY_API;
        
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': req.headers['authorization'] || '',
          'x-user-id': req.headers['x-user-id'] || '',
          'x-api-key': req.headers['x-api-key'] || req.headers['X-API-KEY'] || ''
        };

        const opts = { 
          method: req.method, 
          headers 
        };
        
        if (body && req.method !== 'GET') {
          opts.body = body;
        }

        // console.log(`📡 [Proxy] ${req.method} ${apiBase}${apiPath}${queryString}`);
        
        const apiRes = await fetch(apiBase + apiPath + queryString, opts);
        
        // Forward status and headers directly without waiting for full text buffer if possible
        const contentType = apiRes.headers.get('content-type') || 'application/json';
        res.writeHead(apiRes.status, { 'Content-Type': contentType });

        if (apiRes.body) {
          // Optimized: Pipe the response body if available (Node 18+ fetch supports this)
          // Fallback to text/json if piping isn't smooth in this environment
          try {
            const reader = apiRes.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
            res.end();
          } catch (e) {
            const fallbackText = await apiRes.text();
            res.end(fallbackText);
          }
        } else {
          const responseText = await apiRes.text();
          res.end(responseText);
        }
      } catch (e) {
        console.error(`❌ [Proxy] Error: ${e.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Debug Logging Proxy (bypasses browser CORS for ingest server)
  if (req.url === '/api/debug-log' && req.method === 'POST') {
    console.log(`📝 [Log] Proxying log entry to ingest server`);
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const ingestUrl = 'http://127.0.0.1:7242/ingest/df6e2d2e-429a-4930-becf-dda1fd5d16a1';
        const logRes = await fetch(ingestUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body
        });
        res.writeHead(logRes.status, { 'Content-Type': 'application/json' });
        res.end(await logRes.text());
      } catch (e) {
        console.error(`❌ [Log] Failed to proxy log: ${e.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Legacy Proxy endpoint (keep for backward compatibility if needed)
  if (req.url === '/api/proxy' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { method, path, body: reqBody, token, api } = JSON.parse(body);
        const headers = { 'Content-Type': 'application/json' };
        
        let apiBase;
        if (api === 'app') {
          apiBase = APP_API;
        } else {
          apiBase = RAILWAY_API;
        }
        
        if (token) headers['Authorization'] = 'Bearer ' + token;
        
        const opts = { method, headers };
        if (reqBody) opts.body = JSON.stringify(reqBody);
        
        const apiRes = await fetch(apiBase + path, opts);
        const responseText = await apiRes.text();
        
        let data;
        let responseType = 'unknown';
        
        // Parse response
        try {
          if (responseText.trim() === '' || responseText.trim() === 'null') {
            data = responseText.trim() === 'null' ? null : { _empty: true };
            responseType = responseText.trim() === 'null' ? 'null' : 'empty';
          } else {
            data = JSON.parse(responseText);
            responseType = 'json';
          }
        } catch (e) {
          const isHTML = responseText.includes('<!DOCTYPE') || responseText.includes('<html');
          if (isHTML) {
            data = { _html: true, preview: responseText.substring(0, 200) };
            responseType = 'html';
          } else {
            data = { _text: true, content: responseText.substring(0, 500) };
            responseType = 'text';
          }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: apiRes.status, ok: apiRes.ok, data, apiBase, responseType }));
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

server.listen(PORT, HOST, () => {
  console.log('\n🔬 SPECTER API TESTER - V1 DEFINITIVE');
  console.log(`   Open: http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  console.log('\n   37 Working Endpoints:');
  console.log('   • Railway API: 14 endpoints');
  console.log('   • App API: 23 endpoints');
  console.log('\n   Features:');
  console.log('   • JWT Token (60 min validity)');
  console.log('   • Filter by category');
  console.log('   • Entity status for People, Companies, Investors\n');
});
