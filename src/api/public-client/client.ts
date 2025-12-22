import { Platform } from "react-native";
// Note: Clerk imports removed for web compatibility

// Web development mock token (bypasses Clerk CORS issues)
import { useAuth } from "@clerk/clerk-expo";
import {
  Person,
  FetchPeopleParams,
  FetchPeopleResponse,
  SavedSearch,
  SearchResultsResponse,
  PaginationParams,
  SpecterAPIError,
  AuthError,
  PeopleList,
} from "./types";
import { getUserContext } from "../../stores/userStore";

// Base URL for Specter API - Web app API (working setup)
const rawBaseUrl = process.env.EXPO_PUBLIC_SPECTER_API_URL || "https://app.tryspecter.com/api/v1";
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, ""); // Remove trailing slashes

// API key for web app authentication (not Clerk JWT)
const SPECTER_API_KEY = "iJXZPM060qU32m0UKCSfrtIVFzSt09La";

// Validate API configuration
if (__DEV__) {
  console.log(`🌐 [API] Web App Base URL: ${API_BASE_URL}`);
  console.log(`🔑 [API] Using API key authentication`);
}

// Timeout constants
const API_TIMEOUT_MS = 15000; // 15 seconds

/**
 * Timeout wrapper for promises
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Make API request with authentication
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  authToken?: string
): Promise<T> {

  if (!authToken) {
    throw new AuthError("Authentication required. Please sign in first");
  }

  // Ensure endpoint starts with / and base URL doesn't end with /
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;
  const headers = new Headers(options.headers);

  // Use API key authentication for web app (not JWT)
  headers.set("x-api-key", SPECTER_API_KEY);
  headers.set("Content-Type", "application/json");

  // Add user context if available
  const userContext = await getUserContext();
  if (userContext?.userId) {
    headers.set("x-user-id", userContext.userId);
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    ...(Platform.OS === "web" ? { mode: "cors", credentials: "omit" } : {}),
  };

  if (__DEV__) {
    const maskedToken = authToken ? `${authToken.substring(0, 8)}...${authToken.substring(authToken.length - 4)}` : "MISSING";
    console.log(`📤 [API] ${options.method || "GET"} ${url}`);
    console.log(`🔑 [API] Auth Token: ${maskedToken}`);
    console.log(`🔑 [API] Token length: ${authToken?.length || 0}`);
    // Log all headers being sent
    const headerEntries: string[] = [];
    headers.forEach((value, key) => {
      if (key === 'Authorization') {
        headerEntries.push(`${key}: Bearer ${maskedToken}`);
      } else {
        headerEntries.push(`${key}: ${value}`);
      }
    });
    console.log(`📋 [API] Headers: ${headerEntries.join(', ')}`);
  }

  const fetchPromise = fetch(url, fetchOptions);

  const response = await withTimeout(
    fetchPromise,
    API_TIMEOUT_MS,
    "API request timed out"
  );

  // Handle auth errors
  if (response.status === 401 || response.status === 403) {
    let errorMessage = "Authentication failed. Please check your API key.";
    try {
      const errorText = await response.text();
      if (errorText) {
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          // Not JSON, use text if it's short
          if (errorText.length < 200) {
            errorMessage = errorText;
          }
        }
      }
    } catch {
      // Ignore errors reading error response
    }
    if (__DEV__) {
      console.error(`❌ [API] Auth failed (${response.status}): ${errorMessage}`);
    }
    throw new AuthError(errorMessage);
  }

  if (!response.ok) {
    const errorText = await response.text();
    // Try to parse JSON error, otherwise use text
    let errorMessage = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error || errorText;
    } catch {
      // If it's HTML (like 404 pages), extract meaningful info
      if (errorText.includes('<!DOCTYPE html>') || errorText.includes('<html')) {
        if (response.status === 404) {
          // Extract route error from Remix error page if present
          const routeMatch = errorText.match(/No route matches URL "([^"]+)"/);
          if (routeMatch) {
            errorMessage = `API endpoint not found: ${routeMatch[1]}. Verify the endpoint exists on the server and the API base URL is correct.`;
          } else {
            errorMessage = `API endpoint not found: ${url}. Verify the endpoint exists on the server.`;
          }
        } else {
          errorMessage = `API Error ${response.status}: Server returned HTML instead of JSON. Check API URL configuration: ${API_BASE_URL}`;
        }
      }
    }
    
    if (__DEV__) {
      console.error(`❌ [API] Error ${response.status}: ${errorMessage.substring(0, 200)}`);
    }
    
    throw new SpecterAPIError(
      errorMessage,
      response.status
    );
  }

  return response.json();
}

/**
 * Public API Client for Specter
 */
