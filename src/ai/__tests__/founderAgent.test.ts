import { getFounderAgent } from '../founderAgent';
import { getCactusClient } from '../cactusClient';
import type { Person } from '../../api/specter';

// Mock fetch
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ organization_name: 'Test Co', funding: { total_funding_usd: 5000000 } }),
} as Response);

describe('FounderAgent', () => {
  it('should analyze a founder using tools', async () => {
    const agent = getFounderAgent();
    const client = getCactusClient();
    
    // Mock Cactus to trigger a tool call first, then a final response
    (client.complete as jest.Mock)
      .mockResolvedValueOnce({
        success: true,
        functionCalls: [{ name: 'lookup_company_funding', arguments: { company_id: 'test_co' } }],
        timeToFirstTokenMs: 10,
        totalTimeMs: 100,
        tokensPerSecond: 10,
        response: 'Checking funding...',
      })
      .mockResolvedValueOnce({
        success: true,
        response: "**SUMMARY**\n- Founder of funded startup\n\n**STRENGTHS**\n- Raised $5M\n\n**RISKS**\n- None",
        timeToFirstTokenMs: 10,
        totalTimeMs: 100,
        tokensPerSecond: 10,
      });

    const person: Person = {
      id: '123',
      first_name: 'Test',
      last_name: 'Founder',
      full_name: 'Test Founder',
      experience: [
        { company_name: 'Test Co', title: 'CEO', is_current: true }
      ]
    };

    const result = await agent.analyzeFounder(person, { token: 'mock_token' });
    
    expect(result).toBeDefined();
    expect(result.summary.length).toBeGreaterThan(0);
    expect(client.complete).toHaveBeenCalledTimes(2);
    console.log('Final Analysis:', JSON.stringify(result, null, 2));
  });
});

