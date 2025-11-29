#!/usr/bin/env node
/**
 * RL Recipe - AI-Evaluated Reinforcement Learning with Persona Recipes
 * 
 * Based on the "Deal Sourcing Recipe" document:
 * - Early Stage VC (Stealth to Seed)
 * - Growth Stage VC (Series A to D)
 * - Private Equity (Late-Stage & M&A)
 * - Investment Banker (M&A and IPO Advisory)
 * 
 * The AI evaluates each person against the active persona's recipe,
 * provides a score and reasoning, then YOU confirm/reject to train.
 */

require('dotenv').config();
const readline = require('readline');
const fs = require('fs');

const API_KEY = process.env.EXPO_PUBLIC_SPECTER_API_KEY;
const API_BASE = 'https://app.tryspecter.com/api/v1';
const DATA_FILE = './scripts/rl-recipe-data.json';

// ============================================
// PERSONA RECIPES (from the document)
// ============================================

const RECIPES = {
  early: {
    id: 'early',
    name: '🌱 Early Stage VC',
    stage: 'Stealth to Seed',
    description: 'Pre-seed/Seed investors looking for exceptional founding teams with big ideas, often before revenue or product-market fit.',
    
    // WHAT TO LOOK FOR (from doc)
    positiveSignals: {
      highlights: [
        { key: 'serial_founder', weight: 3, reason: 'Prior founding experience shows they can build from scratch' },
        { key: 'prior_exit', weight: 3, reason: 'Successful exit proves ability to build and sell' },
        { key: 'prior_vc_backed_founder', weight: 2, reason: 'Knows how to work with investors' },
        { key: 'prior_vc_backed_experience', weight: 1, reason: 'Understands startup dynamics' },
        { key: 'top_university', weight: 1, reason: 'Strong academic foundation' },
        { key: 'yc_alum', weight: 2, reason: 'YC network and validation' },
        { key: 'technical', weight: 2, reason: 'Can build the product themselves' },
        { key: 'phd', weight: 1, reason: 'Deep domain expertise' },
        { key: 'major_tech_experience', weight: 2, reason: 'Learned from best-in-class companies' },
      ],
      signals: [
        { key: 'New Company', weight: 2, reason: 'Building something new from scratch' },
        { key: 'new_founder', weight: 2, reason: 'Taking the leap to found' },
        { key: 'spinout', weight: 3, reason: 'Bringing expertise from established company' },
      ],
      seniority: [
        { key: 'Founder', weight: 3, reason: 'Direct founder role' },
        { key: 'Co-Founder', weight: 3, reason: 'Direct founder role' },
        { key: 'CEO', weight: 2, reason: 'Leadership experience' },
        { key: 'CTO', weight: 2, reason: 'Technical leadership' },
        { key: 'Executive Level', weight: 1, reason: 'Senior experience' },
      ],
      experience: {
        minYears: 5,
        maxYears: 20,
        valuedCompanies: ['Google', 'Meta', 'Facebook', 'Apple', 'Amazon', 'Microsoft', 'Stripe', 'OpenAI', 'Anthropic', 'DeepMind', 'Uber', 'Airbnb', 'Coinbase', 'Databricks', 'Snowflake', 'Figma', 'Notion', 'Linear'],
        weight: 2,
      },
      locations: ['San Francisco', 'New York', 'Boston', 'Seattle', 'Austin', 'Los Angeles'],
    },
    
    // RED FLAGS (from doc)
    redFlags: [
      { pattern: 'Advisory', weight: -2, reason: 'Advisory roles are not operator roles' },
      { pattern: 'Consultant', weight: -1, reason: 'Consulting is not building' },
      { pattern: 'Chief Humanist', weight: -2, reason: 'Vague, non-standard title' },
      { pattern: 'Evangelist', weight: -1, reason: 'Marketing role, not builder' },
      { pattern: 'null', weight: -1, reason: 'Missing information is concerning' },
      { pattern: 'domain: null', weight: -1, reason: 'No website suggests very early or not serious' },
    ],
    experienceFlags: [
      { condition: 'years > 25', weight: -2, reason: 'May be overqualified for early-stage grind' },
      { condition: 'no_startup_experience', weight: -2, reason: 'Never worked in a startup environment' },
    ],
    
    // EVALUATION PROMPT
    evaluationPrompt: `As an Early Stage VC (Stealth to Seed), evaluate this founder:

KEY QUESTIONS:
1. Is this someone building something NEW from scratch?
2. Do they have the technical depth or domain expertise to execute?
3. Have they built/exited before (serial_founder, prior_exit)?
4. Do they have experience at top companies that translates to startup success?
5. Is the company early enough (stealth, pre-seed, seed)?
6. Are there any red flags (too corporate, vague role, no domain)?

SCORING GUIDE:
80-100: STRONG LIKE - Multiple strong signals (serial founder + top company + technical)
60-79:  LEAN LIKE - Good signals, worth a meeting
40-59:  NEUTRAL - Mixed signals, needs more info
20-39:  LEAN PASS - Red flags outweigh positives
0-19:   STRONG PASS - Clear misfit for early stage`,
  },

  growth: {
    id: 'growth',
    name: '📈 Growth Stage VC',
    stage: 'Series A to D',
    description: 'Investors focused on companies with proven product-market fit, looking for scalability and path to profitability.',
    
    positiveSignals: {
      highlights: [
        { key: 'repeat_founder', weight: 3, reason: 'Proven ability to scale' },
        { key: 'scaled_before', weight: 3, reason: 'Experience growing a company' },
        { key: 'prior_exit', weight: 2, reason: 'Knows the endgame' },
        { key: 'revenue', weight: 2, reason: 'Already generating revenue' },
        { key: 'series_a', weight: 2, reason: 'Already raised growth capital' },
        { key: 'series_b', weight: 3, reason: 'Validated by growth investors' },
      ],
      signals: [
        { key: 'expansion', weight: 2, reason: 'Company is scaling' },
        { key: 'hiring', weight: 1, reason: 'Team growth indicates traction' },
        { key: 'new_market', weight: 2, reason: 'Geographic or vertical expansion' },
      ],
      metrics: ['ARR', 'revenue growth', 'LTV/CAC', 'net retention', 'churn'],
    },
    
    redFlags: [
      { pattern: 'stealth', weight: -2, reason: 'Too early for growth stage' },
      { pattern: 'pre-seed', weight: -2, reason: 'Too early for growth stage' },
      { pattern: 'no revenue', weight: -3, reason: 'Growth stage needs proven revenue' },
    ],
    
    evaluationPrompt: `As a Growth Stage VC (Series A-D), evaluate this opportunity:

KEY QUESTIONS:
1. Does this company have proven product-market fit?
2. Are they scaling revenue and team?
3. Is the team experienced in scaling companies?
4. What are the key growth metrics (ARR, retention, LTV/CAC)?
5. Is there a clear path to profitability or exit?

SCORING GUIDE:
80-100: STRONG LIKE - Proven traction + experienced team + clear metrics
60-79:  LEAN LIKE - Good traction, team needs validation
40-59:  NEUTRAL - Early signs of PMF but unproven scale
20-39:  LEAN PASS - Too early or unclear metrics
0-19:   STRONG PASS - Pre-PMF or declining metrics`,
  },

  pe: {
    id: 'pe',
    name: '🏦 Private Equity',
    stage: 'Late-Stage & M&A',
    description: 'Investors targeting mature companies with stable cash flows, seeking operational improvements and leveraged returns.',
    
    positiveSignals: {
      highlights: [
        { key: 'public_company_exp', weight: 2, reason: 'Understands scale and governance' },
        { key: 'cfo', weight: 2, reason: 'Financial discipline' },
        { key: 'operations', weight: 2, reason: 'Operational excellence' },
        { key: 'fortune_500_experience', weight: 2, reason: 'Large company experience' },
        { key: 'prior_ipo', weight: 3, reason: 'Knows the IPO process' },
      ],
      signals: [
        { key: 'profitability', weight: 3, reason: 'Cash flow positive' },
        { key: 'market_leader', weight: 2, reason: 'Defensible position' },
        { key: 'acquisition', weight: 2, reason: 'M&A experience' },
      ],
      metrics: ['EBITDA', 'cash flow', 'margins', 'debt capacity'],
    },
    
    redFlags: [
      { pattern: 'stealth', weight: -3, reason: 'PE needs established businesses' },
      { pattern: 'pre-seed', weight: -3, reason: 'Too early for PE' },
      { pattern: 'seed', weight: -2, reason: 'Too early for PE' },
      { pattern: 'burning cash', weight: -3, reason: 'PE needs positive cash flow' },
    ],
    
    evaluationPrompt: `As a Private Equity Investor, evaluate this opportunity:

KEY QUESTIONS:
1. Is this a mature, established business?
2. Does it have stable cash flows and EBITDA?
3. Is there operational improvement potential?
4. Can the business support leverage (debt)?
5. What's the exit path (sale, IPO, dividend recap)?

SCORING GUIDE:
80-100: STRONG LIKE - Stable EBITDA + clear value creation levers
60-79:  LEAN LIKE - Good fundamentals, some improvement needed
40-59:  NEUTRAL - Potential but unproven profitability
20-39:  LEAN PASS - Too early or unstable cash flows
0-19:   STRONG PASS - Pre-revenue or high risk`,
  },

  ib: {
    id: 'ib',
    name: '🤝 Investment Banker',
    stage: 'M&A and IPO Advisory',
    description: 'Advisors focused on deal viability, valuation multiples, and market timing for M&A or IPO transactions.',
    
    positiveSignals: {
      highlights: [
        { key: 'market_leader', weight: 3, reason: 'Attractive to strategic buyers' },
        { key: 'recurring_revenue', weight: 2, reason: 'Predictable, valued by acquirers' },
        { key: 'synergies', weight: 2, reason: 'Clear strategic value' },
        { key: 'prior_ipo', weight: 2, reason: 'IPO-ready experience' },
        { key: 'prior_exit', weight: 2, reason: 'M&A experience' },
      ],
      signals: [
        { key: 'acquisition_target', weight: 3, reason: 'Clear buyer interest' },
        { key: 'ipo_ready', weight: 3, reason: 'Ready for public markets' },
        { key: 'strategic_value', weight: 2, reason: 'Valuable to strategics' },
      ],
      dealCriteria: ['compelling equity story', 'realistic valuation', 'market timing'],
    },
    
    redFlags: [
      { pattern: 'unrealistic valuation', weight: -3, reason: 'Deal unlikely to close' },
      { pattern: 'messy financials', weight: -2, reason: 'Due diligence nightmare' },
      { pattern: 'stakeholder misalignment', weight: -2, reason: 'Deal could fall apart' },
    ],
    
    evaluationPrompt: `As an Investment Banker, evaluate this deal opportunity:

KEY QUESTIONS:
1. Is this company attractive to buyers or public investors?
2. Is the valuation realistic given market comps?
3. Are the financials clean and auditable?
4. Is there strategic value or synergy potential?
5. Is the market timing favorable?

SCORING GUIDE:
80-100: STRONG PURSUE - Clear buyer interest + realistic valuation
60-79:  LEAN PURSUE - Good story, needs positioning
40-59:  NEUTRAL - Potential but timing or valuation concerns
20-39:  LEAN PASS - Unlikely to close at acceptable terms
0-19:   STRONG PASS - Not a viable deal`,
  },
};

