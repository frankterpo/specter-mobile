#!/usr/bin/env node
/**
 * Show candidates for manual feedback
 */
require('dotenv').config();

const API_KEY = process.env.EXPO_PUBLIC_SPECTER_API_KEY;
const API_BASE = 'https://app.tryspecter.com/api/v1';

async function main() {
  const searchId = process.argv[2] || 4991;
  const limit = process.argv[3] || 5;
  
  console.log(`Fetching ${limit} people from search ${searchId}...\n`);
  
  const res = await fetch(`${API_BASE}/searches/talent/${searchId}/results?limit=${limit}`, {
    headers: { 'X-API-KEY': API_KEY }
  });
  const data = await res.json();
  const people = data.items || [];
  
  people.forEach((p, i) => {
    console.log('═'.repeat(70));
    console.log(`PERSON #${i + 1}: ${p.full_name}`);
    console.log('═'.repeat(70));
    console.log(`ID:          ${p.person_id}`);
    console.log(`Signal:      ${p.signal_type}`);
    console.log(`Tagline:     ${p.tagline || 'N/A'}`);
    console.log(`Location:    ${p.location}`);
    console.log(`Seniority:   ${p.level_of_seniority}`);
    console.log(`Experience:  ${p.years_of_experience} years`);
    console.log(`Education:   ${p.education_level}`);
    console.log(`Highlights:  ${(p.highlights || []).join(', ') || 'None'}`);
    
    const current = p.experience?.find(e => e.is_current);
    if (current) {
      console.log(`\nCURRENT:`);
      console.log(`  ${current.title} @ ${current.company_name} (${current.domain})`);
      console.log(`  Started: ${current.start_date}`);
    }
    
    const prev = p.experience?.filter(e => !e.is_current).slice(0, 3);
    if (prev?.length) {
      console.log(`\nPREVIOUS:`);
      prev.forEach(e => {
        console.log(`  • ${e.title} @ ${e.company_name} (${e.start_date?.slice(0,4)}-${e.end_date?.slice(0,4) || 'now'})`);
      });
    }
    
    if (p.about) {
      console.log(`\nABOUT:`);
      console.log(`  ${p.about.slice(0, 300)}${p.about.length > 300 ? '...' : ''}`);
    }
    console.log('');
  });
  
  console.log('═'.repeat(70));
  console.log('📋 PROVIDE YOUR FEEDBACK');
  console.log('═'.repeat(70));
  console.log(`
Choose a PERSONA:
  • early  - 🌱 Early Stage (Pre-seed/Seed)
  • growth - 📈 Growth Stage (Series A-C)
  • pe     - 🏦 Private Equity (Later stage)
  • ib     - 🤝 Investment Banker (M&A/IPO)

Then for each person, tell me:
  • LIKE or DISLIKE
  • Your reason (reference the JSON fields above!)

Example response:
  "Persona: early
   #1 LIKE - serial_founder + prior_exit highlights, building AI company
   #2 DISLIKE - no technical background, company too vague
   #3 LIKE - top_university, building in stealth"
`);
}

main().catch(console.error);

