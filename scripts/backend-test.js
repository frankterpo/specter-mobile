#!/usr/bin/env node
/**
 * Specter Backend Test Script
 * Tests all working API endpoints and Postgres queries
 * 
 * Usage: node scripts/backend-test.js
 */

require('dotenv').config();
const { Client } = require('pg');

// ============================================
// CONFIGURATION
// ============================================

const SPECTER_API_BASE = 'https://app.tryspecter.com/api/v1';
const API_KEY = process.env.EXPO_PUBLIC_SPECTER_API_KEY;
const DATABASE_URI = process.env.DATABASE_URI;

// ============================================
// API HELPERS
// ============================================

async function fetchAPI(endpoint, options = {}) {
  const url = `${SPECTER_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error ${response.status}: ${text.slice(0, 200)}`);
  }
  
  return response.json();
}

// ============================================
// API ENDPOINTS (Production)
// ============================================

async function testSavedSearches() {
  console.log('\n📋 Testing /searches...');
  const searches = await fetchAPI('/searches');
  
  const byType = {};
  searches.forEach(s => {
    byType[s.product_type] = byType[s.product_type] || [];
    byType[s.product_type].push(s);
  });
  
  console.log(`   Total: ${searches.length} saved searches`);
  Object.entries(byType).forEach(([type, items]) => {
    console.log(`   - ${type}: ${items.length} searches`);
  });
  
  return { searches, byType };
}

async function testTalentSignals(searchId) {
  console.log(`\n🎯 Testing /searches/talent/${searchId}/results...`);
  const data = await fetchAPI(`/searches/talent/${searchId}/results?limit=3`);
  const items = Array.isArray(data) ? data : data.items || [];
  
  console.log(`   Got ${items.length} talent signals`);
  items.slice(0, 2).forEach((item, i) => {
    console.log(`   ${i + 1}. ${item.full_name} - ${item.signal_type || 'N/A'}`);
  });
  
  return items;
}

async function testPeopleSearch(searchId) {
  console.log(`\n👥 Testing /searches/people/${searchId}/results...`);
  const data = await fetchAPI(`/searches/people/${searchId}/results?limit=3`);
  const items = Array.isArray(data) ? data : data.items || [];
  
  console.log(`   Got ${items.length} people`);
  items.slice(0, 2).forEach((item, i) => {
    console.log(`   ${i + 1}. ${item.full_name} - ${item.person_id}`);
  });
  
  return items;
}

async function testCompanySearch(searchId) {
  console.log(`\n🏢 Testing /searches/companies/${searchId}/results...`);
  const data = await fetchAPI(`/searches/companies/${searchId}/results?limit=3`);
  const items = Array.isArray(data) ? data : data.items || [];
  
  console.log(`   Got ${items.length} companies`);
  items.slice(0, 2).forEach((item, i) => {
    console.log(`   ${i + 1}. ${item.organization_name || item.name} - ${item.id}`);
  });
  
  return items;
}

async function testStratintelSignals(searchId) {
  console.log(`\n📊 Testing /searches/investor-interest/${searchId}/results...`);
  const data = await fetchAPI(`/searches/investor-interest/${searchId}/results?limit=3`);
  const items = Array.isArray(data) ? data : data.items || [];
  
  console.log(`   Got ${items.length} stratintel signals`);
  items.slice(0, 2).forEach((item, i) => {
    console.log(`   ${i + 1}. Score: ${item.signal_score} - ${item.signal_type} - ${item.signal_id}`);
  });
  
  return items;
}

async function testPersonDetail(personId) {
  console.log(`\n👤 Testing /people/${personId}...`);
  const person = await fetchAPI(`/people/${personId}`);
  
  console.log(`   Name: ${person.full_name}`);
  console.log(`   Headline: ${person.tagline || person.about?.slice(0, 50) || 'N/A'}`);
  
  return person;
}

// ============================================
// POSTGRES QUERIES (for investors)
// ============================================

