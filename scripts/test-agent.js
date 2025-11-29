#!/usr/bin/env node
/**
 * Simple agent test script
 * Run with: node scripts/test-agent.js
 * 
 * This tests the pure backend logic without React Native.
 */

const API_KEY = process.env.EXPO_PUBLIC_SPECTER_API_KEY || 'da7c8f4ad15abad49d85b975e088d9790dab21717849fc1bc0e47da0b1ff02df3';
const API_BASE = 'https://app.tryspecter.com/api/v1';

// ============================================
// API HELPERS
// ============================================

async function fetchWithKey(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  console.log(`📡 ${options.method || 'GET'} ${url}`);
  
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': API_KEY,
      ...options.headers,
    },
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  
  return res.json();
}

// ============================================
// TEST FUNCTIONS
// ============================================

async function testSavedSearches() {
  console.log('\n🔍 Testing Saved Searches...\n');
  
  const searches = await fetchWithKey('/searches');
  console.log(`Found ${searches.length} saved searches:`);
  
  searches.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name} (${s.product_type}) - ${s.full_count} results`);
  });
  
  return searches;
}

async function testPeopleSearch(searchId) {
  console.log(`\n👥 Testing People Search (ID: ${searchId})...\n`);
  
  const results = await fetchWithKey(`/searches/people/${searchId}/results?limit=10`);
  const items = Array.isArray(results) ? results : (results.items || []);
  
  console.log(`Found ${items.length} people:`);
  items.slice(0, 5).forEach((p, i) => {
    const name = p.full_name || `${p.first_name} ${p.last_name}`;
    const job = p.experience?.find(e => e.is_current);
    console.log(`  ${i + 1}. ${name}`);
    if (job) console.log(`     ${job.title} at ${job.company_name}`);
    if (p.people_highlights?.length) console.log(`     Highlights: ${p.people_highlights.slice(0, 3).join(', ')}`);
  });
  
  return items;
}

async function testTalentSignals(searchId) {
  console.log(`\n🎯 Testing Talent Signals (ID: ${searchId})...\n`);
  
  const results = await fetchWithKey(`/searches/talent/${searchId}/results?limit=10`);
  const items = Array.isArray(results) ? results : (results.items || []);
  
  console.log(`Found ${items.length} talent signals:`);
  items.slice(0, 5).forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.full_name || 'Unknown'}`);
    console.log(`     Signal: ${s.signal_type} (Score: ${s.signal_score})`);
    if (s.new_position_company_name) console.log(`     New: ${s.new_position_title} at ${s.new_position_company_name}`);
  });
  
  return items;
}

async function testCompanySearch(searchId) {
  console.log(`\n🏢 Testing Company Search (ID: ${searchId})...\n`);
  
  const results = await fetchWithKey(`/searches/companies/${searchId}/results?limit=10`);
  const items = Array.isArray(results) ? results : (results.items || []);
  
  console.log(`Found ${items.length} companies:`);
  items.slice(0, 5).forEach((c, i) => {
    const name = c.organization_name || c.name;
    console.log(`  ${i + 1}. ${name}`);
    if (c.industries?.length) console.log(`     Industry: ${c.industries[0]}`);
    if (c.funding?.total_funding_usd) console.log(`     Funding: $${(c.funding.total_funding_usd / 1e6).toFixed(1)}M`);
  });
  
  return items;
}

async function testPersonDetail(personId) {
  console.log(`\n📋 Testing Person Detail (ID: ${personId})...\n`);
  
  const person = await fetchWithKey(`/people/${personId}`);
  
  console.log(`Name: ${person.full_name}`);
  console.log(`Location: ${person.location || 'N/A'}`);
  console.log(`Seniority: ${person.seniority || 'N/A'}`);
  
  if (person.experience?.length) {
    const current = person.experience.find(e => e.is_current);
    if (current) {
      console.log(`Current: ${current.title} at ${current.company_name}`);
    }
  }
  
  if (person.people_highlights?.length) {
    console.log(`Highlights: ${person.people_highlights.join(', ')}`);
  }
  
  return person;
}

