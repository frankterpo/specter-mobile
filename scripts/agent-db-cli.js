#!/usr/bin/env node
/**
 * Specter Agent Database CLI
 * 
 * Direct database access for testing agent logic with real data.
 * Bypasses API authentication entirely.
 * 
 * Usage: node scripts/agent-db-cli.js
 * 
 * Commands:
 *   stats     - Show database stats
 *   founders  - List sample founders
 *   likes     - Show liked entities
 *   search    - Search people by name
 *   person    - Get person details
 *   training  - Export training data
 *   quit      - Exit
 */

const { Client } = require('pg');
const readline = require('readline');

const DATABASE_URL = 'postgresql://specter_admin:XHhgjwY7kUwBNJo5dHLGJk9L@product-db-staging.cefiadjkb8ut.eu-west-2.rds.amazonaws.com:5432/postgres';

let client;

// Simple in-memory agent state
const agentMemory = {
  likedIds: new Set(),
  dislikedIds: new Set(),
  preferences: {},
};

async function connect() {
  client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('✅ Connected to Specter Postgres\n');
}

async function showStats() {
  console.log('\n📊 Database Stats');
  console.log('─'.repeat(50));
  
  const [people, companies, searches, interactions] = await Promise.all([
    client.query('SELECT COUNT(*) FROM people_db.person'),
    client.query('SELECT COUNT(*) FROM public.companies'),
    client.query('SELECT COUNT(*) FROM public.queries_by_user WHERE name IS NOT NULL'),
    client.query(`
      SELECT status, COUNT(*) as count 
      FROM public.user_entity_status 
      GROUP BY status 
      ORDER BY count DESC
    `),
  ]);
  
  console.log(`People:     ${parseInt(people.rows[0].count).toLocaleString()}`);
  console.log(`Companies:  ${parseInt(companies.rows[0].count).toLocaleString()}`);
  console.log(`Searches:   ${parseInt(searches.rows[0].count).toLocaleString()}`);
  console.log('\nUser Interactions:');
  interactions.rows.forEach(r => {
    console.log(`  • ${r.status}: ${parseInt(r.count).toLocaleString()}`);
  });
}

async function listFounders(limit = 10) {
  console.log('\n👥 Sample Founders');
  console.log('─'.repeat(50));
  
  const result = await client.query(`
    SELECT 
      p.specter_person_id as id,
      p.full_name,
      p.headline,
      p.country,
      ph.highlight
    FROM people_db.person p
    LEFT JOIN people_db.person_highlight ph ON p.person_id = ph.person_id
    WHERE p.headline ILIKE '%founder%' OR p.headline ILIKE '%ceo%'
    LIMIT $1
  `, [limit]);
  
  result.rows.forEach((p, i) => {
    const status = agentMemory.likedIds.has(p.id) ? '⭐' : 
                   agentMemory.dislikedIds.has(p.id) ? '❌' : '🆕';
    console.log(`${i + 1}. [${status}] ${p.full_name}`);
    console.log(`   ${(p.headline || '').slice(0, 60)}...`);
    console.log(`   ID: ${p.id}`);
    if (p.highlight) console.log(`   Highlight: ${p.highlight}`);
    console.log('');
  });
}

async function showLikes() {
  console.log('\n⭐ Liked Entities from Database');
  console.log('─'.repeat(50));
  
  const result = await client.query(`
    SELECT 
      ues.status,
      ues.person_id,
      ues.company_id,
      ues.talent_id,
      p.full_name,
      p.headline
    FROM public.user_entity_status ues
    LEFT JOIN people_db.person p ON p.specter_person_id = ues.person_id
    WHERE ues.status = 'liked'
    LIMIT 20
  `);
  
  result.rows.forEach((r, i) => {
    if (r.full_name) {
      console.log(`${i + 1}. ${r.full_name}`);
      console.log(`   ${(r.headline || '').slice(0, 50)}...`);
      console.log(`   ID: ${r.person_id}`);
    } else if (r.company_id) {
      console.log(`${i + 1}. Company: ${r.company_id}`);
    } else if (r.talent_id) {
      console.log(`${i + 1}. Talent Signal: ${r.talent_id}`);
    }
    console.log('');
  });
}

