import { Platform } from "react-native";
// Note: Clerk imports removed for web compatibility

// Web development mock token (bypasses Clerk CORS issues)
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
import { clearUserContext, getUserContext } from "../../stores/userStore";
import { useAuthStore } from "../../stores/authStore";
import { clearTokenCache } from "../../utils/tokenCache";
import { APICache, withCache, API_CACHE_CONFIGS } from "../../utils/apiCache";
import { getDevProxyOrigin } from "../../utils/devProxy";

// Base URL for Specter API - Web app API (working setup)
const isWeb = Platform.OS === "web";
const PROXY_BASE = isWeb ? `${getDevProxyOrigin()}/proxy/app` : "";
const rawBaseUrl = process.env.EXPO_PUBLIC_SPECTER_API_URL || "https://app.tryspecter.com/api";
const API_BASE_URL = isWeb ? PROXY_BASE : rawBaseUrl.replace(/\/+$/, ""); // Remove trailing slashes

// Validate API configuration
if (__DEV__) {
  console.log(`[API] Web App Base URL: ${API_BASE_URL}`);
  if (isWeb) {
    console.log(`[API] Using local proxy for web development`);
  }
}

// Timeout constants
const API_TIMEOUT_MS = 15000; // 15 seconds

async function handleAuthFailure() {
  await clearTokenCache();
  if (isWeb && __DEV__) {
    await useAuthStore.getState().setAuthEmail(null);
    await clearUserContext();
  }
}

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

const logDebug = (payload: any) => {
  const isWeb = Platform.OS === 'web';
  const endpoint = isWeb ? `${getDevProxyOrigin()}/api/debug-log` : 'http://127.0.0.1:7242/ingest/df6e2d2e-429a-4930-becf-dda1fd5d16a1';
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
};

/**
 * Make API request with authentication
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  authToken?: string,
  apiType: 'app' | 'railway' = 'app',
  overridePath?: string
): Promise<T> {
  if (!authToken) {
    throw new AuthError("Authentication required. Please sign in first");
  }

  // Ensure endpoint starts with / and base URL doesn't end with /
  const targetEndpoint = overridePath || endpoint;
  const cleanEndpoint = targetEndpoint.startsWith("/") ? targetEndpoint : `/${targetEndpoint}`;
  
  // Use proxy with specific API type in web mode
  const baseUrl = isWeb 
    ? `${getDevProxyOrigin()}/proxy/${apiType}`
    : (apiType === 'app' ? API_BASE_URL : process.env.EXPO_PUBLIC_SPECTER_RAILWAY_URL || "https://specter-api-prod.up.railway.app");

  const url = `${baseUrl}${cleanEndpoint}`;
  const headers = new Headers(options.headers);

  // Use JWT authentication
  headers.set("Authorization", `Bearer ${authToken}`);
  headers.set("Content-Type", "application/json");
  
  // OPTIMIZATION: Get context once and cache API key lookup
  const userContext = await getUserContext();
  const defaultApiKey = process.env.EXPO_PUBLIC_SPECTER_API_KEY;
  const apiKey = userContext?.apiKey || defaultApiKey;
  
  // Identification headers
  if (apiKey) {
    headers.set("x-api-key", apiKey);
  }
  if (userContext?.userId) {
    headers.set("x-user-id", userContext.userId);
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    ...(Platform.OS === "web" ? { mode: "cors", credentials: "omit" } : {}),
  };

  if (__DEV__) {
    const isMock = authToken === 'dev-bypass-token';
    console.log(`[API] ${options.method || "GET"} ${cleanEndpoint} ${isMock ? '(MOCK AUTH)' : '(REAL AUTH)'}`);
  }

  const fetchPromise = fetch(url, fetchOptions);

  const response = await withTimeout(
    fetchPromise,
    API_TIMEOUT_MS,
    "API request timed out"
  );

  const responseText = await response.text();

  // Handle auth errors
  if (response.status === 401 || response.status === 403) {
    let errorMessage = "Authentication failed.";
    if (responseText) {
      try {
        const errorJson = JSON.parse(responseText);
        const candidate = errorJson?.message ?? errorJson?.error;
        if (typeof candidate === "string" && candidate.trim().length > 0) {
          errorMessage = candidate;
        }
      } catch {
        if (responseText.length < 200) {
          errorMessage = responseText;
        }
      }
    }
    if (__DEV__) {
      console.error(`[API Auth Error] ${response.status}: ${errorMessage}`);
    }
    await handleAuthFailure();
    throw new AuthError(errorMessage);
  }

  if (!response.ok) {
    let errorMessage = responseText;
    try {
      const errorJson = JSON.parse(responseText);
      errorMessage = errorJson.message || errorJson.error || responseText;
    } catch {
      if (responseText.includes('<!DOCTYPE html>') || responseText.includes('<html')) {
        if (response.status === 404) {
          const routeMatch = responseText.match(/No route matches URL "([^"]+)"/);
          if (routeMatch) {
            errorMessage = `Endpoint not found: ${routeMatch[1]}`;
          } else {
            errorMessage = `Endpoint not found: ${url}`;
          }
        } else {
          errorMessage = `Server error ${response.status}: HTML returned instead of JSON.`;
        }
      }
    }
    
    if (__DEV__) {
      console.error(`[API Error] ${response.status}: ${errorMessage.substring(0, 200)}`);
    }
    
    throw new SpecterAPIError(
      errorMessage,
      response.status
    );
  }

  try {
    return JSON.parse(responseText);
  } catch (e: any) {
    throw new Error(`Failed to parse response: ${e.message}`);
  }
}

/**
 * Public API Client for Specter
 */