export class SpecterPublicAPI {
  /**
   * People API methods
   */
  people = {
    /**
     * Enrich/search for a specific person
     * POST /v1/people
     * Note: This is for enrichment (finding a specific person), NOT for browsing/listing
     */
    async enrich(params: {
      linkedin_id?: string;
      linkedin_url?: string;
      linkedin_num_id?: number;
      linkedin_urn?: string;
    }, authToken: string): Promise<Person | { message: string; context: any }> {
      const body: any = {};
      if (params.linkedin_id) body.linkedin_id = params.linkedin_id;
      if (params.linkedin_url) body.linkedin_url = params.linkedin_url;
      if (params.linkedin_num_id) body.linkedin_num_id = params.linkedin_num_id;
      if (params.linkedin_urn) body.linkedin_urn = params.linkedin_urn;

      // Route: /private/people (POST for enrichment - returns single person or enrichment job)
      return apiRequest<Person | { message: string; context: any }>("/private/people", {
        method: "POST",
        body: JSON.stringify(body),
      }, authToken);
    },

    /**
     * Browse people from a list (with pagination)
     * GET /v1/lists/people/:listId/results?page=0&limit=25
     */
    async browseFromList(
      listId: string,
      page: number = 0,
      limit: number = 30
    ): Promise<FetchPeopleResponse> {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      return apiRequest<FetchPeopleResponse>(
        `/lists/people/${listId}/results?${params}`,
        {
          method: "GET",
        }
      );
    },

    /**
     * Browse people from a saved search (with pagination)
     * GET /v1/searches/people/:searchId/results?page=0&limit=25
     */
    async browseFromSearch(
      searchId: string,
      page: number = 0,
      limit: number = 30
    ): Promise<FetchPeopleResponse> {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      return apiRequest<FetchPeopleResponse>(
        `/searches/people/${searchId}/results?${params}`,
        {
          method: "GET",
        }
      );
    },

    /**
     * Browse company team members (with pagination)
     * GET /v1/companies/:companyId/people?page=0&limit=25
     */
    async browseCompanyTeam(
      companyId: string,
      authToken: string,
      page: number = 0,
      limit: number = 30,
      filters?: {
        founders?: boolean;
        department?: string;
        ceo?: boolean;
      }
    ): Promise<FetchPeopleResponse> {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (filters?.founders !== undefined) {
        params.set("founders", filters.founders.toString());
      }
      if (filters?.department) {
        params.set("department", filters.department);
      }
      if (filters?.ceo !== undefined) {
        params.set("ceo", filters.ceo.toString());
      }
      return apiRequest<FetchPeopleResponse>(
        `/api/companies/${companyId}/people?${params}`,
        {
          method: "GET",
        },
        authToken
      );
    },


    /**
     * Get person by ID
     * GET /v1/people/:id
     */
    async getById(personId: string, authToken: string): Promise<Person> {
      // Route: /private/people/:id
      return apiRequest<Person>(`/private/people/${personId}`, {
        method: "GET",
      }, authToken);
    },

    /**
     * Get person by email
     * GET /api/v1/people/by-email?email=...
     */
    async getByEmail(email: string, authToken: string): Promise<Person> {
      const params = new URLSearchParams({ email });
      return apiRequest<Person>(`/private/people/by-email?${params}`, {
        method: "GET",
      }, authToken);
    },

    /**
     * Like a person
     * POST /api/entity-status/people/:id (or similar endpoint)
     * Note: Endpoint may need to be confirmed with backend
     */
    async like(personId: string, authToken: string): Promise<void> {
      // Use Railway entity-status endpoint
      await apiRequest<void>(`/private/entity-status/people/${personId}`, {
          method: "POST",
          body: JSON.stringify({ status: "liked" }),
      }, authToken);
    },

    /**
     * Dislike a person
     * POST /api/entity-status/people/:id (or similar endpoint)
     * Note: Endpoint may need to be confirmed with backend
     */
    async dislike(personId: string, authToken: string): Promise<void> {
      // Use Railway entity-status endpoint
      await apiRequest<void>(`/private/entity-status/people/${personId}`, {
        method: "POST",
        body: JSON.stringify({ status: "disliked" }),
      }, authToken);
    },

    /**
     * Get people signals feed (main people browsing endpoint)
     * POST /api/signals/people
     */
    async getPeopleSignals(
      authToken: string,
      filters?: {
        page?: number;
        limit?: number;
        search?: string;
        company_ids?: string[];
        seniority?: string[];
        department?: string[];
        location?: string[];
      }
    ): Promise<FetchPeopleResponse> {
      const body: any = {
        page: filters?.page || 0,
        limit: filters?.limit || 30,
      };

      if (filters?.search) body.search = filters.search;
      if (filters?.company_ids) body.company_ids = filters.company_ids;
      if (filters?.seniority) body.seniority = filters.seniority;
      if (filters?.department) body.department = filters.department;
      if (filters?.location) body.location = filters.location;

      return apiRequest<FetchPeopleResponse>(
        "/api/signals/people",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        authToken
      );

      // Note: If this 404s, we may need to use a different endpoint
      // The web app might use different people browsing endpoints
    },

    /**
     * Get people signals count
     * POST /api/signals/people/count
     */
    async getPeopleSignalsCount(
      authToken: string,
      filters?: {
        search?: string;
        company_ids?: string[];
        seniority?: string[];
        department?: string[];
        location?: string[];
      }
    ): Promise<{ count: number }> {
      const body: any = {};
      if (filters?.search) body.search = filters.search;
      if (filters?.company_ids) body.company_ids = filters.company_ids;
      if (filters?.seniority) body.seniority = filters.seniority;
      if (filters?.department) body.department = filters.department;
      if (filters?.location) body.location = filters.location;

      return apiRequest<{ count: number }>(
        "/api/signals/people/count",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        authToken
      );
    },

    /**
     * Get people filters
     * GET /api/signals/people/filters
     */
    async getPeopleFilters(authToken: string): Promise<any> {
      return apiRequest<any>("/api/signals/people/filters", {
        method: "GET",
      }, authToken);
    },
  };