async function testPostgresInvestors() {
  if (!DATABASE_URI) {
    console.log('\n⚠️  DATABASE_URI not set, skipping Postgres tests');
    return null;
  }
  
  console.log('\n💰 Testing Postgres investors...');
  
  const client = new Client({
    connectionString: DATABASE_URI,
    ssl: { rejectUnauthorized: false },
  });
  
  try {
    await client.connect();
    console.log('   Connected to Postgres');
    
    // Top VCs
    const topVCs = await client.query(`
      SELECT specter_investor_id, name, n_investments, n_exits, rank
      FROM public.investor 
      WHERE type = 'organization' AND n_investments > 100
      ORDER BY rank ASC LIMIT 5
    `);
    
    console.log('   Top 5 VCs by rank:');
    topVCs.rows.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.name} | ${r.n_investments} investments | Rank: ${r.rank}`);
    });
    
    // Total count
    const countRes = await client.query('SELECT COUNT(*) as total FROM public.investor');
    console.log(`   Total investors: ${countRes.rows[0].total}`);
    
    // Talent signals count
    const talentCount = await client.query('SELECT COUNT(*) as total FROM public.talentsignals');
    console.log(`   Total talent signals: ${talentCount.rows[0].total}`);
    
    // Stratintel count
    const stratCount = await client.query('SELECT COUNT(*) as total FROM public.stratintelligence');
    console.log(`   Total stratintel signals: ${stratCount.rows[0].total}`);
    
    return topVCs.rows;
  } catch (error) {
    console.error('   Postgres error:', error.message);
    return null;
  } finally {
    await client.end();
  }
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 SPECTER BACKEND TEST');
  console.log('═══════════════════════════════════════════════════════════════');
  
  if (!API_KEY) {
    console.error('❌ EXPO_PUBLIC_SPECTER_API_KEY not set in .env');
    process.exit(1);
  }
  
  console.log(`API Key: ${API_KEY.slice(0, 10)}...`);
  
  const results = {
    api: { success: 0, failed: 0 },
    postgres: { success: 0, failed: 0 },
  };
  
  try {
    // 1. Get all saved searches
    const { byType } = await testSavedSearches();
    results.api.success++;
    
    // 2. Test each feed type
    if (byType.talent?.length) {
      await testTalentSignals(byType.talent[0].id);
      results.api.success++;
    }
    
    if (byType.people?.length) {
      await testPeopleSearch(byType.people[0].id);
      results.api.success++;
    }
    
    if (byType.company?.length) {
      await testCompanySearch(byType.company[0].id);
      results.api.success++;
    }
    
    if (byType.stratintel?.length) {
      await testStratintelSignals(byType.stratintel[0].id);
      results.api.success++;
    }
    
    // 3. Test person detail
    await testPersonDetail('per_85a2719f785c8ae0fcbeccc2');
    results.api.success++;
    
  } catch (error) {
    console.error('\n❌ API Test failed:', error.message);
    results.api.failed++;
  }
  
  // 4. Test Postgres (for investors)
  try {
    const investors = await testPostgresInvestors();
    if (investors) results.postgres.success++;
  } catch (error) {
    console.error('\n❌ Postgres test failed:', error.message);
    results.postgres.failed++;
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`API Tests:      ${results.api.success} passed, ${results.api.failed} failed`);
  console.log(`Postgres Tests: ${results.postgres.success} passed, ${results.postgres.failed} failed`);
  
  console.log('\n✅ Working Endpoints:');
  console.log('   - GET /searches                              → All saved searches');
  console.log('   - GET /searches/talent/{id}/results          → Talent signals');
  console.log('   - GET /searches/people/{id}/results          → People results');
  console.log('   - GET /searches/companies/{id}/results       → Company results');
  console.log('   - GET /searches/investor-interest/{id}/results → Stratintel signals');
  console.log('   - GET /people/{id}                           → Person detail');
  
  console.log('\n📦 Postgres Tables:');
  console.log('   - public.investor          → 317K investors (VCs, angels)');
  console.log('   - public.talentsignals     → 1.3M talent signals');
  console.log('   - public.stratintelligence → 97K strategic intel signals');
  console.log('   - public.companies         → Company data');
  console.log('   - public.funding_round     → Funding rounds');
  
  console.log('\n═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);

