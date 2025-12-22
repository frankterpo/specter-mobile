// Direct Railway API Endpoint Tester
// Test endpoints without running the mobile app

const API_BASE_URL = 'https://specter-api-prod.up.railway.app';

// Mock JWT token (replace with real one from mobile app)
const MOCK_JWT_TOKEN = "eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSIsImtpZCI6Imluc18yNkJ2YXdSbHE1ZnlKVnR4NzgzZFdvZnB3RVMiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwczovL2FwcC50cnlzcGVjdGVyLmNvbSIsImV4cCI6MTc2NjMzNTI1NSwiZnZhIjpbMCwtMV0sImlhdCI6MTc2NjMzNTE5NSwiaXNzIjoiaHR0cHM6Ly9jbGVyay50cnlzcGVjdGVyLmNvbSIsIm5iZiI6MTc2NjMzNTE4NSwic2lkIjoic2Vzc18zN0EzUFFZV2RZVHdDTUVWbFFwd2pCd1FsblQiLCJzdHMiOiJhY3RpdmUiLCJzdWIiOiJ1c2VyXzJCVGRIM3lJc2h4b0NjRklVVzhQbk1wNEFKSiJ9.gORs8Q3klM7i0SuvQATnrZ-ThlSiiuHJ6wh982mV4Fz07Xr8Xn91ltm0OLU6niTDUxleFSkeI_2j7ZHPn0nC8vve2L_Pt75KfFupA9991AHMm4v9SPJgbUX908caWK5UYcTxxX1JIqFCkGpTmXykWNIDsIzGSB1ol3RwDokK8c_xGFnvEeJ30KFEpX2GfBLvLd5BrlPIHOrW7SXg1dYjSXiU-3qnuuNSkXC3Y9GhaZN0vLxb4vVsXsUZV3zDT2im-HmZ4oYPjZFSrZKr-yd2HenJUpnWQ01qe90qQ0zYfQUdRfW5WjJR1Oxpf1tmRXT-YWPL7tef-VlvDcJbND_AMg";

async function testEndpoint(method, path, body = null) {
  console.log(`\n🧪 Testing: ${method} ${path}`);
  console.log('='.repeat(50));
  
  try {
    const url = `${API_BASE_URL}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MOCK_JWT_TOKEN}`,
      },
    };
    
    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }
    
    console.log(`🌐 URL: ${url}`);
    console.log(`📝 Body: ${body ? JSON.stringify(body, null, 2) : 'None'}`);
    
    const startTime = Date.now();
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;
    
    console.log(`📊 Status: ${response.status} (${duration}ms)`);
    
    const responseText = await response.text();
    
    if (response.ok) {
      try {
        const jsonData = JSON.parse(responseText);
        console.log('✅ SUCCESS - JSON Response:');
        console.log(JSON.stringify(jsonData, null, 2));
      } catch {
        console.log('✅ SUCCESS - Text Response:');
        console.log(responseText);
      }
    } else {
      console.log('❌ ERROR:');
      console.log(responseText);
    }
    
  } catch (error) {
    console.log('💥 EXCEPTION:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 RAILWAY API ENDPOINT TESTS');
  console.log('==============================');
  console.log(`Base URL: ${API_BASE_URL}`);
  console.log(`Using JWT token: ${MOCK_JWT_TOKEN.substring(0, 50)}...`);
  console.log('');

  // Test 1: Health check
  await testEndpoint('GET', '/health');
  
  // Test 2: Browse People
  await testEndpoint('POST', '/private/people', { limit: 3, offset: 0 });
  
  // Test 3: Browse Companies
  await testEndpoint('POST', '/private/companies', { limit: 3, offset: 0 });
  
  // Test 4: Like Person
  await testEndpoint('POST', '/private/entity-status/people/test-person-id', { status: 'liked' });
  
  console.log('\n🎉 ALL TESTS COMPLETED!');
  console.log('========================');
}

runAllTests().catch(console.error);