export class SpecterPublicAPI {
  /**
   * Update status for any entity (liked, disliked, viewed)
   *
   * NOTE: Implementation lives under `people.updateStatus` for historical reasons;
   * keep this convenience method because many callsites use `specterPublicAPI.updateStatus(...)`.
   */
  async updateStatus(
    entityType: 'people' | 'company' | 'investors',
    entityId: string,
    status: 'liked' | 'disliked' | 'viewed',
    authToken: string
  ): Promise<void> {
    return this.people.updateStatus(entityType, entityId, status, authToken);
  }

  /**
   * People API methods
   */
  people = {
    /**
     * Enrich/search for a specific person
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

      return apiRequest<Person | { message: string; context: any }>("/private/people", {
        method: "POST",
        body: JSON.stringify(body),
      }, authToken, 'railway');
    },

    /**
     * Browse people from a list (with pagination)
     */
    async browseFromList(
      listId: string,
      page: number = 0,
      limit: number = 30,
      authToken: string,
      apiType: 'app' | 'railway' = 'app',
      overridePath?: string
    ): Promise<FetchPeopleResponse> {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      return apiRequest<FetchPeopleResponse>(
        `/lists/people/${listId}/results?${params}`,
        {
          method: "GET",
        },
        authToken,
        apiType,
        overridePath
      );
    },

    /**
     * Browse people from a saved search (with pagination)
     */
    async browseFromSearch(
      searchId: string,
      page: number = 0,
      limit: number = 30,
      authToken: string,
      apiType: 'app' | 'railway' = 'app',
      overridePath?: string
    ): Promise<FetchPeopleResponse> {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      return apiRequest<FetchPeopleResponse>(
        `/v1/searches/people/${searchId}/results?${params}`,
        {
          method: "GET",
        },
        authToken,
        apiType,
        overridePath
      );
    },

    /**
     * Get person by ID
     */
    async getById(personId: string, authToken: string): Promise<Person> {
      return apiRequest<Person>(`/private/people/${personId}`, {
        method: "GET",
      }, authToken, 'railway');
    },

    /**
     * Get person by email
     */
    async getByEmail(email: string, authToken: string, apiType: 'app' | 'railway' = 'railway', overridePath?: string): Promise<Person> {
      const path = overridePath || "/v1/people/by-email";
      return apiRequest<Person>(path, {
        method: "POST",
        body: JSON.stringify({ email }),
      }, authToken, apiType);
    },

    /**
     * Update status for any entity (liked, disliked, viewed)
     */
    async updateStatus(
      entityType: 'people' | 'company' | 'investors',
      entityId: string,
      status: 'liked' | 'disliked' | 'viewed',
      authToken: string
    ): Promise<void> {
      // Backend uses 'company' (singular) for companies, but 'people' and 'investors' (plural)
      const typePath = entityType === 'company' ? 'company' : entityType;
      
      await apiRequest<void>(`/entity-status/${typePath}/${entityId}`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }, authToken, 'app');

      // Invalidate relevant cache patterns
      if (entityType === 'people') await APICache.invalidatePattern('people_signals');
      if (entityType === 'company') await APICache.invalidatePattern('company_signals');
      if (entityType === 'investors') await APICache.invalidatePattern('investor_signals');
    },

    /**
     * Like a person
     */
    async like(personId: string, authToken: string): Promise<void> {
      return this.updateStatus('people', personId, 'liked', authToken);
    },

