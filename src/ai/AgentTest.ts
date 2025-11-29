/**
 * AgentTest - Terminal-based agent testing
 * 
 * Run with: npx ts-node --transpile-only src/ai/AgentTest.ts
 * 
 * This is a headless testing harness for the agent.
 * No UI, just JSON in/out for rapid iteration.
 */

import { AgentCore, getAgentCore, type AgentInput, type AgentOutput } from './AgentCore';
import { getAgentMemory } from './agentMemory';

// Mock token for testing (replace with real token)
const TEST_TOKEN = process.env.EXPO_PUBLIC_SPECTER_API_KEY || 'test-token';

// ============================================
// TEST CASES
// ============================================

interface TestCase {
  name: string;
  input: AgentInput;
  expectedType?: AgentOutput['type'];
  validate?: (output: AgentOutput) => boolean;
}

const testCases: TestCase[] = [
  // Memory queries (fast path - no API)
  {
    name: 'Get stats',
    input: { type: 'text', content: 'show my stats' },
    expectedType: 'response',
  },
  {
    name: 'Get likes',
    input: { type: 'text', content: 'show my likes' },
    expectedType: 'response',
  },
  {
    name: 'Get preferences',
    input: { type: 'text', content: 'what are my preferences?' },
    expectedType: 'response',
  },
  
  // Search queries (API required)
  {
    name: 'Search saved searches',
    input: { type: 'text', content: 'search for people' },
    expectedType: 'response',
  },
  
  // Bulk sourcing
  {
    name: 'Auto-source signals',
    input: { type: 'text', content: 'auto-source from my searches' },
    expectedType: 'suggestion',
  },
  
  // Scoring
  {
    name: 'Score all signals',
    input: { type: 'text', content: 'score and rank all signals' },
    expectedType: 'response',
  },
];

// ============================================
// TEST RUNNER
// ============================================

async function runTests() {
  console.log('🧪 Agent Test Harness\n');
  console.log('='.repeat(50));
  
  const agent = getAgentCore();
  
  // Initialize
  console.log('\n📦 Initializing agent...');
  try {
    const state = await agent.init(TEST_TOKEN);
    console.log('✅ Agent initialized:', JSON.stringify(state, null, 2));
  } catch (e: any) {
    console.error('❌ Init failed:', e.message);
    return;
  }
  
  // Run test cases
  console.log('\n🏃 Running test cases...\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    console.log(`\n--- ${test.name} ---`);
    console.log(`Input: "${test.input.content}"`);
    
    try {
      const startTime = Date.now();
      const output = await agent.process(test.input);
      const elapsed = Date.now() - startTime;
      
      console.log(`Time: ${elapsed}ms`);
      console.log(`Type: ${output.type}`);
      console.log(`Content: ${output.content.slice(0, 200)}${output.content.length > 200 ? '...' : ''}`);
      
      if (output.reasoning?.length) {
        console.log(`Reasoning: ${output.reasoning.join(' → ')}`);
      }
      if (output.toolsUsed?.length) {
        console.log(`Tools: ${output.toolsUsed.join(', ')}`);
      }
      if (output.actions?.length) {
        console.log(`Suggested actions: ${output.actions.map(a => a.type).join(', ')}`);
      }
      
      // Validate
      let testPassed = true;
      if (test.expectedType && output.type !== test.expectedType) {
        console.log(`❌ Expected type ${test.expectedType}, got ${output.type}`);
        testPassed = false;
      }
      if (test.validate && !test.validate(output)) {
        console.log(`❌ Custom validation failed`);
        testPassed = false;
      }
      
      if (testPassed) {
        console.log(`✅ PASSED`);
        passed++;
      } else {
        failed++;
      }
      
    } catch (e: any) {
      console.log(`❌ ERROR: ${e.message}`);
      failed++;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
  
  // Final state
  const finalState = agent.getState();
  console.log('Final agent state:', JSON.stringify(finalState, null, 2));
}

// ============================================
// INTERACTIVE MODE
// ============================================

async function interactiveMode() {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  console.log('🤖 Agent Interactive Mode\n');
  console.log('Commands:');
  console.log('  /stats - Show agent stats');
  console.log('  /state - Show agent state');
  console.log('  /memory - Show memory summary');
  console.log('  /quit - Exit');
  console.log('\nOr type any query to test the agent.\n');
  
  const agent = getAgentCore();
  await agent.init(TEST_TOKEN);
  
  const prompt = () => {
    rl.question('> ', async (input) => {
      if (!input.trim()) {
        prompt();
        return;
      }
      
      if (input === '/quit') {
        console.log('Goodbye!');
        rl.close();
        process.exit(0);
      }
      
      if (input === '/stats') {
        const state = agent.getState();
        console.log(JSON.stringify(state.stats, null, 2));
        prompt();
        return;
      }
      
      if (input === '/state') {
        const state = agent.getState();
        console.log(JSON.stringify(state, null, 2));
        prompt();
        return;
      }
      
      if (input === '/memory') {
        const memory = getAgentMemory();
        const stats = memory.getStats();
        console.log(JSON.stringify(stats, null, 2));
        prompt();
        return;
      }
      
      // Process as agent query
      try {
        const startTime = Date.now();
        const output = await agent.process({ type: 'text', content: input });
        const elapsed = Date.now() - startTime;
        
        console.log(`\n[${output.type}] (${elapsed}ms)`);
        console.log(output.content);
        
        if (output.actions?.length) {
          console.log(`\n💡 Suggested actions:`);
          output.actions.forEach((a, i) => {
            console.log(`  ${i + 1}. ${a.type}: ${a.reason} (${Math.round(a.confidence * 100)}% confident)`);
          });
        }
        
        if (output.data) {
          console.log(`\n📦 Data available (${Object.keys(output.data).join(', ')})`);
        }
        
        console.log('');
      } catch (e: any) {
        console.log(`\n❌ Error: ${e.message}\n`);
      }
      
      prompt();
    });
  };
  
  prompt();
}

// ============================================
// MAIN
// ============================================

const args = process.argv.slice(2);

if (args.includes('--interactive') || args.includes('-i')) {
  interactiveMode();
} else {
  runTests().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
  });
}