async function testCompanyDetail(companyId) {
  console.log(`\n🏢 Testing Company Detail (ID: ${companyId})...\n`);
  
  const company = await fetchWithKey(`/companies/${companyId}`);
  
  console.log(`Name: ${company.organization_name || company.name}`);
  console.log(`Industry: ${company.industries?.join(', ') || 'N/A'}`);
  console.log(`Stage: ${company.growth_stage || 'N/A'}`);
  
  if (company.funding) {
    console.log(`Total Funding: $${((company.funding.total_funding_usd || 0) / 1e6).toFixed(1)}M`);
    console.log(`Last Round: ${company.funding.last_funding_type || 'N/A'}`);
  }
  
  if (company.investors?.length) {
    console.log(`Investors: ${company.investors.slice(0, 5).join(', ')}`);
  }
  
  return company;
}

// ============================================
// SCORING SIMULATION
// ============================================

function scoreSignal(signal, preferences = {}) {
  let score = 50; // Base score
  const reasons = [];
  
  // Seniority scoring
  const seniority = signal.seniority || signal.level_of_seniority;
  if (seniority) {
    if (['C-Level', 'VP', 'Director', 'Founder'].some(s => seniority.includes(s))) {
      score += 15;
      reasons.push(`Senior: ${seniority}`);
    }
  }
  
  // Highlights scoring
  const highlights = signal.people_highlights || signal.highlights || [];
  const goodHighlights = ['unicorn', 'serial_founder', 'yc', 'fortune_500', 'vc_backed'];
  for (const h of highlights) {
    if (goodHighlights.some(g => h.toLowerCase().includes(g))) {
      score += 10;
      reasons.push(`Highlight: ${h}`);
    }
  }
  
  // Signal type scoring
  if (signal.signal_type) {
    if (signal.signal_type.toLowerCase().includes('founder') || 
        signal.signal_type.toLowerCase().includes('new company')) {
      score += 20;
      reasons.push(`Signal: ${signal.signal_type}`);
    }
  }
  
  // Region scoring (if preference set)
  if (preferences.region && signal.region?.toLowerCase().includes(preferences.region.toLowerCase())) {
    score += 10;
    reasons.push(`Region match: ${signal.region}`);
  }
  
  return { score: Math.min(100, score), reasons };
}

async function testScoring(signals) {
  console.log('\n📊 Testing Signal Scoring...\n');
  
  const preferences = {
    region: 'north america',
  };
  
  const scored = signals.map(s => {
    const { score, reasons } = scoreSignal(s, preferences);
    return {
      name: s.full_name || `${s.first_name} ${s.last_name}`,
      id: s.person_id || s.id,
      score,
      reasons,
    };
  }).sort((a, b) => b.score - a.score);
  
  console.log('Scored signals:');
  scored.slice(0, 10).forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name} - ${s.score}%`);
    if (s.reasons.length) console.log(`     ${s.reasons.join(', ')}`);
  });
  
  const high = scored.filter(s => s.score >= 70).length;
  const medium = scored.filter(s => s.score >= 50 && s.score < 70).length;
  const low = scored.filter(s => s.score < 50).length;
  
  console.log(`\nDistribution: ${high} high, ${medium} medium, ${low} low`);
  
  return scored;
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🧪 Specter Agent Backend Test\n');
  console.log('='.repeat(50));
  console.log(`API Key: ${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)}`);
  console.log('='.repeat(50));
  
  try {
    // 1. Get saved searches
    const searches = await testSavedSearches();
    
    // 2. Test each search type
    const peopleSearch = searches.find(s => s.product_type === 'people');
    const talentSearch = searches.find(s => s.product_type === 'talent');
    const companySearch = searches.find(s => s.product_type === 'company');
    
    let allPeople = [];
    
    if (peopleSearch) {
      const people = await testPeopleSearch(peopleSearch.id);
      allPeople = [...allPeople, ...people];
      
      // Test person detail
      if (people.length > 0 && people[0].id) {
        await testPersonDetail(people[0].id);
      }
    }
    
    if (talentSearch) {
      const signals = await testTalentSignals(talentSearch.id);
      allPeople = [...allPeople, ...signals];
    }
    
    if (companySearch) {
      const companies = await testCompanySearch(companySearch.id);
      
      // Test company detail
      if (companies.length > 0) {
        const companyId = companies[0].id || companies[0].company_id;
        if (companyId) {
          await testCompanyDetail(companyId);
        }
      }
    }
    
    // 3. Test scoring
    if (allPeople.length > 0) {
      await testScoring(allPeople);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ All tests completed!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