    /**
     * Dislike a person
     */
    async dislike(personId: string, authToken: string): Promise<void> {
      return this.updateStatus('people', personId, 'disliked', authToken);
    },

    /**
     * Mark a person as viewed
     */
    async viewed(personId: string, authToken: string): Promise<void> {
      return this.updateStatus('people', personId, 'viewed', authToken);
    },

    /**
     * Get people signals feed
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
        queryId?: string;
        searchId?: string;
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
      if (filters?.queryId) body.queryId = filters.queryId;
      if (filters?.searchId) body.searchId = filters.searchId;

      return apiRequest<FetchPeopleResponse>(
        "/signals/people",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        authToken,
        'app'
      );
    },

    /**
     * Get people signals count
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
        "/signals/people/count",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        authToken,
        'app'
      );
    },

    /**
     * Get people filters (with caching)
     */
    getPeopleFilters: withCache(
      async (authToken: string): Promise<any> => {
        return apiRequest<any>("/signals/people/filters", {
          method: "GET",
        }, authToken, 'app');
      },
      API_CACHE_CONFIGS.PEOPLE_FILTERS
    ),

    /**
     * Get talent signals feed
     */
    async getTalentSignals(
      authToken: string,
      filters?: {
        page?: number;
        limit?: number;
        search?: string;
        seniority?: string[];
        location?: string[];
        queryId?: string;
        searchId?: string;
      }
    ): Promise<FetchPeopleResponse> {
      const body: any = {
        page: filters?.page || 0,
        limit: filters?.limit || 30,
      };
      if (filters?.search) body.search = filters.search;
      if (filters?.seniority) body.seniority = filters.seniority;
      if (filters?.location) body.location = filters.location;
      if (filters?.queryId) body.queryId = filters.queryId;
      if (filters?.searchId) body.searchId = filters.searchId;

      return apiRequest<FetchPeopleResponse>(
        "/signals/talent",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        authToken,
        'app'
      );
    },

    /**
     * Get talent signals count
     */
    async getTalentSignalsCount(authToken: string): Promise<{ count: number }> {
      return apiRequest<{ count: number }>(
        "/signals/talent/count",
        {
          method: "POST",
          body: JSON.stringify({}),
        },
        authToken,
        'app'
      );
    },

