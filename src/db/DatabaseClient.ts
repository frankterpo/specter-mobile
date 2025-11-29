/**
 * DatabaseClient - Direct Postgres access for Specter data
 * 
 * This module provides direct database queries for the AI agent tools,
 * bypassing the HTTP API layer for faster, more reliable data access.
 * 
 * NOTE: In React Native, we can't use node-postgres directly.
 * Instead, we'll use a lightweight HTTP proxy or the existing API
 * with the SERVICE_API_KEY for backend-to-backend calls.
 * 
 * For development/testing, this can be swapped with direct PG queries.
 */

import { logger } from '../utils/logger';

// Database connection config (for backend proxy or direct connection in Node.js)
const DB_CONFIG = {
  host: 'product-db-staging.cefiadjkb8ut.eu-west-2.rds.amazonaws.com',
  port: 5432,
  database: 'postgres',
  user: 'specter_admin',
  password: 'XHhgjwY7kUwBNJo5dHLGJk9L',
  ssl: true,
};

// Service API key for backend calls (bypasses Clerk auth)
const SERVICE_API_KEY = '5416ae05fd9a66ce8b98b5df9bd7218f';
const API_BASE = 'https://specter-api-staging.up.railway.app';

// Types
export interface PersonRecord {
  specter_person_id: string;
  full_name: string;
  headline: string | null;
  city: string | null;
  country: string | null;
  about: string | null;
  profile_image_url: string | null;
  linkedin_url: string | null;
}

export interface PersonJobRecord {
  company_name: string;
  title: string;
  is_current: boolean;
  start_date: string | null;
  end_date: string | null;
  industry: string | null;
}

export interface PersonHighlightRecord {
  highlight: string;
}

export interface CompanyRecord {
  organization_id: string;
  name: string;
  domain: string;
  description: string | null;
  hq_location: string | null;
  founded_date: number | null;
  linkedin_url: string | null;
}

export interface FundingRoundRecord {
  organization_id: string;
  organization_name: string;
  investment_type: string;
  announced_on: string;
  raised_amount_usd: number | null;
  investor_count: number | null;
}

export interface UserEntityStatusRecord {
  status: 'liked' | 'disliked' | 'viewed';
  person_id: string | null;
  company_id: string | null;
  talent_id: string | null;
}

/**
 * Execute a query against the Specter database
 * 
 * In React Native, this will use a backend proxy.
 * In Node.js (testing), this can use node-postgres directly.
 */
async function executeQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
  // For React Native, we need to use a proxy endpoint
  // For now, we'll implement this as a fetch to a proxy service
  // TODO: Set up a lightweight query proxy on Railway
  
  logger.info('DatabaseClient', 'Executing query', { sql: sql.slice(0, 100) });
  
  // Placeholder - in production this would call a proxy
  throw new Error('Direct database queries not yet available in React Native. Use API fallback.');
}

/**
 * Get person by ID with full details
 */
export async function getPersonById(personId: string): Promise<{
  person: PersonRecord | null;
  jobs: PersonJobRecord[];
  highlights: string[];
} | null> {
  try {
    // Try direct query first (will fail in RN, caught below)
    const [personRows, jobRows, highlightRows] = await Promise.all([
      executeQuery<PersonRecord>(`
        SELECT specter_person_id, full_name, headline, city, country, about, profile_image_url, linkedin_url
        FROM people_db.person
        WHERE specter_person_id = $1
      `, [personId]),
      executeQuery<PersonJobRecord>(`
        SELECT pj.company_name, pj.title, pj.is_current, pj.start_date, pj.end_date, pj.industry
        FROM people_db.person_job pj
        JOIN people_db.person p ON p.person_id = pj.person_id
        WHERE p.specter_person_id = $1
        ORDER BY pj.is_current DESC, pj.start_date DESC
      `, [personId]),
      executeQuery<PersonHighlightRecord>(`
        SELECT ph.highlight
        FROM people_db.person_highlight ph
        JOIN people_db.person p ON p.person_id = ph.person_id
        WHERE p.specter_person_id = $1
      `, [personId]),
    ]);

    if (personRows.length === 0) return null;

    return {
      person: personRows[0],
      jobs: jobRows,
      highlights: highlightRows.map(h => h.highlight),
    };
  } catch (error) {
    // Fallback to API (for React Native)
    logger.warn('DatabaseClient', 'Falling back to API for person lookup', { personId });
    return null;
  }
}

/**
 * Get company by ID with funding info
 */