// ============================================
// MEMORY STORE
// ============================================

let store = {
  activePersona: 'early',
  personas: {
    early: { liked: [], disliked: [], corrections: [], totalReward: 0 },
    growth: { liked: [], disliked: [], corrections: [], totalReward: 0 },
    pe: { liked: [], disliked: [], corrections: [], totalReward: 0 },
    ib: { liked: [], disliked: [], corrections: [], totalReward: 0 },
  },
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      store = { ...store, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
      console.log(`📂 Loaded from ${DATA_FILE}`);
    }
  } catch (e) { console.log('Starting fresh'); }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function getPersonaStore() {
  return store.personas[store.activePersona];
}

// ============================================
// AI EVALUATION ENGINE
// ============================================

function evaluatePerson(person) {
  const recipe = RECIPES[store.activePersona];
  let score = 50; // Start neutral
  const reasons = [];
  const concerns = [];
  
  // Extract features
  const highlights = person.highlights || [];
  const signal = person.signal_type || '';
  const seniority = person.level_of_seniority || '';
  const years = person.years_of_experience || 0;
  const currentJob = person.experience?.find(e => e.is_current);
  const title = currentJob?.title || '';
  const company = currentJob?.company_name || '';
  const domain = currentJob?.domain;
  const location = person.location || '';
  const allCompanies = person.experience?.map(e => e.company_name) || [];
  
  // 1. Check positive highlight signals
  recipe.positiveSignals.highlights?.forEach(sig => {
    if (highlights.some(h => h.toLowerCase().includes(sig.key.toLowerCase()))) {
      score += sig.weight * 5;
      reasons.push(`✓ ${sig.key}: ${sig.reason}`);
    }
  });
  
  // 2. Check signal type
  recipe.positiveSignals.signals?.forEach(sig => {
    if (signal.toLowerCase().includes(sig.key.toLowerCase())) {
      score += sig.weight * 5;
      reasons.push(`✓ Signal "${sig.key}": ${sig.reason}`);
    }
  });
  
  // 3. Check seniority
  recipe.positiveSignals.seniority?.forEach(sen => {
    if (title.toLowerCase().includes(sen.key.toLowerCase()) || seniority.toLowerCase().includes(sen.key.toLowerCase())) {
      score += sen.weight * 5;
      reasons.push(`✓ Seniority "${sen.key}": ${sen.reason}`);
    }
  });
  
  // 4. Check experience at valued companies
  if (recipe.positiveSignals.experience?.valuedCompanies) {
    const valued = recipe.positiveSignals.experience.valuedCompanies;
    const matchedCompanies = allCompanies.filter(c => 
      valued.some(v => c.toLowerCase().includes(v.toLowerCase()))
    );
    if (matchedCompanies.length > 0) {
      score += recipe.positiveSignals.experience.weight * 5 * Math.min(matchedCompanies.length, 3);
      reasons.push(`✓ Experience at: ${matchedCompanies.slice(0, 3).join(', ')}`);
    }
  }
  
  // 5. Check years of experience
  if (recipe.positiveSignals.experience) {
    const { minYears, maxYears } = recipe.positiveSignals.experience;
    if (years >= minYears && years <= maxYears) {
      score += 5;
      reasons.push(`✓ ${years} years experience (ideal range)`);
    } else if (years > maxYears) {
      score -= 5;
      concerns.push(`⚠ ${years} years may be overqualified`);
    } else if (years < minYears && years > 0) {
      score -= 3;
      concerns.push(`⚠ Only ${years} years experience`);
    }
  }
  
  // 6. Check red flags
  recipe.redFlags?.forEach(flag => {
    const textToCheck = `${title} ${company} ${signal} domain: ${domain}`.toLowerCase();
    if (textToCheck.includes(flag.pattern.toLowerCase())) {
      score += flag.weight * 5;
      concerns.push(`🚩 ${flag.pattern}: ${flag.reason}`);
    }
  });
  
  // 7. Check location (bonus for key markets)
  if (recipe.positiveSignals.locations) {
    if (recipe.positiveSignals.locations.some(loc => location.includes(loc))) {
      score += 3;
      reasons.push(`✓ Located in key market`);
    }
  }
  
  // Clamp score
  score = Math.max(0, Math.min(100, score));
  
  // Determine verdict
  let verdict, emoji;
  if (score >= 80) { verdict = 'STRONG LIKE'; emoji = '🔥'; }
  else if (score >= 60) { verdict = 'LEAN LIKE'; emoji = '👍'; }
  else if (score >= 40) { verdict = 'NEUTRAL'; emoji = '🤔'; }
  else if (score >= 20) { verdict = 'LEAN PASS'; emoji = '👎'; }
  else { verdict = 'STRONG PASS'; emoji = '❌'; }
  
  return {
    score,
    verdict,
    emoji,
    reasons: reasons.slice(0, 5),
    concerns: concerns.slice(0, 3),
    recommendation: score >= 60 ? 'LIKE' : 'DISLIKE',
  };
}