async function searchPeople(query) {
  console.log(`\n🔍 Searching for "${query}"...`);
  console.log('─'.repeat(50));
  
  const result = await client.query(`
    SELECT 
      p.specter_person_id as id,
      p.full_name,
      p.headline,
      p.country,
      p.city
    FROM people_db.person p
    WHERE 
      p.full_name ILIKE $1 OR 
      p.headline ILIKE $1 OR
      p.about ILIKE $1
    LIMIT 10
  `, [`%${query}%`]);
  
  if (result.rows.length === 0) {
    console.log('No results found.');
    return;
  }
  
  result.rows.forEach((p, i) => {
    const status = agentMemory.likedIds.has(p.id) ? '⭐' : 
                   agentMemory.dislikedIds.has(p.id) ? '❌' : '🆕';
    console.log(`${i + 1}. [${status}] ${p.full_name}`);
    console.log(`   ${(p.headline || '').slice(0, 60)}...`);
    console.log(`   Location: ${p.city || p.country || 'Unknown'}`);
    console.log(`   ID: ${p.id}`);
    console.log('');
  });
}

async function getPersonDetails(personId) {
  console.log(`\n📋 Person Details: ${personId}`);
  console.log('─'.repeat(50));
  
  const [person, jobs, education, highlights] = await Promise.all([
    client.query(`
      SELECT * FROM people_db.person 
      WHERE specter_person_id = $1
    `, [personId]),
    client.query(`
      SELECT * FROM people_db.person_job pj
      JOIN people_db.person p ON p.person_id = pj.person_id
      WHERE p.specter_person_id = $1
      ORDER BY pj.is_current DESC, pj.start_date DESC
    `, [personId]),
    client.query(`
      SELECT * FROM people_db.person_education pe
      JOIN people_db.person p ON p.person_id = pe.person_id
      WHERE p.specter_person_id = $1
    `, [personId]),
    client.query(`
      SELECT * FROM people_db.person_highlight ph
      JOIN people_db.person p ON p.person_id = ph.person_id
      WHERE p.specter_person_id = $1
    `, [personId]),
  ]);
  
  if (person.rows.length === 0) {
    console.log('Person not found.');
    return;
  }
  
  const p = person.rows[0];
  console.log(`Name: ${p.full_name}`);
  console.log(`Headline: ${p.headline}`);
  console.log(`Location: ${p.city || ''} ${p.country || ''}`);
  console.log(`About: ${(p.about || '').slice(0, 200)}...`);
  
  if (highlights.rows.length > 0) {
    console.log(`\nHighlights:`);
    highlights.rows.forEach(h => console.log(`  • ${h.highlight}`));
  }
  
  if (jobs.rows.length > 0) {
    console.log(`\nExperience:`);
    jobs.rows.slice(0, 5).forEach(j => {
      const current = j.is_current ? ' (Current)' : '';
      console.log(`  • ${j.title} at ${j.company_name}${current}`);
    });
  }
  
  if (education.rows.length > 0) {
    console.log(`\nEducation:`);
    education.rows.slice(0, 3).forEach(e => {
      console.log(`  • ${e.school_name || e.name}`);
    });
  }
  
  // Return structured data for scoring
  return {
    id: p.specter_person_id,
    name: p.full_name,
    headline: p.headline,
    country: p.country,
    highlights: highlights.rows.map(h => h.highlight),
    experience: jobs.rows.map(j => ({
      title: j.title,
      company: j.company_name,
      isCurrent: j.is_current,
    })),
  };
}

async function like(personId) {
  agentMemory.likedIds.add(personId);
  console.log(`⭐ Liked ${personId}`);
  
  // Extract preferences from liked person
  const person = await getPersonDetails(personId);
  if (person) {
    // Learn from highlights
    person.highlights?.forEach(h => {
      agentMemory.preferences[h] = (agentMemory.preferences[h] || 0) + 1;
    });
    console.log('\nUpdated preferences:', agentMemory.preferences);
  }
}

async function dislike(personId) {
  agentMemory.dislikedIds.add(personId);
  console.log(`❌ Disliked ${personId}`);
}