    /**
     * Get talent filters
     */
    getTalentFilters: withCache(
      async (authToken: string): Promise<any> => {
        return apiRequest<any>("/signals/talent/filters", {
          method: "GET",
        }, authToken, 'app');
      },
      API_CACHE_CONFIGS.PEOPLE_FILTERS
    ),
  };

  /**
   * Companies API methods
   */
  companies = {
    /**
     * Browse company team members (with pagination)
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
        `/private/companies/${companyId}/people`,
        {
          method: "GET",
        },
        authToken,
        'railway',
        `/private/companies/${companyId}/people?${params}`
      );
    },

    /**
     * Get company signals feed
     */
    async getCompanySignals(
      authToken: string,
      filters?: {
        page?: number;
        limit?: number;
        search?: string;
        industry?: string[];
        location?: string[];
        queryId?: string;
        searchId?: string;
      }
    ): Promise<FetchPeopleResponse> {
      const body: any = {
        page: filters?.page ?? 0,
        limit: filters?.limit ?? 30,
      };
      if (filters?.search) body.search = filters.search;
      if (filters?.industry) body.industry = filters.industry;
      if (filters?.location) body.location = filters.location;
      if (filters?.queryId) body.queryId = filters.queryId;
      if (filters?.searchId) body.searchId = filters.searchId;

      return apiRequest<FetchPeopleResponse>(
        "/signals/company",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        authToken,
        'app'
      );
    },

    /**
     * Browse companies from a saved search (with pagination)
     */
    async browseFromSearch(
      searchId: string,
      page: number = 0,
      limit: number = 30,
      authToken: string,
      apiType: 'app' | 'railway' = 'app',
      overridePath?: string
    ): Promise<any> {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      return apiRequest<any>(
        `/v1/searches/companies/${searchId}/results?${params}`,
        {
          method: "GET",
        },
        authToken,
        apiType,
        overridePath
      );
    },

    /**
     * Get company signals count
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
        "/signals/company/count",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        authToken,
        'app'
      );
    },

    /**
     * Get company filters (with caching)
     */
    getCompanyFilters: withCache(
      async (page: number = 1, authToken: string): Promise<any> => {
        return apiRequest<any>(`/signals/company/filters?page=${page}`, {
          method: "GET",
        }, authToken, 'app');
      },
      API_CACHE_CONFIGS.COMPANY_FILTERS
    ),

    /**
     * Get company by ID
     */
    async getById(companyId: string, authToken: string): Promise<any> {
      return apiRequest<any>(`/private/companies/${companyId}`, {
        method: "GET",
      }, authToken, 'railway');
    },

    /**
     * Get similar companies
     */
    async getSimilarCompanies(companyId: string, limit: number = 5, authToken: string): Promise<any[]> {
      return apiRequest<any[]>(`/private/companies/${companyId}/similar?limit=${limit}`, {
        method: "GET",
      }, authToken, 'railway');
    },

    /**
     * Get revenue signals feed
     */
    async getRevenueSignals(
      authToken: string,
      filters?: {
        page?: number;
        limit?: number;
        search?: string;
      }
    ): Promise<any> {
      const body: any = {
        page: filters?.page || 0,
        limit: filters?.limit || 30,
      };
      if (filters?.search) body.search = filters.search;

      return apiRequest<any>(
        "/signals/revenue",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        authToken,
        'app'
      );
    },

    /**
     * Get revenue signals count
     */
    async getRevenueSignalsCount(authToken: string): Promise<{ count: number }> {
      return apiRequest<{ count: number }>(
        "/signals/revenue/count",
        {
          method: "POST",
          body: JSON.stringify({}),
        },
        authToken,
        'app'
      );
    },

    /**
     * Get revenue filters
     */
    getRevenueFilters: withCache(
      async (authToken: string): Promise<any> => {
        return apiRequest<any>("/signals/revenue/filters", {
          method: "GET",
        }, authToken, 'app');
      },
      API_CACHE_CONFIGS.COMPANY_FILTERS
    ),

    /**
     * Like a company
     */
    async like(companyId: string, authToken: string): Promise<void> {
      return specterPublicAPI.updateStatus('company', companyId, 'liked', authToken);
    },

    /**
     * Dislike a company
     */
    async dislike(companyId: string, authToken: string): Promise<void> {
      return specterPublicAPI.updateStatus('company', companyId, 'disliked', authToken);
    },

    /**
     * Mark a company as viewed
     */
    async viewed(companyId: string, authToken: string): Promise<void> {
      return specterPublicAPI.updateStatus('company', companyId, 'viewed', authToken);
    },
  };

  /**
   * Investor API methods
   */
  investors = {
    /**
     * Get investor signals feed
     */
    async getSignals(
      authToken: string,
      filters?: {
        page?: number;
        limit?: number;
        search?: string;
      }
    ): Promise<any> {
      const body: any = {
        page: filters?.page || 0,
        limit: filters?.limit || 30,
      };
      if (filters?.search) body.search = filters.search;

      return apiRequest<any>(
        "/signals/investors",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        authToken,
        'app'
      );
    },

    /**
     * Get investor signals count
     */
    async getCount(authToken: string): Promise<{ count: number }> {
      return apiRequest<{ count: number }>(
        "/signals/investors/count",
        {
          method: "POST",
          body: JSON.stringify({}),
        },
        authToken,
        'app'
      );
    },

    /**
     * Get investor filters
     */
    getFilters: withCache(
      async (authToken: string): Promise<any> => {
        return apiRequest<any>("/signals/investors/filters", {
          method: "GET",
        }, authToken, 'app');
      },
      API_CACHE_CONFIGS.COMPANY_FILTERS
    ),

    /**
     * Like an investor
     */
    async like(investorId: string, authToken: string): Promise<void> {
      return specterPublicAPI.updateStatus('investors', investorId, 'liked', authToken);
    },

    /**
     * Dislike an investor
     */
    async dislike(investorId: string, authToken: string): Promise<void> {
      return specterPublicAPI.updateStatus('investors', investorId, 'disliked', authToken);
    },

    /**
     * Mark an investor as viewed
     */
    async viewed(investorId: string, authToken: string): Promise<void> {
      return specterPublicAPI.updateStatus('investors', investorId, 'viewed', authToken);
    },
  };

  /**
   * Transactions & Strategic API methods
   */
  transactions = {
    /**
     * Get funding signals feed
     */
    async getFundingSignals(
      authToken: string,
      filters?: {
        page?: number;
        limit?: number;
      }
    ): Promise<any> {
      const body: any = {
        page: filters?.page || 0,
        limit: filters?.limit || 30,
      };

      return apiRequest<any>(
        "/signals/funding-rounds",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        authToken,
        'app'
      );
    },

    /**
     * Get acquisition signals feed
     */
    async getAcquisitionSignals(
      authToken: string,
      filters?: {
        page?: number;
        limit?: number;
      }
    ): Promise<any> {
      const body: any = {
        page: filters?.page || 0,
        limit: filters?.limit || 30,
      };

      return apiRequest<any>(
        "/signals/acquisition",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        authToken,
        'app'
      );
    },

    /**
     * Get IPO signals feed
     */
    async getIPOSignals(
      authToken: string,
      filters?: {
        page?: number;
        limit?: number;
      }
    ): Promise<any> {
      const body: any = {
        page: filters?.page || 0,
        limit: filters?.limit || 30,
      };

      return apiRequest<any>(
        "/signals/ipo",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        authToken,
        'app'
      );
    },

    /**
     * Get strategic signals feed
     */
    async getStrategicSignals(
      authToken: string,
      filters?: {
        page?: number;
        limit?: number;
      }
    ): Promise<any> {
      const body: any = {
        page: filters?.page || 0,
        limit: filters?.limit || 30,
      };

      return apiRequest<any>(
        "/signals/strategic",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        authToken,
        'app'
      );
    },
  };

  /**
   * Searches API methods
   */
  searches = {
    /**
     * Get all saved searches
     */
    async getAll(authToken: string, apiType: 'app' | 'railway' = 'app', overridePath?: string): Promise<SavedSearch[]> {
      return apiRequest<SavedSearch[]>(overridePath || "/v1/searches", {
        method: "GET",
      }, authToken, apiType);
    },

    /**
     * Get a saved search by id
     */
    async getById(
      searchId: string,
      authToken: string,
      apiType: 'app' | 'railway' = 'app',
      overridePath?: string
    ): Promise<any> {
      const path = overridePath || `/saved-searches/${searchId}`;
      return apiRequest<any>(
        path,
        { method: "GET" },
        authToken,
        apiType,
        overridePath
      );
    },

    /**
     * Get saved search results for a product
     */
    async getSavedSearchResults(
      product: "companies" | "people" | "talent" | "investor-interest",
      searchId: string,
      page: number = 0,
      limit: number = 30,
      authToken: string,
      options: {
        apiType?: 'app' | 'railway';
        overridePath?: string;
        queryId?: string;
      } = {}
    ): Promise<any> {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (options.queryId) {
        params.set("queryId", options.queryId);
      }
      const apiType = options.apiType ?? 'app';
      const path = options.overridePath || `/v1/searches/${product}/${searchId}/results?${params}`;
      try {
        return await apiRequest<any>(
          path,
          {
            method: "GET",
          },
          authToken,
          apiType,
          options.overridePath
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isNotFound =
          error instanceof SpecterAPIError
            ? error.statusCode === 404 || message.includes("Endpoint not found")
            : message.includes("Endpoint not found");
        if (!options.overridePath && isNotFound) {
          const fallbackPath = `/searches/${product}/${searchId}/results?${params}`;
          return apiRequest<any>(
            fallbackPath,
            {
              method: "GET",
            },
            authToken,
            apiType,
            fallbackPath
          );
        }
        throw error;
      }
    },

    /**
     * Get search results for people
     */
    async getPeopleResults(
      searchId: string,
      page: number = 0,
      limit: number = 30,
      authToken: string,
      apiType: 'app' | 'railway' = 'railway',
      overridePath?: string
    ): Promise<FetchPeopleResponse> {
      return apiRequest<FetchPeopleResponse>(
        "/private/people/export",
        {
          method: overridePath ? "GET" : "POST",
          body: overridePath ? undefined : JSON.stringify({
            searchId,
            limit,
            page: page + 1,
          }),
        },
        authToken,
        apiType,
        overridePath
      );
    },

    /**
     * Get quick search history
     */
    async getHistory(authToken: string): Promise<any[]> {
      return apiRequest<any[]>("/private/quick-search/history", {
        method: "GET",
      }, authToken, 'railway');
    },

    /**
     * Search companies by term
     */
    async searchCompanies(term: string, authToken: string): Promise<any[]> {
      return apiRequest<any[]>(`/private/quick-search/company?term=${encodeURIComponent(term)}`, {
        method: "GET",
      }, authToken, 'railway');
    },

    /**
     * Search people by term
     */
    async searchPeople(term: string, authToken: string): Promise<any[]> {
      return apiRequest<any[]>(`/private/quick-search/people?term=${encodeURIComponent(term)}`, {
        method: "GET",
      }, authToken, 'railway');
    },

    /**
     * Get search counts
     */
    async getCounts(term: string, authToken: string): Promise<any> {
      return apiRequest<any>(`/private/quick-search/counts?term=${encodeURIComponent(term)}`, {
        method: "GET",
      }, authToken, 'railway');
    },
  };

  /**
   * User & System API methods
   */
  user = {
    /**
     * Get recent companies
     */
    async getRecentCompanies(authToken: string): Promise<any> {
      return apiRequest<any>("/user/recent/company", {
        method: "GET",
      }, authToken, 'app');
    },

    /**
     * Get recent people
     */
    async getRecentPeople(authToken: string): Promise<any> {
      return apiRequest<any>("/user/recent/people", {
        method: "GET",
      }, authToken, 'app');
    },

    /**
     * Get notifications
     */
    async getNotifications(authToken: string): Promise<any> {
      return apiRequest<any>("/notifications", {
        method: "GET",
      }, authToken, 'app');
    },

    /**
     * Get network status
     */
    async getNetworkStatus(authToken: string): Promise<any> {
      return apiRequest<any>("/network/status", {
        method: "GET",
      }, authToken, 'app');
    },
  };

  /**
   * Integrations API methods
   */
  integrations = {
    /**
     * Get all integrations
     */
    async getAll(authToken: string): Promise<any[]> {
      return apiRequest<any[]>("/integrations", {
        method: "GET",
      }, authToken, 'app');
    },

    /**
     * Get integration token
     */
    async getToken(authToken: string): Promise<{ token: string }> {
      return apiRequest<{ token: string }>("/integrations/token", {
        method: "GET",
      }, authToken, 'app');
    },
  };

  /**
   * Lists API methods
   */
  lists = {
    /**
     * Get all lists
     */
    getLists: withCache(
      async (product: 'company' | 'people' = 'people', limit: number = 5000, authToken: string): Promise<any[]> => {
        const params = new URLSearchParams({
          product,
          limit: limit.toString(),
          skipMockCounts: 'true'
        });
        return apiRequest<any[]>(`/lists?${params}`, {
          method: "GET",
        }, authToken, 'app');
      },
      API_CACHE_CONFIGS.USER_LISTS
    ),

    /**
     * Get list results
     */
    async getPeopleListResults(
      listId: string,
      page: number = 0,
      limit: number = 30,
      authToken: string,
      apiType: 'app' | 'railway' = 'railway',
      overridePath?: string
    ): Promise<FetchPeopleResponse> {
      return apiRequest<FetchPeopleResponse>(
        "/private/people/export",
        {
          method: overridePath ? "GET" : "POST",
          body: overridePath ? undefined : JSON.stringify({
            listId,
            limit,
            page: page + 1,
          }),
        },
        authToken,
        apiType,
        overridePath
      );
    },

    /**
     * Add person to list
     */
    async addPersonToList(listId: string, personId: string, authToken: string): Promise<void> {
      await apiRequest<void>(`/private/lists/people/${listId}`, {
        method: "PATCH",
        body: JSON.stringify({ add_ids: [personId] }),
      }, authToken, 'railway');

      await APICache.invalidatePattern('user_lists');
    },

    /**
     * Remove person from list
     */
    async removePersonFromList(listId: string, personId: string, authToken: string): Promise<void> {
      await apiRequest<void>(`/private/lists/people/${listId}`, {
        method: "PATCH",
        body: JSON.stringify({ remove_ids: [personId] }),
      }, authToken, 'railway');

      await APICache.invalidatePattern('user_lists');
    },

    /**
     * Create a new people list
     */
    async createPeopleList(name: string, personIds: string[] | undefined, authToken: string): Promise<{ id: string }> {
      const body: any = { name };
      if (personIds && personIds.length > 0) {
        body.people_ids = personIds;
      }
      return apiRequest<{ id: string }>("/private/lists/people", {
        method: "POST",
        body: JSON.stringify(body),
      }, authToken, 'railway');
    },

    /**
     * Perform text search
     */
    async textSearch(query: string, limit: number = 20, authToken: string): Promise<any> {
      const params = new URLSearchParams({ 
        term: query,
        limit: limit.toString()
      });
      return apiRequest<any>(`/private/quick-search/counts?${params}`, {
        method: "GET",
      }, authToken, 'railway');
    },
  };
}

// Export singleton instance
export const specterPublicAPI = new SpecterPublicAPI();
