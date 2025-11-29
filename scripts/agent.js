#!/usr/bin/env node
/**
 * Pure JSON Agent with Specter Staging API + Clerk Auth
 * 
 * Usage:
 *   echo '{"cmd":"health"}' | node scripts/agent.js
 *   CLERK_TOKEN=xxx echo '{"cmd":"people"}' | node scripts/agent.js
 */

const API_BASE = process.env.API_BASE || 'https://specter-api-staging.up.railway.app';
const CLERK_TOKEN = process.env.CLERK_TOKEN || null;

// ============================================
// API with Clerk Auth
// ============================================
async function api(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  console.error(`[API] ${options.method || 'GET'} ${url}`);
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  // Add Clerk auth if available
  if (CLERK_TOKEN) {
    headers['Authorization'] = `Bearer ${CLERK_TOKEN}`;
  }
  
  const res = await fetch(url, { ...options, headers });
  
  const text = await res.text();
  console.error(`[API] ${res.status} ${text.slice(0, 200)}`);
  
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }
  
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// ============================================
// MEMORY
// ============================================
const mem = {
  likes: [],
  dislikes: [],
  prefs: new Map(),
  
  like(e, reason) {
    const id = e.id || e.person_id || e.company_id;
    const name = e.full_name || e.organization_name || e.name || `${e.first_name || ''} ${e.last_name || ''}`.trim();
    this.likes.push({ id, name, reason, ts: Date.now() });
    this.learn(e, 1);
  },
  
  dislike(e, reason) {
    const id = e.id || e.person_id || e.company_id;
    const name = e.full_name || e.organization_name || e.name || `${e.first_name || ''} ${e.last_name || ''}`.trim();
    this.dislikes.push({ id, name, reason, ts: Date.now() });
    this.learn(e, -1);
  },
  
  learn(e, w) {
    const upd = (k) => this.prefs.set(k, Math.max(0, Math.min(1, (this.prefs.get(k) || 0.5) + w * 0.1)));
    if (e.seniority) upd(`sen:${e.seniority}`);
    if (e.level_of_seniority) upd(`sen:${e.level_of_seniority}`);
    if (e.region) upd(`reg:${e.region}`);
    (e.people_highlights || e.highlights || []).forEach(h => upd(`hl:${h}`));
    (e.experience || []).forEach(x => x.industry && upd(`ind:${x.industry}`));
    if (e.signal_type) upd(`sig:${e.signal_type}`);
    if (e.industries) e.industries.forEach(i => upd(`ind:${i}`));
  },
  
  score(e) {
    let s = 50, r = [], w = [];
    const sen = e.seniority || e.level_of_seniority;
    if (sen) {
      const p = this.prefs.get(`sen:${sen}`) || 0.5;
      if (p > 0.6) { s += 15; r.push(`sen:${sen}`); }
      else if (p < 0.4) { s -= 10; w.push(`sen:${sen}`); }
      if (['Founder', 'C-Level', 'VP', 'Executive'].some(x => sen.includes?.(x) || sen === x)) { s += 10; r.push('senior'); }
    }
    if (e.region) {
      const p = this.prefs.get(`reg:${e.region}`) || 0.5;
      if (p > 0.6) { s += 10; r.push(`reg:${e.region}`); }
      else if (p < 0.4) { s -= 5; w.push(`reg:${e.region}`); }
    }
    const strong = ['serial_founder', 'repeat_founder', 'yc', 'ex_stripe', 'ex_google', 'ex_meta', 'ex_openai', 'unicorn', 'spinout', 'new_founder', 'fortune_500', 'vc_backed'];
    (e.people_highlights || e.highlights || []).forEach(h => {
      if (strong.some(x => h.toLowerCase?.().includes(x))) { s += 8; r.push(`hl:${h}`); }
    });
    if (e.signal_type) {
      if (['New Company', 'Spinout', 'new_company'].some(x => e.signal_type.includes?.(x))) { s += 15; r.push(`sig:${e.signal_type}`); }
    }
    return { score: Math.min(100, Math.max(0, Math.round(s))), reasons: r, warnings: w };
  },
  
  isLiked(id) { return this.likes.some(l => l.id === id); },
  isDisliked(id) { return this.dislikes.some(d => d.id === id); },
  
  stats() {
    return {
      likes: this.likes.length,
      dislikes: this.dislikes.length,
      prefs: Object.fromEntries([...this.prefs.entries()].filter(([k, v]) => v !== 0.5).map(([k, v]) => [k, Math.round(v * 100)])),
    };
  },
};

