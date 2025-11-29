#!/usr/bin/env node
/**
 * RL Agentic Evaluation
 * 
 * AI autonomously executes tools to gather context before scoring:
 * 1. get_company_detail(company_id) - funding, stage, investors
 * 2. get_person_detail(person_id) - full profile, about, education
 * 3. check_interest_signals - investor interest signals
 * 
 * Usage: node scripts/rl-agentic.js
 */

require('dotenv').config();
const readline = require('readline');
const fs = require('fs');

const API_KEY = process.env.EXPO_PUBLIC_SPECTER_API_KEY;
const API_BASE = 'https://app.tryspecter.com/api/v1';
const DATA_FILE = './scripts/rl-agentic-data.json';

// ============================================
// PERSONA RECIPES
// ============================================

const RECIPES = {
  early: {
    name: '🌱 Early Stage VC',
    stage: 'Stealth to Seed',
    positiveHighlights: ['serial_founder', 'prior_exit', 'prior_vc_backed_founder', 'top_university', 'major_tech_experience', 'technical', 'yc_alum', 'phd'],
    positiveSignals: ['New Company', 'new_founder', 'spinout'],
    positiveTitles: ['Founder', 'CEO', 'CTO', 'Co-Founder'],
    valuedCompanies: ['Google', 'Meta', 'Facebook', 'Apple', 'Amazon', 'Microsoft', 'Stripe', 'OpenAI', 'Anthropic', 'DeepMind', 'Uber', 'Airbnb', 'Coinbase', 'Databricks', 'Snowflake'],
    deepDiveBoosts: {
      hasFunding: 5,
      hasInvestors: 5,
      bioMentionsBuilding: 5,
      bioMentionsExit: 5,
      hasEducation: 3,
    },
  },
  growth: {
    name: '📈 Growth Stage VC',
    stage: 'Series A to D',
    positiveHighlights: ['repeat_founder', 'scaled_before', 'prior_exit', 'revenue', 'series_a', 'series_b'],
    positiveSignals: ['expansion', 'hiring', 'new_market'],
    positiveTitles: ['CEO', 'COO', 'VP', 'Director'],
    valuedCompanies: ['Stripe', 'Databricks', 'Snowflake', 'Figma', 'Notion', 'Linear', 'Vercel'],
    deepDiveBoosts: {
      hasFunding: 10,
      hasInvestors: 10,
      fundingOver5M: 15,
      employeesOver50: 10,
    },
  },
  pe: {
    name: '🏦 Private Equity',
    stage: 'Late-Stage & M&A',
    positiveHighlights: ['public_company_exp', 'cfo', 'operations', 'fortune_500_experience', 'prior_ipo'],
    positiveSignals: ['profitability', 'market_leader', 'acquisition'],
    positiveTitles: ['CEO', 'CFO', 'COO', 'President'],
    valuedCompanies: ['McKinsey', 'Bain', 'BCG', 'Goldman', 'Morgan Stanley', 'JPMorgan'],
    deepDiveBoosts: {
      hasFunding: 5,
      fundingOver20M: 15,
      employeesOver100: 15,
      hasProfitability: 20,
    },
  },
  ib: {
    name: '🤝 Investment Banker',
    stage: 'M&A and IPO Advisory',
    positiveHighlights: ['market_leader', 'recurring_revenue', 'prior_ipo', 'prior_exit'],
    positiveSignals: ['acquisition_target', 'ipo_ready', 'strategic_value'],
    positiveTitles: ['CEO', 'CFO', 'Founder'],
    valuedCompanies: ['Goldman', 'Morgan Stanley', 'JPMorgan', 'Lazard', 'Evercore'],
    deepDiveBoosts: {
      hasFunding: 10,
      hasInvestors: 10,
      fundingOver10M: 15,
    },
  },
};

// ============================================
// DATA STORE
// ============================================

let store = {
  activePersona: 'early',
  evaluations: [],
  corrections: [],
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      store = { ...store, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
    }
  } catch (e) {}
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

// ============================================
// AGENTIC TOOLS
// ============================================

async function toolGetCompanyDetail(companyId) {
  try {
    const res = await fetch(`${API_BASE}/companies/${companyId}`, {
      headers: { 'X-API-KEY': API_KEY }
    });
    if (res.ok) return await res.json();
    return null;
  } catch (e) { return null; }
}

async function toolGetPersonDetail(personId) {
  try {
    const res = await fetch(`${API_BASE}/people/${personId}`, {
      headers: { 'X-API-KEY': API_KEY }
    });
    if (res.ok) return await res.json();
    return null;
  } catch (e) { return null; }
}

