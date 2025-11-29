#!/usr/bin/env node
/**
 * Specter Agent REPL
 * Interactive terminal for testing agent tools and flows
 * 
 * Usage: node scripts/agent-repl.js
 */

require('dotenv').config();
const readline = require('readline');
const { AGENT_TOOLS, executeAgentTool } = require('./agent-tools');

// ============================================
// STATE
// ============================================

const state = {
  searches: null,
  currentSearchId: null,
  currentSearchType: null,
  lastResults: [],
  memory: {
    liked: [],
    disliked: [],
    viewed: [],
  },
};

// ============================================
// COMMANDS
// ============================================

const COMMANDS = {
  help: {
    description: 'Show available commands',
    usage: 'help',
    fn: showHelp,
  },
  searches: {
    description: 'List saved searches by type',
    usage: 'searches [type]  (type: talent|people|company|stratintel|all)',
    fn: listSearches,
  },
  use: {
    description: 'Select a saved search to work with',
    usage: 'use <search_id>',
    fn: useSearch,
  },
  fetch: {
    description: 'Fetch results from current search',
    usage: 'fetch [limit]',
    fn: fetchResults,
  },
  person: {
    description: 'Get person details',
    usage: 'person <person_id>',
    fn: getPersonDetail,
  },
  score: {
    description: 'Score a founder',
    usage: 'score <person_id>',
    fn: scoreFounder,
  },
  like: {
    description: 'Like a person (add to memory)',
    usage: 'like <person_id> [reason]',
    fn: likePerson,
  },
  dislike: {
    description: 'Dislike a person (add to memory)',
    usage: 'dislike <person_id> [reason]',
    fn: dislikePerson,
  },
  memory: {
    description: 'Show memory state (liked/disliked)',
    usage: 'memory',
    fn: showMemory,
  },
  tools: {
    description: 'List available agent tools',
    usage: 'tools',
    fn: listTools,
  },
  exec: {
    description: 'Execute a tool directly',
    usage: 'exec <tool_name> <json_args>',
    fn: execTool,
  },
  clear: {
    description: 'Clear screen',
    usage: 'clear',
    fn: () => { console.clear(); return ''; },
  },
  exit: {
    description: 'Exit REPL',
    usage: 'exit',
    fn: () => process.exit(0),
  },
};

// ============================================
// COMMAND IMPLEMENTATIONS
// ============================================

function showHelp() {
  console.log('\n📚 AVAILABLE COMMANDS:\n');
  Object.entries(COMMANDS).forEach(([name, cmd]) => {
    console.log(`  ${name.padEnd(12)} ${cmd.description}`);
    console.log(`  ${''.padEnd(12)} Usage: ${cmd.usage}\n`);
  });
  return '';
}

async function listSearches(args) {
  const type = args[0] || 'all';
  const searches = await executeAgentTool('get_saved_searches', { product_type: type });
  state.searches = searches;
  
  console.log(`\n📋 SAVED SEARCHES (${type}):\n`);
  
  // Group by type
  const byType = {};
  searches.forEach(s => {
    byType[s.product_type] = byType[s.product_type] || [];
    byType[s.product_type].push(s);
  });
  
  Object.entries(byType).forEach(([t, items]) => {
    console.log(`  ${t.toUpperCase()}:`);
    items.forEach(s => {
      console.log(`    [${s.id}] ${s.name} (${s.full_count} results)`);
    });
    console.log('');
  });
  
  return `Found ${searches.length} searches`;
}

async function useSearch(args) {
  const searchId = parseInt(args[0]);
  if (!searchId) return '❌ Usage: use <search_id>';
  
  // Find the search
  if (!state.searches) {
    await listSearches(['all']);
  }
  
  const search = state.searches.find(s => s.id === searchId);
  if (!search) return `❌ Search ${searchId} not found`;
  
  state.currentSearchId = searchId;
  state.currentSearchType = search.product_type;
  
  return `✅ Now using: [${search.id}] ${search.name} (${search.product_type})`;
}

async function fetchResults(args) {
  if (!state.currentSearchId) return '❌ No search selected. Use: use <search_id>';
  
  const limit = parseInt(args[0]) || 10;
  let results;
  
  console.log(`\n🔍 Fetching ${limit} results from search ${state.currentSearchId}...\n`);
  
  switch (state.currentSearchType) {
    case 'talent':
      results = await executeAgentTool('search_talent_signals', { 
        search_id: state.currentSearchId, 
        limit 
      });
      console.log('🎯 TALENT SIGNALS:\n');
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.full_name}`);
        console.log(`     Signal: ${r.signal_type} | Score: ${r.signal_score || 'N/A'}`);
        console.log(`     ID: ${r.person_id}`);
        if (r.new_position) console.log(`     New: ${r.new_position}`);
        console.log('');
      });
      break;
      
    case 'people':
      results = await executeAgentTool('search_people', { 
        search_id: state.currentSearchId, 
        limit 
      });
      console.log('👥 PEOPLE:\n');
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.full_name}`);
        console.log(`     ID: ${r.person_id}`);
        if (r.tagline) console.log(`     ${r.tagline}`);
        console.log('');
      });
      break;
      
    case 'company':
      results = await executeAgentTool('search_companies', { 
        search_id: state.currentSearchId, 
        limit 
      });
      console.log('🏢 COMPANIES:\n');
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.name}`);
        console.log(`     ID: ${r.company_id}`);
        if (r.industries) console.log(`     Industries: ${r.industries.slice(0, 3).join(', ')}`);
        if (r.growth_stage) console.log(`     Stage: ${r.growth_stage}`);
        console.log('');
      });
      break;
      
    case 'stratintel':
      results = await executeAgentTool('search_investor_interest', { 
        search_id: state.currentSearchId, 
        limit 
      });
      console.log('📊 INVESTOR INTEREST SIGNALS:\n');
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. Score: ${r.signal_score} | Type: ${r.signal_type}`);
        console.log(`     ID: ${r.signal_id}`);
        if (r.total_funding) console.log(`     Funding: $${r.total_funding.toLocaleString()}`);
        if (r.investors) console.log(`     Investors: ${r.investors.slice(0, 3).join(', ')}`);
        console.log('');
      });
      break;
      
    default:
      return `❌ Unknown search type: ${state.currentSearchType}`;
  }
  
  state.lastResults = results;
  return `Fetched ${results.length} results`;
}

