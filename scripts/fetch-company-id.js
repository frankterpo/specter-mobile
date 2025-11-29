// Script to fetch a real company_id from Postgres
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.wdzvlfbwvrrmutkmmvyi:lkUGv3RzMKSamDmRWehp@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?sslmode=require';

async function fetchCompanyId() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Postgres');
    
    // Try different table/column names
    const queries = [
      "SELECT company_id, name FROM companies LIMIT 1;",
      "SELECT id, name FROM companies LIMIT 1;",
      "SELECT company_id, organization_name FROM companies LIMIT 1;",
      "SELECT * FROM companies LIMIT 1;",
    ];

    for (const query of queries) {
      try {
        const result = await client.query(query);
        if (result.rows.length > 0) {
          const row = result.rows[0];
          const companyId = row.company_id || row.id;
          const companyName = row.name || row.organization_name || 'Unknown';
          console.log(JSON.stringify({ company_id: companyId, name: companyName }));
          await client.end();
          process.exit(0);
        }
      } catch (e) {
        // Try next query
        continue;
      }
    }
    
    console.error('No companies found');
    await client.end();
    process.exit(1);
  } catch (error) {
    console.error('Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

fetchCompanyId();