// ============================================
// AGENTIC EVALUATION
// ============================================

async function agentEvaluate(person, personaId = 'early') {
  const recipe = RECIPES[personaId];
  const currentJob = person.experience?.find(e => e.is_current);
  const highlights = person.highlights || [];
  const signal = person.signal_type || '';
  const title = currentJob?.title || '';
  const allCompanies = person.experience?.map(e => e.company_name) || [];
  
  let score = 50;
  const reasons = [];
  const concerns = [];
  const toolCalls = [];
  
  console.log('');
  console.log('🤖 AGENT EVALUATING: ' + person.full_name);
  console.log('────────────────────────────────────────────────────────────────────');
  
  // PHASE 1: Quick scoring from highlights
  console.log('📊 Phase 1: Quick Signal Scoring');
  
  recipe.positiveHighlights.forEach(h => {
    if (highlights.some(hl => hl.toLowerCase().includes(h.toLowerCase()))) {
      score += 8;
      reasons.push('✓ ' + h);
    }
  });
  
  recipe.positiveSignals.forEach(s => {
    if (signal.toLowerCase().includes(s.toLowerCase())) {
      score += 10;
      reasons.push('✓ Signal: ' + s);
    }
  });
  
  recipe.positiveTitles.forEach(t => {
    if (title.toLowerCase().includes(t.toLowerCase())) {
      score += 10;
      reasons.push('✓ Title: ' + t);
    }
  });
  
  const matchedCompanies = allCompanies.filter(c => 
    recipe.valuedCompanies.some(v => c.toLowerCase().includes(v.toLowerCase()))
  );
  if (matchedCompanies.length > 0) {
    score += 10;
    reasons.push('✓ Experience: ' + matchedCompanies.slice(0, 2).join(', '));
  }
  
  console.log('   Quick Score: ' + Math.min(100, score) + '/100');
  console.log('   Signals: ' + reasons.slice(0, 3).join(', '));
  
  // PHASE 2: Autonomous Deep Dive (if borderline or has IDs)
  const shouldDeepDive = score >= 40 && score < 90;
  
  if (shouldDeepDive || currentJob?.company_id || person.person_id) {
    console.log('');
    console.log('🔍 Phase 2: Autonomous Tool Execution');
    
    // Tool 1: Company Detail
    if (currentJob?.company_id && !currentJob.company_name?.toLowerCase().includes('stealth')) {
      console.log('   → get_company_detail(' + currentJob.company_id + ')');
      const company = await toolGetCompanyDetail(currentJob.company_id);
      toolCalls.push({ tool: 'get_company_detail', id: currentJob.company_id, result: company ? 'success' : 'not_found' });
      
      if (company) {
        console.log('     ✓ ' + (company.organization_name || company.name));
        
        if (company.total_funding_usd > 0) {
          const fundingM = company.total_funding_usd / 1000000;
          console.log('     ✓ Funding: $' + fundingM.toFixed(1) + 'M');
          score += recipe.deepDiveBoosts.hasFunding || 5;
          reasons.push('✓ Company funded: $' + fundingM.toFixed(1) + 'M');
          
          if (fundingM > 5 && recipe.deepDiveBoosts.fundingOver5M) {
            score += recipe.deepDiveBoosts.fundingOver5M;
          }
          if (fundingM > 10 && recipe.deepDiveBoosts.fundingOver10M) {
            score += recipe.deepDiveBoosts.fundingOver10M;
          }
          if (fundingM > 20 && recipe.deepDiveBoosts.fundingOver20M) {
            score += recipe.deepDiveBoosts.fundingOver20M;
          }
        }
        
        if (company.investors?.length > 0) {
          console.log('     ✓ Investors: ' + company.investors.slice(0, 3).join(', '));
          score += recipe.deepDiveBoosts.hasInvestors || 5;
          reasons.push('✓ Has investors: ' + company.investors.slice(0, 2).join(', '));
        }
        
        if (company.employee_count > 0) {
          console.log('     ✓ Employees: ' + company.employee_count);
          if (company.employee_count > 50 && recipe.deepDiveBoosts.employeesOver50) {
            score += recipe.deepDiveBoosts.employeesOver50;
          }
          if (company.employee_count > 100 && recipe.deepDiveBoosts.employeesOver100) {
            score += recipe.deepDiveBoosts.employeesOver100;
          }
        }
      } else {
        console.log('     ⚠ Company not found in database');
      }
    }
    
    // Tool 2: Person Detail
    if (person.person_id) {
      console.log('   → get_person_detail(' + person.person_id + ')');
      const personDetail = await toolGetPersonDetail(person.person_id);
      toolCalls.push({ tool: 'get_person_detail', id: person.person_id, result: personDetail ? 'success' : 'not_found' });
      
      if (personDetail) {
        console.log('     ✓ ' + personDetail.full_name);
        
        if (personDetail.about) {
          const about = personDetail.about.toLowerCase();
          console.log('     ✓ About: ' + personDetail.about.slice(0, 60) + '...');
          
          if ((about.includes('built') || about.includes('founded') || about.includes('building')) && recipe.deepDiveBoosts.bioMentionsBuilding) {
            score += recipe.deepDiveBoosts.bioMentionsBuilding;
            reasons.push('✓ Bio: mentions building/founding');
          }
          
          if ((about.includes('exit') || about.includes('acquired') || about.includes('sold')) && recipe.deepDiveBoosts.bioMentionsExit) {
            score += recipe.deepDiveBoosts.bioMentionsExit;
            reasons.push('✓ Bio: mentions exit/acquisition');
          }
        }
        
        if (personDetail.education?.length > 0 && recipe.deepDiveBoosts.hasEducation) {
          const schools = personDetail.education.map(e => e.school_name).filter(Boolean).slice(0, 2);
          if (schools.length > 0) {
            console.log('     ✓ Education: ' + schools.join(', '));
            score += recipe.deepDiveBoosts.hasEducation;
          }
        }
        
        if (personDetail.linkedin_url) {
          console.log('     ✓ LinkedIn: ' + personDetail.linkedin_url);
        }
      }
    }
  }
  
  // Clamp score
  score = Math.max(0, Math.min(100, score));
  
  // Determine verdict
  let verdict, emoji;
  if (score >= 85) { verdict = 'STRONG LIKE'; emoji = '🔥'; }
  else if (score >= 65) { verdict = 'LEAN LIKE'; emoji = '👍'; }
  else if (score >= 45) { verdict = 'NEUTRAL'; emoji = '🤔'; }
  else if (score >= 25) { verdict = 'LEAN PASS'; emoji = '👎'; }
  else { verdict = 'STRONG PASS'; emoji = '❌'; }
  
  console.log('');
  console.log('────────────────────────────────────────────────────────────────────');
  const bar = '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10));
  console.log(emoji + ' ' + verdict + ' | Score: ' + score + '/100 [' + bar + ']');
  console.log('   Reasons: ' + reasons.slice(0, 4).join(', '));
  if (concerns.length) console.log('   Concerns: ' + concerns.join(', '));
  console.log('   Tools Called: ' + toolCalls.length);
  
  return {
    personId: person.person_id,
    name: person.full_name,
    score,
    verdict,
    emoji,
    reasons,
    concerns,
    toolCalls,
    recommendation: score >= 60 ? 'LIKE' : 'DISLIKE',
  };
}