async function getPersonDetail(args) {
  const personId = args[0];
  if (!personId) return '❌ Usage: person <person_id>';
  
  console.log(`\n👤 Fetching person ${personId}...\n`);
  
  const person = await executeAgentTool('get_person_detail', { person_id: personId });
  
  console.log(`  Name: ${person.full_name}`);
  console.log(`  ID: ${person.person_id}`);
  if (person.tagline) console.log(`  Tagline: ${person.tagline}`);
  if (person.about) console.log(`  About: ${person.about.slice(0, 200)}...`);
  if (person.location) console.log(`  Location: ${person.location}`);
  if (person.linkedin_url) console.log(`  LinkedIn: ${person.linkedin_url}`);
  if (person.highlights?.length) console.log(`  Highlights: ${person.highlights.join(', ')}`);
  
  if (person.experience?.length) {
    console.log('\n  Experience:');
    person.experience.forEach(exp => {
      console.log(`    - ${exp.title} at ${exp.company_name} ${exp.is_current ? '(Current)' : ''}`);
    });
  }
  
  return '';
}

async function scoreFounder(args) {
  const personId = args[0];
  if (!personId) return '❌ Usage: score <person_id>';
  
  console.log(`\n📊 Scoring founder ${personId}...\n`);
  
  const result = await executeAgentTool('score_founder', { person_id: personId });
  
  console.log(`  Name: ${result.full_name}`);
  console.log(`  Score: ${result.score}/100`);
  console.log('\n  Reasons:');
  result.reasons.forEach(r => console.log(`    ✓ ${r}`));
  console.log(`\n  Highlights: ${result.highlights?.join(', ') || 'None'}`);
  
  return '';
}

function likePerson(args) {
  const personId = args[0];
  if (!personId) return '❌ Usage: like <person_id> [reason]';
  
  const reason = args.slice(1).join(' ') || 'Manual like';
  state.memory.liked.push({ id: personId, reason, timestamp: new Date().toISOString() });
  
  return `👍 Liked ${personId}: ${reason}`;
}

function dislikePerson(args) {
  const personId = args[0];
  if (!personId) return '❌ Usage: dislike <person_id> [reason]';
  
  const reason = args.slice(1).join(' ') || 'Manual dislike';
  state.memory.disliked.push({ id: personId, reason, timestamp: new Date().toISOString() });
  
  return `👎 Disliked ${personId}: ${reason}`;
}

function showMemory() {
  console.log('\n🧠 AGENT MEMORY:\n');
  
  console.log(`  Liked (${state.memory.liked.length}):`);
  state.memory.liked.forEach(l => console.log(`    👍 ${l.id}: ${l.reason}`));
  
  console.log(`\n  Disliked (${state.memory.disliked.length}):`);
  state.memory.disliked.forEach(d => console.log(`    👎 ${d.id}: ${d.reason}`));
  
  return '';
}

function listTools() {
  console.log('\n🔧 AVAILABLE AGENT TOOLS:\n');
  AGENT_TOOLS.forEach(t => {
    console.log(`  ${t.name}`);
    console.log(`    ${t.description.slice(0, 80)}...`);
    console.log(`    Params: ${Object.keys(t.parameters.properties).join(', ')}`);
    console.log('');
  });
  return `${AGENT_TOOLS.length} tools available`;
}

async function execTool(args) {
  const toolName = args[0];
  const jsonArgs = args.slice(1).join(' ');
  
  if (!toolName) return '❌ Usage: exec <tool_name> <json_args>';
  
  let parsedArgs = {};
  if (jsonArgs) {
    try {
      parsedArgs = JSON.parse(jsonArgs);
    } catch (e) {
      return `❌ Invalid JSON: ${e.message}`;
    }
  }
  
  console.log(`\n🔧 Executing ${toolName}...`);
  const result = await executeAgentTool(toolName, parsedArgs);
  console.log('\nResult:');
  console.log(JSON.stringify(result, null, 2));
  
  return '';
}

// ============================================
// REPL LOOP
// ============================================

async function processCommand(input) {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const args = parts.slice(1);
  
  if (!cmd) return '';
  
  const command = COMMANDS[cmd];
  if (!command) {
    return `❌ Unknown command: ${cmd}. Type 'help' for available commands.`;
  }
  
  try {
    return await command.fn(args);
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🤖 SPECTER AGENT REPL');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Type "help" for available commands, "exit" to quit.\n');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'specter> ',
  });
  
  rl.prompt();
  
  rl.on('line', async (line) => {
    const result = await processCommand(line);
    if (result) console.log(result);
    console.log('');
    rl.prompt();
  });
  
  rl.on('close', () => {
    console.log('\n👋 Goodbye!');
    process.exit(0);
  });
}

main().catch(console.error);
