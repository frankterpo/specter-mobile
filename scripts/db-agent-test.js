#!/usr/bin/env node
/**
 * Direct Database Agent Test
 * 
 * Bypasses the Specter API entirely and queries the Postgres database directly.
 * This allows us to test agent logic with real data without needing Clerk auth.
 * 
 * Usage: node scripts/db-agent-test.js
 */

const { Client } = require('pg');

// Railway staging database
const DATABASE_URL = 'postgresql://specter_admin:XHhgjwY7kUwBNJo5dHLGJk9L@product-db-staging.cefiadjkb8ut.eu-west-2.rds.amazonaws.com:5432/postgres';

async function main() {
  console.log('🚀 Direct Database Agent Test');
  console.log('='.repeat(60));
  
  const client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to Specter Postgres database\n');
    
    // 1. Get sample people (founders)
    console.log('📊 Fetching sample founders...');
    const peopleResult = await client.query(`
      SELECT 
        p.specter_person_id,
        p.full_name,
        p.headline,
        p.city,
        p.country,
        p.about,
        p.profile_image_url
      FROM people_db.person p
      WHERE p.headline ILIKE '%founder%' OR p.headline ILIKE '%ceo%'
      LIMIT 10
    `);
    
    console.log(`Found ${peopleResult.rows.length} founders:`);
    peopleResult.rows.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.full_name} - ${(p.headline || '').slice(0, 50)}...`);
    });
    
    // 2. Get companies with funding
    console.log('\n📊 Fetching recent companies...');
    const companiesResult = await client.query(`
      SELECT 
        c.organization_id,
        c.name,
        c.domain,
        c.description,
        c.hq_location,
        c.founded_date
      FROM public.companies c
      WHERE c.founded_date >= 2020
      LIMIT 10
    `);
    
    console.log(`Found ${companiesResult.rows.length} recent companies:`);
    companiesResult.rows.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name} (${c.domain}) - Founded ${c.founded_date}`);
    });
    
    // 3. Get saved searches
    console.log('\n📊 Fetching saved searches...');
    const searchesResult = await client.query(`
      SELECT 
        q.id,
        q.name,
        q.query_id,
        q.user_id,
        q.full_count,
        q.new_count
      FROM public.queries_by_user q
      WHERE q.name IS NOT NULL AND q.full_count > 0
      ORDER BY q.full_count DESC
      LIMIT 10
    `);
    
    console.log(`Found ${searchesResult.rows.length} saved searches:`);
    searchesResult.rows.forEach((s, i) => {
      console.log(`  ${i + 1}. "${s.name}" - ${s.full_count.toLocaleString()} results (${s.new_count} new)`);
    });
    
    // 4. Get user interactions (reward signals)
    console.log('\n📊 Fetching user interactions (reward signals)...');
    const interactionsResult = await client.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM public.user_entity_status
      GROUP BY status
      ORDER BY count DESC
    `);
    
    console.log('Interaction breakdown:');
    interactionsResult.rows.forEach((r) => {
      console.log(`  • ${r.status}: ${parseInt(r.count).toLocaleString()}`);
    });
    
    // 5. Get sample likes for training data
    console.log('\n📊 Fetching sample likes for training...');
    const likesResult = await client.query(`
      SELECT 
        ues.id,
        ues.status,
        ues.user_id,
        ues.company_id,
        ues.person_id,
        ues.talent_id
      FROM public.user_entity_status ues
      WHERE ues.status = 'liked'
      LIMIT 10
    `);
    
    console.log(`Found ${likesResult.rows.length} likes:`);
    likesResult.rows.forEach((l, i) => {
      const entityType = l.company_id ? 'company' : l.person_id ? 'person' : l.talent_id ? 'talent' : 'unknown';
      const entityId = l.company_id || l.person_id || l.talent_id;
      console.log(`  ${i + 1}. User ${l.user_id.slice(0, 15)}... liked ${entityType}: ${entityId}`);
    });
    
    // 6. Get a specific company with funding info
    console.log('\n📊 Fetching company with funding details...');
    const fundedCompanyResult = await client.query(`
      SELECT 
        c.name,
        c.domain,
        c.founded_date,
        c.hq_location,
        fr.announced_on,
        fr.funding_type,
        fr.raised_amount_usd
      FROM public.companies c
      LEFT JOIN public.funding_round fr ON c.mongo_id = fr.company_id
      WHERE fr.raised_amount_usd > 1000000
      ORDER BY fr.raised_amount_usd DESC
      LIMIT 5
    `);
    
    console.log('Top funded companies:');
    fundedCompanyResult.rows.forEach((r, i) => {
      const amount = r.raised_amount_usd ? `$${(r.raised_amount_usd / 1000000).toFixed(1)}M` : 'N/A';
      console.log(`  ${i + 1}. ${r.name} - ${r.funding_type} - ${amount}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Database test complete!');
    console.log('\nYou can now use these queries in your agent logic.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

main();