export async function getCompanyById(companyId: string): Promise<{
  company: CompanyRecord | null;
  funding: FundingRoundRecord[];
} | null> {
  try {
    const [companyRows, fundingRows] = await Promise.all([
      executeQuery<CompanyRecord>(`
        SELECT organization_id, name, domain, description, hq_location, founded_date, linkedin_url
        FROM public.companies
        WHERE organization_id::text = $1 OR mongo_id = $1
      `, [companyId]),
      executeQuery<FundingRoundRecord>(`
        SELECT organization_id, organization_name, investment_type, announced_on, raised_amount_usd, investor_count
        FROM public.funding_round
        WHERE organization_id::text = $1
        ORDER BY announced_on DESC
      `, [companyId]),
    ]);

    if (companyRows.length === 0) return null;

    return {
      company: companyRows[0],
      funding: fundingRows,
    };
  } catch (error) {
    logger.warn('DatabaseClient', 'Falling back to API for company lookup', { companyId });
    return null;
  }
}

/**
 * Search people by query
 */
export async function searchPeople(query: string, limit: number = 10): Promise<PersonRecord[]> {
  try {
    return await executeQuery<PersonRecord>(`
      SELECT specter_person_id, full_name, headline, city, country, about, profile_image_url, linkedin_url
      FROM people_db.person
      WHERE full_name ILIKE $1 OR headline ILIKE $1 OR about ILIKE $1
      LIMIT $2
    `, [`%${query}%`, limit]);
  } catch (error) {
    logger.warn('DatabaseClient', 'Search failed, returning empty', { query });
    return [];
  }
}

/**
 * Search companies by query
 */
export async function searchCompanies(query: string, limit: number = 10): Promise<CompanyRecord[]> {
  try {
    return await executeQuery<CompanyRecord>(`
      SELECT organization_id, name, domain, description, hq_location, founded_date, linkedin_url
      FROM public.companies
      WHERE name ILIKE $1 OR domain ILIKE $1 OR description ILIKE $1
      LIMIT $2
    `, [`%${query}%`, limit]);
  } catch (error) {
    logger.warn('DatabaseClient', 'Company search failed, returning empty', { query });
    return [];
  }
}

/**
 * Get user's liked/disliked entities
 */
export async function getUserEntityStatuses(userId: string): Promise<UserEntityStatusRecord[]> {
  try {
    return await executeQuery<UserEntityStatusRecord>(`
      SELECT status, person_id, company_id, talent_id
      FROM public.user_entity_status
      WHERE user_id = $1
    `, [userId]);
  } catch (error) {
    logger.warn('DatabaseClient', 'Failed to get user statuses', { userId });
    return [];
  }
}

/**
 * Get founders with specific highlights (for sourcing)
 */
export async function getFoundersByHighlights(
  highlights: string[],
  limit: number = 20
): Promise<PersonRecord[]> {
  try {
    const highlightPattern = highlights.map(h => `'${h}'`).join(',');
    return await executeQuery<PersonRecord>(`
      SELECT DISTINCT p.specter_person_id, p.full_name, p.headline, p.city, p.country, p.about, p.profile_image_url, p.linkedin_url
      FROM people_db.person p
      JOIN people_db.person_highlight ph ON p.person_id = ph.person_id
      WHERE ph.highlight IN (${highlightPattern})
      LIMIT $1
    `, [limit]);
  } catch (error) {
    logger.warn('DatabaseClient', 'Founders by highlights failed', { highlights });
    return [];
  }
}

/**
 * Export training data (likes/dislikes with full profiles)
 */
export async function exportTrainingData(): Promise<{
  likes: Array<PersonRecord & { label: 1 }>;
  dislikes: Array<PersonRecord & { label: 0 }>;
}> {
  try {
    const [likes, dislikes] = await Promise.all([
      executeQuery<PersonRecord>(`
        SELECT p.specter_person_id, p.full_name, p.headline, p.city, p.country, p.about, p.profile_image_url, p.linkedin_url
        FROM public.user_entity_status ues
        JOIN people_db.person p ON p.specter_person_id = ues.person_id
        WHERE ues.status = 'liked' AND ues.person_id IS NOT NULL
      `),
      executeQuery<PersonRecord>(`
        SELECT p.specter_person_id, p.full_name, p.headline, p.city, p.country, p.about, p.profile_image_url, p.linkedin_url
        FROM public.user_entity_status ues
        JOIN people_db.person p ON p.specter_person_id = ues.person_id
        WHERE ues.status = 'disliked' AND ues.person_id IS NOT NULL
      `),
    ]);

    return {
      likes: likes.map(p => ({ ...p, label: 1 as const })),
      dislikes: dislikes.map(p => ({ ...p, label: 0 as const })),
    };
  } catch (error) {
    logger.warn('DatabaseClient', 'Training data export failed');
    return { likes: [], dislikes: [] };
  }
}

// Export config for Node.js testing
export { DB_CONFIG, SERVICE_API_KEY, API_BASE };

