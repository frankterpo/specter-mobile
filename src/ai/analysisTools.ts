import { Tool } from './cactusClient';
import { fetchCompanyDetail, fetchPeople, searchCompanies, fetchPersonDetail } from '../api/specter';
import { logger } from '../utils/logger';

export const ANALYSIS_TOOLS: Tool[] = [
  {
    name: 'lookup_company_funding',
    description: 'Get detailed funding, investors, and employee count for a company by its ID. Use this to verify if a startup is funded or check its stage.',
    parameters: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'The Specter company ID from experience history' },
      },
      required: ['company_id']
    }
  },
  {
    name: 'check_co_investors',
    description: 'Check the investors of a company to see if there are top-tier firms or co-investors.',
    parameters: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'The Specter company ID' },
      },
      required: ['company_id']
    }
  },
  {
    name: 'lookup_person_details',
    description: 'Get details about a person by their ID. Use this when you see a person_id in company founders or signals to traverse the graph.',
    parameters: {
      type: 'object',
      properties: {
        person_id: { type: 'string', description: 'The Specter person ID' },
      },
      required: ['person_id']
    }
  },
  {
    name: 'search_entity',
    description: 'Search for a company by name to get its ID for further lookups.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name to search for (e.g. "OpenAI")' },
        type: { type: 'string', enum: ['company'], description: 'Type of entity (default: company)' }
      },
      required: ['query']
    }
  }
];

export async function executeAnalysisTool(name: string, args: any, token: string | undefined): Promise<string> {
  if (!token) return "Error: Authentication required to use analysis tools.";

  try {
    switch (name) {
      case 'lookup_company_funding':
      case 'check_co_investors': {
        if (!args.company_id) return "Error: company_id is required";
        const company = await fetchCompanyDetail(token, args.company_id);
        if (!company) return "Company not found.";
        
        const funding = company.funding ? 
          `Total Funding: $${(company.funding.total_funding_usd || 0).toLocaleString()} (${company.funding.last_funding_type || 'Unknown'} round)` : 
          "Funding data not available.";
        
        const investors = company.investors?.length ? 
          `Investors: ${company.investors.slice(0, 5).join(', ')}` : 
          "No investor data.";
          
        const employees = company.employee_count ? `${company.employee_count} employees` : "";
        
        const result = `[Verified Data] Company: ${company.organization_name || company.name}\n${funding}\n${investors}\n${employees}`;
        logger.info('AnalysisTool', `Executed ${name} for ${args.company_id}`, { result });
        return result;
      }

      case 'lookup_person_details': {
        if (!args.person_id) return "Error: person_id is required";
        const person = await fetchPersonDetail(token, args.person_id);
        if (!person) return "Person not found.";
        
        const currentJob = person.experience?.find(e => e.is_current);
        const result = `[Verified Data] Person: ${person.full_name}\nRole: ${currentJob?.title} at ${currentJob?.company_name}\nHighlights: ${person.people_highlights?.join(', ')}`;
        logger.info('AnalysisTool', `Executed ${name} for ${args.person_id}`, { result });
        return result;
      }

      case 'search_entity': {
        if (!args.query) return "Error: query is required";
        // Only company search supported for now
        const results = await searchCompanies(token, args.query, { limit: 3 });
        if (results.length === 0) return `No companies found for "${args.query}"`;
        
        const result = results.map(c => 
          `ID: ${c.id || c.company_id || c.name}, Name: ${c.organization_name || c.name}, Domain: ${c.website?.domain || 'N/A'}`
        ).join('\n');
        
        logger.info('AnalysisTool', `Executed search_entity for "${args.query}"`, { count: results.length });
        return `Found companies:\n${result}`;
      }

      default:
        return `Tool ${name} not found.`;
    }
  } catch (error: any) {
    logger.error('AnalysisTool', `Error executing ${name}`, error);
    return `Error executing tool: ${error.message}`;
  }
}