// ============================================
// AGENT
// ============================================
async function run(input) {
  const { cmd, id, name, endpoint, search_id, type, limit = 20 } = input;
  const t0 = Date.now();
  
  try {
    // HEALTH
    if (cmd === 'health') {
      const data = await api('/health');
      return { ok: true, cmd, data, ms: Date.now() - t0 };
    }
    
    // RAW - call any endpoint
    if (cmd === 'raw') {
      if (!endpoint) return { ok: false, cmd, error: 'need endpoint', ms: Date.now() - t0 };
      const data = await api(endpoint);
      return { ok: true, cmd, data, ms: Date.now() - t0 };
    }
    
    // STATS (local memory)
    if (cmd === 'stats') {
      return { ok: true, cmd, data: mem.stats(), ms: Date.now() - t0 };
    }
    
    // LIKES (local memory)
    if (cmd === 'likes') {
      return { ok: true, cmd, data: mem.likes, ms: Date.now() - t0 };
    }
    
    // DISLIKES (local memory)
    if (cmd === 'dislikes') {
      return { ok: true, cmd, data: mem.dislikes, ms: Date.now() - t0 };
    }
    
    // SEARCHES
    if (cmd === 'searches') {
      const data = await api('/searches');
      return { ok: true, cmd, data, ms: Date.now() - t0 };
    }
    
    // PEOPLE
    if (cmd === 'people') {
      const data = await api(`/people?limit=${limit}`);
      return { ok: true, cmd, data, ms: Date.now() - t0 };
    }
    
    // COMPANIES
    if (cmd === 'companies') {
      const data = await api(`/companies?limit=${limit}`);
      return { ok: true, cmd, data, ms: Date.now() - t0 };
    }
    
    // PERSON by ID
    if (cmd === 'person') {
      if (!id) return { ok: false, cmd, error: 'need id', ms: Date.now() - t0 };
      const data = await api(`/people/${id}`);
      const { score, reasons, warnings } = mem.score(data);
      return { ok: true, cmd, data: { ...data, _score: score, _reasons: reasons, _warnings: warnings }, ms: Date.now() - t0 };
    }
    
    // COMPANY by ID
    if (cmd === 'company') {
      if (!id) return { ok: false, cmd, error: 'need id', ms: Date.now() - t0 };
      const data = await api(`/companies/${id}`);
      return { ok: true, cmd, data, ms: Date.now() - t0 };
    }
    
    // SEARCH RESULTS
    if (cmd === 'results') {
      if (!search_id) return { ok: false, cmd, error: 'need search_id', ms: Date.now() - t0 };
      const searchType = type || 'people';
      const data = await api(`/searches/${searchType}/${search_id}/results?limit=${limit}`);
      return { ok: true, cmd, data, ms: Date.now() - t0 };
    }
    
    // TALENT SIGNALS
    if (cmd === 'talent') {
      if (!search_id) return { ok: false, cmd, error: 'need search_id', ms: Date.now() - t0 };
      const data = await api(`/searches/talent/${search_id}/results?limit=${limit}`);
      return { ok: true, cmd, data, ms: Date.now() - t0 };
    }
    
    // SOURCE - score signals
    if (cmd === 'source' || cmd === 'score') {
      let data;
      if (search_id) {
        const searchType = type || 'people';
        data = await api(`/searches/${searchType}/${search_id}/results?limit=${limit}`);
      } else {
        data = await api(`/people?limit=${limit}`);
      }
      
      const items = Array.isArray(data) ? data : (data.items || data.results || []);
      const scored = items.map(e => {
        const eid = e.id || e.person_id || e.company_id;
        const ename = e.full_name || e.organization_name || `${e.first_name || ''} ${e.last_name || ''}`.trim();
        const { score, reasons, warnings } = mem.score(e);
        const status = mem.isLiked(eid) ? 'liked' : mem.isDisliked(eid) ? 'disliked' : 'new';
        return { id: eid, name: ename, score, reasons, warnings, status };
      }).sort((a, b) => b.score - a.score);
      
      const high = scored.filter(s => s.score >= 70 && s.status === 'new');
      return { ok: true, cmd, data: { total: scored.length, high: high.length, signals: scored, bulk_ids: high.map(h => h.id) }, ms: Date.now() - t0 };
    }
    
    // LIKE
    if (cmd === 'like') {
      if (!id) return { ok: false, cmd, error: 'need id', ms: Date.now() - t0 };
      const entity = await api(`/people/${id}`).catch(() => null) || await api(`/companies/${id}`).catch(() => null);
      if (!entity) return { ok: false, cmd, error: `not_found: ${id}`, ms: Date.now() - t0 };
      
      const eid = entity.id || entity.person_id || entity.company_id;
      if (mem.isLiked(eid)) return { ok: true, cmd, data: { id: eid, already: true }, ms: Date.now() - t0 };
      
      // Call API to like
      await api(`/people/${id}/like`, { method: 'POST' }).catch(() => {});
      mem.like(entity, 'user');
      return { ok: true, cmd, data: { id: eid, name: entity.full_name || entity.organization_name, liked: true }, ms: Date.now() - t0 };
    }
    
    // DISLIKE
    if (cmd === 'dislike' || cmd === 'pass') {
      if (!id) return { ok: false, cmd, error: 'need id', ms: Date.now() - t0 };
      const entity = await api(`/people/${id}`).catch(() => null) || await api(`/companies/${id}`).catch(() => null);
      if (!entity) return { ok: false, cmd, error: `not_found: ${id}`, ms: Date.now() - t0 };
      
      const eid = entity.id || entity.person_id || entity.company_id;
      if (mem.isDisliked(eid)) return { ok: true, cmd, data: { id: eid, already: true }, ms: Date.now() - t0 };
      
      // Call API to dislike
      await api(`/people/${id}/dislike`, { method: 'POST' }).catch(() => {});
      mem.dislike(entity, 'user');
      return { ok: true, cmd, data: { id: eid, name: entity.full_name || entity.organization_name, disliked: true }, ms: Date.now() - t0 };
    }
    
    // BULK
    if (cmd === 'bulk') {
      let data;
      if (search_id) {
        data = await api(`/searches/people/${search_id}/results?limit=50`);
      } else {
        data = await api(`/people?limit=50`);
      }
      
      const items = Array.isArray(data) ? data : (data.items || data.results || []);
      const tolike = items.filter(e => {
        const eid = e.id || e.person_id;
        if (mem.isLiked(eid) || mem.isDisliked(eid)) return false;
        return mem.score(e).score >= 70;
      });
      
      const liked = [];
      for (const e of tolike) {
        const eid = e.id || e.person_id;
        await api(`/people/${eid}/like`, { method: 'POST' }).catch(() => {});
        mem.like(e, 'bulk');
        liked.push({ id: eid, name: e.full_name || `${e.first_name} ${e.last_name}` });
      }
      
      return { ok: true, cmd, data: { count: liked.length, liked, stats: mem.stats() }, ms: Date.now() - t0 };
    }
    
    return { 
      ok: false, 
      cmd, 
      error: 'unknown_cmd', 
      available: ['health', 'raw', 'stats', 'likes', 'dislikes', 'searches', 'people', 'companies', 'person', 'company', 'results', 'talent', 'source', 'like', 'dislike', 'bulk'],
      ms: Date.now() - t0 
    };
    
  } catch (e) {
    return { ok: false, cmd, error: e.message, ms: Date.now() - t0 };
  }
}

// ============================================
// MAIN
// ============================================
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', async () => {
  try {
    const lines = input.trim().split('\n').filter(l => l.trim());
    const results = [];
    for (const line of lines) {
      try {
        const cmd = JSON.parse(line);
        results.push(await run(cmd));
      } catch (e) {
        results.push({ ok: false, error: 'invalid_json', input: line });
      }
    }
    console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: e.message }));
  }
});

setTimeout(() => {
  if (!input) {
    console.log(JSON.stringify({ 
      api: API_BASE,
      auth: CLERK_TOKEN ? 'Bearer token set' : 'No auth (set CLERK_TOKEN)',
      cmds: ['health', 'raw', 'searches', 'people', 'companies', 'person', 'company', 'results', 'talent', 'source', 'like', 'dislike', 'bulk', 'stats', 'likes', 'dislikes']
    }));
    process.exit(0);
  }
}, 100);
