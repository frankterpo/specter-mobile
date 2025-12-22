// 🚀 Mobile App Integration Test
// Tests JWT token from mobile app with Railway API

const https = require('https');

// Railway API configuration
const API_BASE = 'https://specter-api-prod.up.railway.app';

async function testRailwayAPI(token) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}/private/people`;
    const data = JSON.stringify({ limit: 3, offset: 0 });
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Test with a token (replace with actual token from mobile app)
async function runTest(token) {
  console.log('🧪 Testing Mobile App JWT Token with Railway API');
  console.log('================================================');
  console.log(`Token: ${token.substring(0, 50)}...`);
  console.log('');
  
  try {
    const result = await testRailwayAPI(token);
    console.log(`📊 Status: ${result.status}`);
    
    if (result.status === 200) {
      console.log('✅ SUCCESS! Mobile app can access Railway API!');
      console.log('📄 Data:', JSON.stringify(result.data, null, 2));
    } else {
      console.log('❌ Failed:', result.data);
    }
  } catch (error) {
    console.log('💥 Error:', error.message);
  }
}

// Usage: node test_mobile_integration.js "YOUR_JWT_TOKEN"
const token = process.argv[2];
if (!token) {
  console.log('❌ Please provide JWT token as argument');
  console.log('Usage: node test_mobile_integration.js "YOUR_TOKEN"');
  process.exit(1);
}

runTest(token);