// ============================================
// MAIN
// ============================================

async function main() {
  loadData();
  
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('🤖 RL AGENTIC EVALUATION');
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('The agent autonomously executes tools to gather context:');
  console.log('  1. get_company_detail(company_id) - funding, investors');
  console.log('  2. get_person_detail(person_id) - full profile, bio');
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Active Persona: ' + RECIPES[store.activePersona].name);
  console.log('');
  
  // Fetch candidates
  const res = await fetch(`${API_BASE}/searches/talent/4991/results?limit=5`, {
    headers: { 'X-API-KEY': API_KEY }
  });
  const data = await res.json();
  const people = Array.isArray(data) ? data : (data.items || []);
  
  console.log('Fetched ' + people.length + ' candidates');
  
  const results = [];
  for (const person of people) {
    const result = await agentEvaluate(person, store.activePersona);
    results.push(result);
  }
  
  // Summary
  console.log('');
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('════════════════════════════════════════════════════════════════════════');
  results.forEach((r, i) => {
    const bar = '█'.repeat(Math.round(r.score / 10)) + '░'.repeat(10 - Math.round(r.score / 10));
    console.log((i + 1) + '. ' + r.emoji + ' ' + r.score + '/100 [' + bar + '] ' + r.name);
  });
  
  console.log('');
  console.log('Provide feedback:');
  console.log('  AGREE #1       - Confirm AI evaluation');
  console.log('  DISAGREE #1 <reason> - Override (trains the model)');
  
  saveData();
}

main().catch(console.error);