// ============================================
// DISPLAY
// ============================================

function showPerson(p, i) {
  const currentJob = p.experience?.find(e => e.is_current);
  
  console.log(`\n┌─────────────────────────────────────────────────────────────────┐`);
  console.log(`│ #${(i + 1).toString().padStart(2)} ${(p.full_name || 'Unknown').padEnd(58).slice(0, 58)} │`);
  console.log(`├─────────────────────────────────────────────────────────────────┤`);
  console.log(`│ Signal:     ${(p.signal_type || 'N/A').slice(0, 51).padEnd(51)} │`);
  console.log(`│ Company:    ${(currentJob?.company_name || 'N/A').slice(0, 51).padEnd(51)} │`);
  console.log(`│ Title:      ${(currentJob?.title || 'N/A').slice(0, 51).padEnd(51)} │`);
  console.log(`│ Domain:     ${(currentJob?.domain || 'N/A').slice(0, 51).padEnd(51)} │`);
  console.log(`│ Location:   ${(p.location || 'N/A').slice(0, 51).padEnd(51)} │`);
  console.log(`│ Experience: ${(p.years_of_experience + ' years' || 'N/A').toString().slice(0, 51).padEnd(51)} │`);
  console.log(`│ Highlights: ${(p.highlights || []).slice(0, 3).join(', ').slice(0, 51).padEnd(51)} │`);
  console.log(`└─────────────────────────────────────────────────────────────────┘`);
}

