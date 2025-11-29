#!/usr/bin/env node
/**
 * Quick Database Test - Non-interactive
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://specter_admin:XHhgjwY7kUwBNJo5dHLGJk9L@product-db-staging.cefiadjkb8ut.eu-west-2.rds.amazonaws.com:5432/postgres';

async function main() {
  const client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to Specter Postgres\n');
    
    // Stats
    console.log('📊 DATABASE STATS');
    console.log('─'.repeat(50));
    const [people, companies, searches] = await Promise.all([
      client.query('SELECT COUNT(*) FROM people_db.person'),
      client.query('SELECT COUNT(*) FROM public.companies'),
      client.query('SELECT COUNT(*) FROM public.queries_by_user WHERE name IS NOT NULL'),
    ]);
    console.log(`People:     ${parseInt(people.rows[0].count).toLocaleString()}`);
    console.log(`Companies:  ${parseInt(companies.rows[0].count).toLocaleString()}`);
    console.log(`Searches:   ${parseInt(searches.rows[0].count).toLocaleString()}`);
    
    // Interactions
    console.log('\n📊 USER INTERACTIONS (Reward Signals)');
    console.log('─'.repeat(50));
    const interactions = await client.query(`
      SELECT status, COUNT(*) as count 
      FROM public.user_entity_status 
      GROUP BY status 
      ORDER BY count DESC
    `);
    interactions.rows.forEach(r => {
      console.log(`  • ${r.status}: ${parseInt(r.count).toLocaleString()}`);
    });
    
    // Sample founders
    console.log('\n👥 SAMPLE FOUNDERS');
    console.log('─'.repeat(50));
    const founders = await client.query(`
      SELECT 
        p.specter_person_id as id,
        p.full_name,
        p.headline,
        p.country
      FROM people_db.person p
      WHERE p.headline ILIKE '%founder%' OR p.headline ILIKE '%ceo%'
      LIMIT 5
    `);
    founders.rows.forEach((p, i) => {
      console.log(`${i + 1}. ${p.full_name}`);
      console.log(`   ${(p.headline || '').slice(0, 60)}...`);
      console.log(`   ID: ${p.id}\n`);
    });
    
    // Training data export
    console.log('\n📦 TRAINING DATA EXPORT');
    console.log('─'.repeat(50));
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
        p.country
      FROM public.user_entity_status ues
      JOIN people_db.person p ON p.specter_person_id = ues.person_id
      WHERE ues.status = 'disliked' AND ues.person_id IS NOT NULL
    `);
    
    console.log(`Likes: ${likes.rows.length}`);
    console.log(`Dislikes: ${dislikes.rows.length}`);
    
    if (likes.rows.length > 0) {
      console.log('\nSample Liked Person:');
      const sample = likes.rows[0];
      console.log(JSON.stringify({
        id: sample.person_id,
        name: sample.full_name,
        headline: sample.headline,
        country: sample.country,
        about: sample.about?.slice(0, 200),
      }, null, 2));
    }
    
    // Save training data
    const fs = require('fs');
    const trainingData = {
      metadata: {
        exported_at: new Date().toISOString(),
        likes_count: likes.rows.length,
        dislikes_count: dislikes.rows.length,
      },
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
        label: 0,
      })),
    };
    
    const filename = 'training-data.json';
    fs.writeFileSync(filename, JSON.stringify(trainingData, null, 2));
    console.log(`\n✅ Saved training data to ${filename}`);
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Database test complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

main();