  /**
   * Companies API methods
   */
  companies = {
    /**
     * Get company signals feed (main company browsing endpoint)
     * POST /api/signals/company
     */
    async getCompanySignals(
      authToken: string,
      filters?: {
        page?: number;
        limit?: number;
        search?: string;
        industry?: string[];
        location?: string[];
      }
    ): Promise<FetchPeopleResponse> {
      const body: any = {
        page: filters?.page ?? 0,
        limit: filters?.limit ?? 30,
      };
      if (filters?.search) body.search = filters.search;
      if (filters?.industry) body.industry = filters.industry;
      if (filters?.location) body.location = filters.location;

      return apiRequest<FetchPeopleResponse>(
        "/api/signals/company",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        authToken
      );
    },

    /**
     * Get company signals count
     * POST /api/signals/company/count
     */
    async getCompanySignalsCount(
      authToken: string,
      filters?: {
        search?: string;
        industry?: string[];
        location?: string[];
      }
    ): Promise<{ count: number }> {
      const body: any = {};
      if (filters?.search) body.search = filters.search;
      if (filters?.industry) body.industry = filters.industry;
      if (filters?.location) body.location = filters.location;

      return apiRequest<{ count: number }>(
        "/api/signals/company/count",
        {
            method: "POST",
          body: JSON.stringify(body),
        },
        authToken
      );
    },

    /**
     * Get company filters
     * GET /api/signals/company/filters?page=1
     */
    async getCompanyFilters(page: number = 1, authToken: string): Promise<any> {
      return apiRequest<any>(`/api/signals/company/filters?page=${page}`, {
        method: "GET",
      }, authToken);
    },

    /**
     * Browse company team members (with pagination)
     * GET /api/companies/:companyId/people?page=0&limit=25
     */
    async browseCompanyTeam(
      companyId: string,
      authToken: string,
      page: number = 0,
      limit: number = 30,
      filters?: {
        founders?: boolean;
        department?: string;
        ceo?: boolean;
      }
    ): Promise<FetchPeopleResponse> {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
          });
      if (filters?.founders !== undefined) {
        params.set("founders", filters.founders.toString());
      }
      if (filters?.department) {
        params.set("department", filters.department);
      }
      if (filters?.ceo !== undefined) {
        params.set("ceo", filters.ceo.toString());
        }
      return apiRequest<FetchPeopleResponse>(
        `/api/companies/${companyId}/people?${params}`,
        {
          method: "GET",
        },
        authToken
      );
    },
  };

  /**
   * Searches API methods
   */
  searches = {
    /**
     * Get all saved searches
     * GET /api/__public/v1/searches
     */
    async getAll(authToken: string): Promise<SavedSearch[]> {
      return apiRequest<SavedSearch[]>("/private/searches", {
        method: "GET",
      }, authToken);
    },

    /**
     * Get search results for people (with page-based pagination)
     * GET /api/v1/searches/people/:searchId/results?page=0&limit=25
     * Note: page is 0-based
     */
    async getPeopleResults(
      searchId: string,
      page: number = 0,
      limit: number = 30
    ): Promise<FetchPeopleResponse> {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      return apiRequest<FetchPeopleResponse>(
        `/searches/people/${searchId}/results?${params}`,
        {
          method: "GET",
        }
      );
    },

  };

  /**
   * Lists API methods
   */
  lists = {
    /**
     * Get all lists (companies or people)
     * GET /api/lists?product=company or product=people
     */
    async getLists(product: 'company' | 'people' = 'people', limit: number = 5000, authToken: string): Promise<any[]> {
      const params = new URLSearchParams({
        product,
        limit: limit.toString(),
        skipMockCounts: 'true'
      });
      return apiRequest<any[]>(`/api/lists?${params}`, {
        method: "GET",
      }, authToken);
    },

    /**
     * Get people lists (legacy method - calls getLists with people)
     */
    async getPeopleLists(authToken: string): Promise<PeopleList[]> {
      return this.getLists('people', 5000, authToken);
    },

    /**
     * Get list results (with page-based pagination)
     * GET /api/v1/lists/people/:listId/results?page=0&limit=25
     * Note: page is 0-based
     */
    async getPeopleListResults(
      listId: string,
      page: number = 0,
      limit: number = 30,
      authToken: string
    ): Promise<FetchPeopleResponse> {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      return apiRequest<FetchPeopleResponse>(
        `/private/lists/people/${listId}/results?${params}`,
        {
          method: "GET",
        },
        authToken
      );
    },

    /**
     * Add person to list
     * PATCH /api/v1/lists/people/:listId
     */
    async addPersonToList(listId: string, personId: string, authToken: string): Promise<void> {
      return apiRequest<void>(`/private/lists/people/${listId}`, {
        method: "PATCH",
        body: JSON.stringify({ add_ids: [personId] }),
      }, authToken);
    },

    /**
     * Create a new people list
     * POST /api/v1/lists/people
     */
    async createPeopleList(name: string, personIds: string[] | undefined, authToken: string): Promise<{ id: string }> {
      const body: any = { name };
      if (personIds && personIds.length > 0) {
        body.people_ids = personIds;
      }
      return apiRequest<{ id: string }>("/private/lists/people", {
        method: "POST",
        body: JSON.stringify(body),
      }, authToken);
    },
  };
}

// Export singleton instance
export const specterPublicAPI = new SpecterPublicAPI();