function showEvaluation(eval_result) {
  const recipe = RECIPES[store.activePersona];
  const bar = '█'.repeat(Math.round(eval_result.score / 10)) + '░'.repeat(10 - Math.round(eval_result.score / 10));
  
  console.log(`\n╔═══════════════════════════════════════════════════════════════════╗`);
  console.log(`║ ${recipe.name} EVALUATION                                        `);
  console.log(`╠═══════════════════════════════════════════════════════════════════╣`);
  console.log(`║ ${eval_result.emoji} ${eval_result.verdict.padEnd(15)} Score: ${eval_result.score}/100 [${bar}]`.padEnd(68) + '║');
  console.log(`╠═══════════════════════════════════════════════════════════════════╣`);
  
  if (eval_result.reasons.length > 0) {
    console.log(`║ POSITIVE SIGNALS:                                                 ║`);
    eval_result.reasons.forEach(r => {
      console.log(`║   ${r.slice(0, 63).padEnd(63)} ║`);
    });
  }
  
  if (eval_result.concerns.length > 0) {
    console.log(`║ CONCERNS:                                                         ║`);
    eval_result.concerns.forEach(c => {
      console.log(`║   ${c.slice(0, 63).padEnd(63)} ║`);
    });
  }
  
  console.log(`╠═══════════════════════════════════════════════════════════════════╣`);
  console.log(`║ AI RECOMMENDATION: ${eval_result.recommendation.padEnd(47)} ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════════╝`);
  console.log(`\nDo you AGREE or DISAGREE with this evaluation?`);
  console.log(`  agree              - Confirm AI's recommendation`);
  console.log(`  disagree <reason>  - Override with your reason (THIS IS RL TRAINING)`);
}