async function exportTrainingData() {
  console.log('\n📦 Exporting Training Data...');
  console.log('─'.repeat(50));
  
  // Get all likes with full person details
  const likes = await client.query(`
    SELECT 
      ues.person_id,
      p.full_name,
      p.headline,
      p.country,
      p.about
    FROM public.user_entity_status ues
    JOIN people_db.person p ON p.specter_person_id = ues.person_id
    WHERE ues.status = 'liked' AND ues.person_id IS NOT NULL
  `);
  
  const dislikes = await client.query(`
    SELECT 
      ues.person_id,
      p.full_name,
      p.headline,
      p.country,
      p.about
    FROM public.user_entity_status ues
    JOIN people_db.person p ON p.specter_person_id = ues.person_id
    WHERE ues.status = 'disliked' AND ues.person_id IS NOT NULL
  `);
  
  const trainingData = {
    likes: likes.rows.map(r => ({
      id: r.person_id,
      name: r.full_name,
      headline: r.headline,
      country: r.country,
      about: r.about?.slice(0, 500),
      label: 1,
    })),
    dislikes: dislikes.rows.map(r => ({
      id: r.person_id,
      name: r.full_name,
      headline: r.headline,
      country: r.country,
      about: r.about?.slice(0, 500),
      label: 0,
    })),
  };
  
  console.log(`Likes: ${trainingData.likes.length}`);
  console.log(`Dislikes: ${trainingData.dislikes.length}`);
  console.log('\nSample Like:');
  if (trainingData.likes[0]) {
    console.log(JSON.stringify(trainingData.likes[0], null, 2));
  }
  
  // Save to file
  const fs = require('fs');
  const filename = `training-data-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(trainingData, null, 2));
  console.log(`\n✅ Saved to ${filename}`);
}

async function showHelp() {
  console.log(`
🤖 Specter Agent Database CLI

Commands:
  stats              Show database statistics
  founders [n]       List sample founders (default: 10)
  likes              Show liked entities from database
  search <query>     Search people by name/headline
  person <id>        Get full person details
  like <id>          Mark person as liked (local memory)
  dislike <id>       Mark person as disliked (local memory)
  memory             Show local agent memory
  training           Export training data to JSON
  help               Show this help
  quit               Exit
`);
}

async function showMemory() {
  console.log('\n🧠 Agent Memory');
  console.log('─'.repeat(50));
  console.log(`Liked: ${agentMemory.likedIds.size}`);
  console.log(`Disliked: ${agentMemory.dislikedIds.size}`);
  console.log(`Preferences:`, agentMemory.preferences);
}

async function handleCommand(input) {
  const [cmd, ...args] = input.trim().split(' ');
  const arg = args.join(' ');
  
  try {
    switch (cmd.toLowerCase()) {
      case 'stats':
        await showStats();
        break;
      case 'founders':
        await listFounders(parseInt(arg) || 10);
        break;
      case 'likes':
        await showLikes();
        break;
      case 'search':
        if (!arg) {
          console.log('Usage: search <query>');
        } else {
          await searchPeople(arg);
        }
        break;
      case 'person':
        if (!arg) {
          console.log('Usage: person <person_id>');
        } else {
          await getPersonDetails(arg);
        }
        break;
      case 'like':
        if (!arg) {
          console.log('Usage: like <person_id>');
        } else {
          await like(arg);
        }
        break;
      case 'dislike':
        if (!arg) {
          console.log('Usage: dislike <person_id>');
        } else {
          await dislike(arg);
        }
        break;
      case 'memory':
        await showMemory();
        break;
      case 'training':
        await exportTrainingData();
        break;
      case 'help':
        await showHelp();
        break;
      case 'quit':
      case 'exit':
        console.log('Goodbye!');
        process.exit(0);
      default:
        console.log(`Unknown command: ${cmd}. Type 'help' for commands.`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function main() {
  console.log('🚀 Specter Agent Database CLI');
  console.log('='.repeat(50));
  
  await connect();
  await showHelp();
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });
  
  rl.prompt();
  
  rl.on('line', async (line) => {
    if (line.trim()) {
      await handleCommand(line);
    }
    rl.prompt();
  }).on('close', () => {
    console.log('Goodbye!');
    process.exit(0);
  });
}

main().catch(console.error);

