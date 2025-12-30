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

loadEnvFile(path.join(__dirname, '.env.local'));
loadEnvFile(path.join(__dirname, '.env'));

const JWT = process.env.SPECTER_TEST_JWT;
const PROXY = process.env.SPECTER_PROXY_ORIGIN ? `${process.env.SPECTER_PROXY_ORIGIN}/proxy/app` : "http://localhost:3333/proxy/app";

if (!JWT) {
  console.error("❌ Missing SPECTER_TEST_JWT in environment (do not hardcode tokens in this repo).");
  process.exit(1);
}

function redactSecrets(value) {
  if (!value) return value;
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.toLowerCase().includes('token') || k.toLowerCase().includes('jwt') || k.toLowerCase().includes('secret')) {
        out[k] = typeof v === 'string' ? '<redacted>' : redactSecrets(v);
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 80 && (value.startsWith('eyJ') || value.includes('.'))) {
    return '<redacted>';
  }
  return value;
}

async function fetchSample(name, endpoint, options = {}) {
  console.log(`Fetching ${name}...`);
  const res = await fetch(`${PROXY}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JWT}`,
      ...options.headers
    }
  });
  
  const status = res.status;
  const ok = res.ok;
  let data;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = text;
  }
  data = redactSecrets(data);
  
  const category = options.category || 'misc';
  const dir = path.join('api-contracts', 'samples', category);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  fs.writeFileSync(path.join(dir, `${name}__res.json`), JSON.stringify({ status, ok, data }, null, 2));
  if (options.body) {
    fs.writeFileSync(path.join(dir, `${name}__req.json`), options.body);
  }
  
  return data;
}

async function run() {
  // App Core
  await fetchSample('GetLists', '/lists', { category: 'app' });
  await fetchSample('RecentCompanies', '/user/recent/company', { category: 'app' });
  await fetchSample('RecentPeople', '/user/recent/people', { category: 'app' });
  await fetchSample('Integrations', '/integrations', { category: 'app' });
  await fetchSample('IntegrationToken', '/integrations/token', { category: 'app' });
  await fetchSample('Notifications', '/notifications', { category: 'app' });
  await fetchSample('NetworkStatus', '/network/status', { category: 'app' });
  
  // Entity Status
  const personId = "per_3a3e24bebf3b58133caf138f";
  const companyId = "67fd986d1347c417d52bb229";
  const investorId = "inv_9eb8496a579270b753955764";
  
  await fetchSample('LikePerson', `/entity-status/people/${personId}`, {
    method: 'POST',
    body: JSON.stringify({ status: "liked" }),
    category: 'entity'
  });
  
  await fetchSample('LikeCompany', `/entity-status/company/${companyId}`, {
    method: 'POST',
    body: JSON.stringify({ status: "liked" }),
    category: 'entity'
  });
  
  await fetchSample('LikeInvestor', `/entity-status/investors/${investorId}`, {
    method: 'POST',
    body: JSON.stringify({ status: "liked" }),
    category: 'entity'
  });

  console.log('Done!');
}

run();