function showRecipe() {
  const recipe = RECIPES[store.activePersona];
  const ps = getPersonaStore();
  
  console.log(`\n╔═══════════════════════════════════════════════════════════════════╗`);
  console.log(`║ ${recipe.name} RECIPE                                            `);
  console.log(`╠═══════════════════════════════════════════════════════════════════╣`);
  console.log(`║ Stage: ${recipe.stage.padEnd(59)} ║`);
  console.log(`║ ${recipe.description.slice(0, 65).padEnd(65)} ║`);
  console.log(`╠═══════════════════════════════════════════════════════════════════╣`);
  console.log(`║ Training Stats: ${ps.liked.length} likes, ${ps.disliked.length} dislikes, ${ps.corrections.length} corrections`.padEnd(68) + '║');
  console.log(`╚═══════════════════════════════════════════════════════════════════╝`);
}

function showHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║ 📋 COMMANDS                                                       ║
╠═══════════════════════════════════════════════════════════════════╣
║ PERSONAS:                                                         ║
║   early   - 🌱 Early Stage VC (Stealth to Seed)                   ║
║   growth  - 📈 Growth Stage VC (Series A-D)                       ║
║   pe      - 🏦 Private Equity (Late-Stage & M&A)                  ║
║   ib      - 🤝 Investment Banker (M&A/IPO Advisory)               ║
║   recipe  - Show current persona's evaluation criteria            ║
║                                                                   ║
║ DATA:                                                             ║
║   searches           List saved searches                          ║
║   use <id>           Set active search                            ║
║   fetch [n]          Fetch n results                              ║
║   next / prev        Navigate                                     ║
║   json               Show full JSON                               ║
║                                                                   ║
║ EVALUATION (RL):                                                  ║
║   eval               AI evaluates current person                  ║
║   agree              Confirm AI's recommendation                  ║
║   disagree <reason>  Override AI (THIS TRAINS THE MODEL)          ║
║                                                                   ║
║ ANALYSIS:                                                         ║
║   rank               Rank all by persona score                    ║
║   stats              Show all personas stats                      ║
║   corrections        Show your corrections (RL training data)     ║
║   export             Export training data                         ║
║                                                                   ║
║   help               Show this help                               ║
║   quit               Exit                                         ║
╚═══════════════════════════════════════════════════════════════════╝`);
}

// ============================================
// REPL
// ============================================

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '' });

let searchId = null, people = [], idx = 0, lastEval = null;

function updatePrompt() {
  const recipe = RECIPES[store.activePersona];
  rl.setPrompt(`${recipe.name.split(' ')[0]}> `);
}

async function cmd(line) {
  const [c, ...args] = line.trim().split(' ');
  const arg = args.join(' ');
  
  try {
    switch (c?.toLowerCase()) {
      case 'help': showHelp(); break;
      
      case 'recipe': showRecipe(); break;
      
      case 'early': case 'growth': case 'pe': case 'ib':
        store.activePersona = c.toLowerCase();
        saveData();
        showRecipe();
        break;
      
      case 'searches': {
        console.log('\n📋 Fetching searches...');
        const res = await fetch(`${API_BASE}/searches`, { headers: { 'X-API-KEY': API_KEY } });
        const all = await res.json();
        const talent = all.filter(s => s.product_type === 'talent');
        console.log(`\n🎯 TALENT SEARCHES:`);
        talent.slice(0, 8).forEach(s => console.log(`   [${s.id}] ${s.name} (${s.full_count})`));
        break;
      }
      
      case 'use':
        searchId = parseInt(args[0], 10);
        console.log(`✅ Search: ${searchId}`);
        break;
      
      case 'fetch': {
        if (!searchId) { console.log('⚠️ Set search first: use <id>'); break; }
        const limit = parseInt(args[0] || '10', 10);
        console.log(`\n📋 Fetching ${limit}...`);
        const res = await fetch(`${API_BASE}/searches/talent/${searchId}/results?limit=${limit}`, { headers: { 'X-API-KEY': API_KEY } });
        const data = await res.json();
        people = Array.isArray(data) ? data : (data.items || data.results || []);
        idx = 0;
        console.log(`✅ Got ${people.length} people`);
        if (people.length) { showRecipe(); showPerson(people[0], 0); }
        break;
      }
      
      case 'next':
        if (!people.length) { console.log('⚠️ Fetch first'); break; }
        idx = Math.min(idx + 1, people.length - 1);
        lastEval = null;
        showPerson(people[idx], idx);
        break;
      
      case 'prev':
        if (!people.length) { console.log('⚠️ Fetch first'); break; }
        idx = Math.max(idx - 1, 0);
        lastEval = null;
        showPerson(people[idx], idx);
        break;
      
      case 'json':
        if (!people.length) { console.log('⚠️ Fetch first'); break; }
        console.log(JSON.stringify(people[idx], null, 2));
        break;
      
      case 'eval': {
        if (!people.length) { console.log('⚠️ Fetch first'); break; }
        showPerson(people[idx], idx);
        lastEval = evaluatePerson(people[idx]);
        showEvaluation(lastEval);
        break;
      }
      
      case 'agree': {
        if (!lastEval) { console.log('⚠️ Run "eval" first'); break; }
        const ps = getPersonaStore();
        const person = people[idx];
        
        if (lastEval.recommendation === 'LIKE') {
          ps.liked.push({
            id: person.person_id,
            name: person.full_name,
            score: lastEval.score,
            reasons: lastEval.reasons,
            aiRecommendation: 'LIKE',
            userAgreed: true,
            timestamp: new Date().toISOString(),
          });
          ps.totalReward += 1.0;
          console.log(`\n✅ AGREED with LIKE for ${person.full_name}`);
        } else {
          ps.disliked.push({
            id: person.person_id,
            name: person.full_name,
            score: lastEval.score,
            concerns: lastEval.concerns,
            aiRecommendation: 'DISLIKE',
            userAgreed: true,
            timestamp: new Date().toISOString(),
          });
          ps.totalReward -= 1.0;
          console.log(`\n✅ AGREED with DISLIKE for ${person.full_name}`);
        }
        
        saveData();
        lastEval = null;
        
        // Auto-advance
        if (idx < people.length - 1) {
          idx++;
          showPerson(people[idx], idx);
        }
        break;
      }
      
      case 'disagree': {
        if (!lastEval) { console.log('⚠️ Run "eval" first'); break; }
        if (!arg) { console.log('⚠️ Provide reason: disagree <your reason>'); break; }
        
        const ps = getPersonaStore();
        const person = people[idx];
        const correction = {
          id: person.person_id,
          name: person.full_name,
          aiScore: lastEval.score,
          aiRecommendation: lastEval.recommendation,
          userOverride: lastEval.recommendation === 'LIKE' ? 'DISLIKE' : 'LIKE',
          userReason: arg,
          highlights: person.highlights,
          signal: person.signal_type,
          timestamp: new Date().toISOString(),
        };
        
        ps.corrections.push(correction);
        
        if (correction.userOverride === 'LIKE') {
          ps.liked.push({ ...correction, userAgreed: false });
          ps.totalReward += 1.5; // Extra reward for correction
          console.log(`\n🔄 OVERRODE to LIKE: ${person.full_name}`);
        } else {
          ps.disliked.push({ ...correction, userAgreed: false });
          ps.totalReward -= 0.5; // Less penalty for correction
          console.log(`\n🔄 OVERRODE to DISLIKE: ${person.full_name}`);
        }
        
        console.log(`   Your reason: "${arg}"`);
        console.log(`   ⚡ This correction will improve future evaluations!`);
        
        saveData();
        lastEval = null;
        
        // Auto-advance
        if (idx < people.length - 1) {
          idx++;
          showPerson(people[idx], idx);
        }
        break;
      }
      
      case 'rank': {
        if (!people.length) { console.log('⚠️ Fetch first'); break; }
        const ps = getPersonaStore();
        const ranked = people.map((p, i) => {
          const ev = evaluatePerson(p);
          return { p, i, ...ev };
        }).sort((a, b) => b.score - a.score);
        
        console.log(`\n🏆 RANKED by ${RECIPES[store.activePersona].name}:`);
        ranked.forEach((r, i) => {
          const bar = '█'.repeat(Math.round(r.score / 10)) + '░'.repeat(10 - Math.round(r.score / 10));
          const liked = ps.liked.find(l => l.id === r.p.person_id);
          const disliked = ps.disliked.find(d => d.id === r.p.person_id);
          const status = liked ? (liked.userAgreed ? '👍' : '🔄👍') : disliked ? (disliked.userAgreed ? '👎' : '🔄👎') : '  ';
          console.log(`${status} ${(i + 1).toString().padStart(2)}. ${r.score}/100 [${bar}] ${r.emoji} ${r.p.full_name}`);
        });
        break;
      }
      
      case 'stats': {
        console.log(`\n📊 ALL PERSONAS TRAINING STATS:`);
        console.log('─'.repeat(70));
        Object.entries(RECIPES).forEach(([id, recipe]) => {
          const ps = store.personas[id];
          const active = id === store.activePersona ? '→' : ' ';
          const corrections = ps.corrections.length;
          console.log(`${active} ${recipe.name.padEnd(25)} Likes: ${ps.liked.length.toString().padEnd(3)} Dislikes: ${ps.disliked.length.toString().padEnd(3)} Corrections: ${corrections}`);
        });
        break;
      }
      
      case 'corrections': {
        const ps = getPersonaStore();
        if (ps.corrections.length === 0) {
          console.log('\nNo corrections yet. Disagree with AI to train it!');
          break;
        }
        console.log(`\n🔄 YOUR CORRECTIONS (RL Training Data) for ${RECIPES[store.activePersona].name}:`);
        console.log('─'.repeat(70));
        ps.corrections.forEach((c, i) => {
          console.log(`${i + 1}. ${c.name}`);
          console.log(`   AI said: ${c.aiRecommendation} (${c.aiScore}/100)`);
          console.log(`   You said: ${c.userOverride}`);
          console.log(`   Reason: "${c.userReason}"`);
          console.log('');
        });
        break;
      }
      
      case 'export': {
        const data = {
          format: 'rl_recipe_training',
          exportedAt: new Date().toISOString(),
          personas: Object.entries(store.personas).map(([id, ps]) => ({
            persona: id,
            recipe: RECIPES[id].name,
            stats: {
              likes: ps.liked.length,
              dislikes: ps.disliked.length,
              corrections: ps.corrections.length,
              totalReward: ps.totalReward,
            },
            corrections: ps.corrections, // KEY RL DATA
            liked: ps.liked,
            disliked: ps.disliked,
          })),
        };
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'quit': case 'exit':
        console.log(`\n📊 Final Training Stats:`);
        Object.entries(RECIPES).forEach(([id, recipe]) => {
          const ps = store.personas[id];
          console.log(`   ${recipe.name}: ${ps.liked.length} likes, ${ps.disliked.length} dislikes, ${ps.corrections.length} corrections`);
        });
        saveData();
        process.exit(0);
      
      default:
        if (c) console.log(`Unknown: ${c}. Type "help"`);
    }
  } catch (e) {
    console.error(`❌ ${e.message}`);
  }
  
  updatePrompt();
  rl.prompt();
}

// Main
loadData();
console.log(`╔═══════════════════════════════════════════════════════════════════╗`);
console.log(`║ 🧠 RL RECIPE - AI-Evaluated Reinforcement Learning               ║`);
console.log(`╠═══════════════════════════════════════════════════════════════════╣`);
console.log(`║ The AI evaluates each person using the persona's RECIPE.         ║`);
console.log(`║ You AGREE or DISAGREE to train the model.                        ║`);
console.log(`║                                                                   ║`);
console.log(`║ Personas: early | growth | pe | ib                               ║`);
console.log(`║ Key commands: eval, agree, disagree <reason>                     ║`);
console.log(`╚═══════════════════════════════════════════════════════════════════╝`);
console.log(`API: ${API_KEY ? '✅ ' + API_KEY.slice(0, 10) + '...' : '❌ NOT SET'}`);

showRecipe();
updatePrompt();
rl.prompt();
rl.on('line', cmd);

