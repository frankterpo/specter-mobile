// Specter API Service
// Real API integration for VC people database

const API_BASE_URL = "https://specter-api-staging.up.railway.app";
const ENTITY_STATUS_BASE_URL = "https://app.staging.tryspecter.com/api/entity-status";
const LISTS_BASE_URL = "https://app.staging.tryspecter.com/api/lists";
// Specter Public API - uses X-API-KEY authentication
const SPECTER_API_BASE_URL = "https://app.tryspecter.com/api/v1";

// Get API key from environment
const getSpecterApiKey = (): string | null => {
  return process.env.EXPO_PUBLIC_SPECTER_API_KEY || null;
};

// Timeout constants
const API_TIMEOUT_MS = 15000; // 15 seconds
const AUTH_TIMEOUT_MS = 3000; // 3 seconds

export interface Experience {
  company_name: string;
  title: string;
  is_current: boolean;
  company_size?: string;
  total_funding_amount?: number;
  start_date?: string;
  end_date?: string;
  industry?: string;
  department?: string;
}

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  profile_image_url?: string;
  tagline?: string;
  location?: string;
  region?: string;
  seniority?: string;
  years_of_experience?: number;
  education_level?: string;
  field_of_study?: string;
  experience: Experience[];
  people_highlights?: string[];
  linkedin_url?: string;
  twitter_url?: string;
  github_url?: string;
  followers_count?: number;
  connections_count?: number;
  entity_status?: {
    // Single status - mutually exclusive!
    status: "viewed" | "liked" | "disliked" | null;
    updated_at?: string;
    
    // Team actions
    viewed_by_team?: boolean;
    liked_by_team?: boolean;
    disliked_by_team?: boolean;
  };
}

export interface FilterOptions {
  // General
  seniority?: string[];
  yearsOfExperience?: {
    min?: number;
    max?: number;
  };
  location?: string[];
  
  // Experience
  department?: string[];
  hasCurrentPosition?: boolean;
  
  // Companies
  companyIndustries?: string[];
  companySize?: string[];
  companyGrowthStage?: string[];
  
  // Education
  educationLevel?: string[];
  fieldOfStudy?: string[];
  
  // People Highlights
  highlights?: string[];
  
  // Social
  hasLinkedIn?: boolean;
  hasTwitter?: boolean;
  hasGitHub?: boolean;
}

export interface StatusFilters {
  // Personal status
  myStatus?: "viewed" | "not_viewed" | "liked" | "disliked" | null;
  
  // Team status
  teamViewed?: boolean;
  teamLiked?: boolean;
}

export interface FetchPeopleParams {
  limit: number;
  offset: number;
  filters?: FilterOptions;
  statusFilters?: StatusFilters;
  queryId?: string; // Optional queryId for pre-created queries
}

export interface FetchPeopleResponse {
  items: Person[];
  total?: number;
  has_more?: boolean;
  query_id?: string; // Return queryId for subsequent pagination
}

export interface CreateQueryResponse {
  query_id: string;
  total?: number;
}

// Custom error class for auth failures
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
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

/**
 * Map filter options from UI to backend API format
 * Backend expects specific field names and structures
 */
function mapFiltersToBackendFormat(filters?: FilterOptions, statusFilters?: StatusFilters): any {
  const apiFilters: any = {};

  // Status filters (personal and team)
  if (statusFilters) {
    if (statusFilters.myStatus) {
      apiFilters.MyEntityStatus = statusFilters.myStatus;
    }
    if (statusFilters.teamViewed) {
      apiFilters.TeamViewed = true;
    }
    if (statusFilters.teamLiked) {
      apiFilters.TeamLiked = true;
    }
  }

  if (!filters) return apiFilters;

  // Seniority - direct mapping
  if (filters.seniority && filters.seniority.length > 0) {
    apiFilters.SeniorityLevel = ["OR", filters.seniority];
  }

  // Department - wrapped in timeframe + logic
  if (filters.department && filters.department.length > 0) {
    apiFilters.Department = ["Current", ["OR", filters.department]];
  }

  // Company Industries
  if (filters.companyIndustries && filters.companyIndustries.length > 0) {
    apiFilters.CompanyIndustries = ["Current", ["OR", filters.companyIndustries]];
  }

  // Company Size
  if (filters.companySize && filters.companySize.length > 0) {
    apiFilters.CompanySize = ["Current", ["OR", filters.companySize]];
  }

  // Company Growth Stage
  if (filters.companyGrowthStage && filters.companyGrowthStage.length > 0) {
    apiFilters.CompanyGrowthStage = ["Current", ["OR", filters.companyGrowthStage]];
  }

  // Education Level
  if (filters.educationLevel && filters.educationLevel.length > 0) {
    apiFilters.EducationLevel = ["OR", filters.educationLevel];
  }

  // Field of Study
  if (filters.fieldOfStudy && filters.fieldOfStudy.length > 0) {
    apiFilters.FieldOfStudy = ["OR", filters.fieldOfStudy];
  }

  // People Highlights
  if (filters.highlights && filters.highlights.length > 0) {
    apiFilters.Highlights = ["OR", filters.highlights];
  }

  // Social media flags
  if (filters.hasLinkedIn) {
    apiFilters.HasLinkedIn = true;
  }
  if (filters.hasTwitter) {
    apiFilters.HasTwitter = true;
  }
  if (filters.hasGitHub) {
    apiFilters.HasGitHub = true;
  }

  // Has current position
  if (filters.hasCurrentPosition) {
    apiFilters.HasCurrentPosition = true;
  }

  // Years of experience
  if (filters.yearsOfExperience) {
    if (filters.yearsOfExperience.min !== undefined) {
      apiFilters.MinYearsOfExperience = filters.yearsOfExperience.min;
    }
    if (filters.yearsOfExperience.max !== undefined) {
      apiFilters.MaxYearsOfExperience = filters.yearsOfExperience.max;
    }
  }

  // Location
  if (filters.location && filters.location.length > 0) {
    apiFilters.Location = ["OR", filters.location];
  }

  return apiFilters;
}

/**
 * Create a query with filters and return queryId
 * This is step 1 in the Specter API flow
 */
export async function createQuery(
  token: string,
  filters?: FilterOptions,
  statusFilters?: StatusFilters
): Promise<CreateQueryResponse> {
  try {
    // Build request body with filters
    const body: any = {
      type: "people",
    };

    // Map and add filters (including status filters)
    const apiFilters = mapFiltersToBackendFormat(filters, statusFilters);
    if (Object.keys(apiFilters).length > 0) {
      body.filters = apiFilters;
    }

    if (__DEV__) {
      console.log("📤 Creating Query:", {
        url: `${API_BASE_URL}/private/queries`,
        body: JSON.stringify(body, null, 2),
      });
    }

    const fetchPromise = fetch(`${API_BASE_URL}/private/queries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired. Please sign in again.");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (__DEV__) {
      console.log(`✅ Query created: ${data.query_id || data.id}`);
    }

    return {
      query_id: data.query_id || data.id,
      total: data.total,
    };
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ createQuery error:", error);
    throw new Error(
      error.message || "Failed to create query. Please check your connection."
    );
  }
}

/**
 * Fetch people from Specter API
 * Supports two modes:
 * 1. Direct fetch with filters (legacy)
 * 2. Fetch from existing queryId (recommended)
 */
export async function fetchPeople(
  token: string,
  params: FetchPeopleParams
): Promise<FetchPeopleResponse> {
  try {
    // If queryId is provided, use query-based endpoint
    if (params.queryId) {
      if (__DEV__) {
        console.log("📤 Fetching from Query:", {
          url: `${API_BASE_URL}/private/queries/${params.queryId}/people`,
          limit: params.limit,
          offset: params.offset,
        });
      }

      const fetchPromise = fetch(
        `${API_BASE_URL}/private/queries/${params.queryId}/people?limit=${params.limit}&offset=${params.offset}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const response = await withTimeout(
        fetchPromise,
        API_TIMEOUT_MS,
        "API request timed out"
      );

      if (response.status === 401 || response.status === 403) {
        throw new AuthError("Authentication expired. Please sign in again.");
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (__DEV__) {
        console.log(`📥 API Response: ${data.items?.length || 0} items from query`);
      }

      return {
        items: data.items || data || [],
        total: data.total,
        has_more: data.has_more,
        query_id: params.queryId,
      };
    }

    // Otherwise, use direct POST endpoint (legacy mode)
    const body: any = {
      limit: params.limit,
      offset: params.offset,
    };

    // Map and add filters (including status filters)
    const apiFilters = mapFiltersToBackendFormat(params.filters, params.statusFilters);
    if (Object.keys(apiFilters).length > 0) {
      body.filters = apiFilters;
    }

    if (__DEV__) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📤 API REQUEST TO BACKEND:");
      console.log("URL:", `${API_BASE_URL}/private/people`);
      console.log("Method: POST");
      console.log("Body:");
      console.log(JSON.stringify(body, null, 2));
      if (body.filters) {
        console.log("🔍 Filters being sent:");
        Object.keys(body.filters).forEach(key => {
          console.log(`  ${key}:`, JSON.stringify(body.filters[key]));
        });
      }
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    // Make API call with timeout
    // Note: Railway API requires Clerk token in Authorization header
    const fetchPromise = fetch(`${API_BASE_URL}/private/people`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      mode: "cors", // Explicitly request CORS
      credentials: "omit", // Don't send cookies
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    console.log("🚨 API RESPONSE STATUS:", response.status);
    console.log("🚨 API RESPONSE OK?:", response.ok);

    // Handle auth errors immediately
    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired. Please sign in again.");
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.log("🚨 API ERROR TEXT:", errorText);
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("🚨 API DATA RECEIVED:", {
      hasItems: !!data.items,
      itemsCount: data.items?.length,
      hasTotal: !!data.total,
      hasMore: !!data.has_more,
      dataKeys: Object.keys(data || {}),
    });

    if (__DEV__) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📥 API RESPONSE FROM BACKEND:");
      console.log(`Items received: ${data.items?.length || 0}`);
      console.log(`Total: ${data.total || 'not provided'}`);
      console.log(`Has more: ${data.has_more || 'not provided'}`);
      if (data.items?.length > 0) {
        console.log("Sample items with entity_status:");
        data.items.slice(0, 3).forEach((item: any, idx: number) => {
          console.log(`  [${idx}] ${item.full_name || item.id}`);
          console.log(`      entity_status:`, JSON.stringify(item.entity_status || null));
        });
      }
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    // API returns { items: [...] }
    return {
      items: data.items || data || [],
      total: data.total,
      has_more: data.has_more,
      query_id: data.query_id, // May return queryId for subsequent pagination
    };
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ fetchPeople error:", error);
    throw new Error(
      error.message || "Failed to fetch people. Please check your connection."
    );
  }
}

/**
 * Fetch single person details
 */
export async function fetchPersonDetail(
  _token?: string, // Token kept for backwards compatibility but not used
  personId?: string
): Promise<Person> {
  try {
    const apiKey = getSpecterApiKey();
    if (!apiKey) {
      throw new Error("No EXPO_PUBLIC_SPECTER_API_KEY configured");
    }
    
    if (!personId) {
      throw new Error("No personId provided");
    }
    
    console.log("[fetchPersonDetail] Fetching person:", personId);
    
    // Use the public Specter API with X-API-Key
    const fetchPromise = fetch(`${SPECTER_API_BASE_URL}/people/${personId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired. Please sign in again.");
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[fetchPersonDetail] API Error:", response.status, errorText);
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("[fetchPersonDetail] Success, got person:", data.full_name || data.first_name);
    return data;
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ fetchPersonDetail error:", error);
    throw new Error(
      error.message || "Failed to fetch person details. Please check your connection."
    );
  }
}

/**
 * Like a person
 */
export async function likePerson(
  token: string,
  personId: string
): Promise<void> {
  try {
    const requestBody = { 
      status: "liked" // REPLACES any previous status
    };
    
    if (__DEV__) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📤 LIKE API CALL (REPLACES previous status)`);
      console.log(`   URL: ${ENTITY_STATUS_BASE_URL}/people/${personId}`);
      console.log(`   Method: POST`);
      console.log(`   Body:`, JSON.stringify(requestBody));
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }
    
    const fetchPromise = fetch(`${ENTITY_STATUS_BASE_URL}/people/${personId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ LIKE API FAILED: ${response.status} - ${errorText}`);
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    // Get the response body to see what the API returned
    const responseData = await response.json().catch(() => ({}));

    if (__DEV__) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`✅ LIKE API SUCCESS`);
      console.log(`   Person ${personId} is NOW LIKED in database`);
      console.log(`   Response status: ${response.status}`);
      console.log(`   Response body:`, JSON.stringify(responseData));
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ likePerson error:", error);
    throw new Error(error.message || "Failed to like person. Please try again.");
  }
}

/**
 * Dislike a person
 */
export async function dislikePerson(
  token: string,
  personId: string
): Promise<void> {
  try {
    const requestBody = { 
      status: "disliked" // REPLACES any previous status
    };
    
    if (__DEV__) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📤 DISLIKE API CALL (REPLACES previous status)`);
      console.log(`   URL: ${ENTITY_STATUS_BASE_URL}/people/${personId}`);
      console.log(`   Method: POST`);
      console.log(`   Body:`, JSON.stringify(requestBody));
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }
    
    const fetchPromise = fetch(`${ENTITY_STATUS_BASE_URL}/people/${personId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ DISLIKE API FAILED: ${response.status} - ${errorText}`);
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    // Get the response body to see what the API returned
    const responseData = await response.json().catch(() => ({}));

    if (__DEV__) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`✅ DISLIKE API SUCCESS`);
      console.log(`   Person ${personId} is NOW DISLIKED in database`);
      console.log(`   Response status: ${response.status}`);
      console.log(`   Response body:`, JSON.stringify(responseData));
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ dislikePerson error:", error);
    throw new Error(error.message || "Failed to dislike person. Please try again.");
  }
}

/**
 * Mark person as viewed
 */
export async function markAsViewed(
  token: string,
  personId: string
): Promise<void> {
  try {
    const requestBody = { 
      status: "viewed" // REPLACES any previous status (Pass/Skip action)
    };
    
    if (__DEV__) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📤 PASS/VIEWED API CALL (REPLACES previous status)`);
      console.log(`   URL: ${ENTITY_STATUS_BASE_URL}/people/${personId}`);
      console.log(`   Method: POST`);
      console.log(`   Body:`, JSON.stringify(requestBody));
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }
    
    const fetchPromise = fetch(`${ENTITY_STATUS_BASE_URL}/people/${personId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ VIEWED API FAILED: ${response.status} - ${errorText}`);
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    // Get the response body to see what the API returned
    const responseData = await response.json().catch(() => ({}));

    if (__DEV__) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`✅ VIEWED API SUCCESS`);
      console.log(`   Person ${personId} is NOW VIEWED in database`);
      console.log(`   Response status: ${response.status}`);
      console.log(`   Response body:`, JSON.stringify(responseData));
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ markAsViewed error:", error);
    // Don't throw for view tracking failures - it's not critical
  }
}

/**
 * Fetch team status for a person (who on the team has viewed/liked this person)
 */
export async function fetchTeamStatus(
  token: string,
  personId: string
): Promise<{
  viewed_by: string[];
  liked_by: string[];
  disliked_by: string[];
}> {
  try {
    const fetchPromise = fetch(
      `${ENTITY_STATUS_BASE_URL}/people/${personId}/team`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return {
      viewed_by: data.viewed_by || [],
      liked_by: data.liked_by || [],
      disliked_by: data.disliked_by || [],
    };
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ fetchTeamStatus error:", error);
    return { viewed_by: [], liked_by: [], disliked_by: [] };
  }
}

/**
 * Helper: Get current job from experience array
 */
export function getCurrentJob(experience: Experience[]): Experience | null {
  return experience.find((exp) => exp.is_current) || null;
}

/**
 * Helper: Format person name
 */
export function getFullName(person: Person): string {
  return person.full_name || `${person.first_name} ${person.last_name}`.trim();
}

/**
 * Helper: Get initials for avatar fallback
 */
export function getInitials(person: Person): string {
  const firstInitial = person.first_name?.[0] || "";
  const lastInitial = person.last_name?.[0] || "";
  return (firstInitial + lastInitial).toUpperCase();
}

/**
 * Helper: Format highlight text
 */
export function formatHighlight(highlight: string): string {
  return highlight
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Helper: Get highlight color
 */
export function getHighlightColor(highlight: string): string {
  const lowerHighlight = highlight.toLowerCase();
  if (lowerHighlight.includes("fortune") || lowerHighlight.includes("500"))
    return "#3b82f6"; // blue
  if (lowerHighlight.includes("unicorn")) return "#8B5CF6"; // purple
  if (lowerHighlight.includes("vc") || lowerHighlight.includes("backed"))
    return "#a855f7"; // purple
  if (lowerHighlight.includes("serial") || lowerHighlight.includes("founder"))
    return "#22c55e"; // green
  if (lowerHighlight.includes("exit")) return "#f97316"; // orange
  if (lowerHighlight.includes("ipo")) return "#eab308"; // gold
  if (lowerHighlight.includes("yc") || lowerHighlight.includes("alumni"))
    return "#FF6600"; // YC orange
  return "#6366f1"; // default indigo
}

/**
 * Helper: Calculate age from years of experience (rough estimate)
 * Assumes: started working at 22, current year 2025
 */
export function calculateAge(yearsOfExperience?: number): number | null {
  if (yearsOfExperience === undefined || yearsOfExperience === null) return null;
  return 22 + yearsOfExperience;
}

/**
 * Helper: Format relative timestamp (e.g., "2 minutes ago")
 */
export function formatRelativeTime(timestamp?: string): string | null {
  if (!timestamp) return null;

  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return past.toLocaleDateString();
}

/**
 * Helper: Format company size range
 */
export function formatCompanySize(size?: string): string {
  if (!size) return "Unknown";
  return `${size} employees`;
}

/**
 * Helper: Format funding amount
 */
export function formatFunding(amount?: number): string {
  if (!amount) return "Unknown";
  if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(1)}B`;
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

// ============================================
// LIST MANAGEMENT
// ============================================

export interface List {
  id: string;
  name: string;
  description?: string;
  person_count?: number;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// SAVED SEARCHES TYPES
// ============================================

export interface SavedSearch {
  id: number;
  name: string;
  is_global: boolean;
  query_id: number;
  // Feed types from Specter API:
  // 1. company - Company saved searches
  // 2. people - People saved searches
  // 3. talent - Talent Signals saved searches (different from people)
  // 4. investors - Investor saved searches
  // 5. stratintel - Strategic Intelligence / Interest Signals
  // 6. interest_signals - Interest Signals (alias for stratintel)
  product_type: 'company' | 'people' | 'talent' | 'investors' | 'stratintel' | 'interest_signals';
  full_count: number;
  new_count: number;
  // Additional fields from the web app
  new_funding_count?: number;
  new_growth_count?: number;
  new_funding_highlights_count?: number;
  new_growth_highlights_count?: number;
  visibility?: 'private' | 'public';
  creator?: string;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// TALENT SIGNALS TYPES
// ============================================

export interface TalentSignal {
  // Signal metadata
  signal_date: string;
  signal_score: number;
  signal_type: string; // e.g., "New Company", "departure", "hire", "promotion"
  signal_status?: string; // e.g., "Stealth"
  out_of_stealth_advantage?: number;
  announcement_delay_months?: number;
  talent_last_signal?: boolean;
  
  // New position info
  new_position_title?: string;
  new_position_company_id?: string;
  new_position_company_name?: string;
  new_position_company_website?: string;
  new_position_company_tagline?: string;
  
  // Past position info
  past_position_company_id?: string;
  past_position_title?: string;
  past_position_company_name?: string;
  past_position_company_website?: string;
  
  // Signal IDs
  talent_signal_ids?: string[];
  investor_signal_ids?: string[];
  
  // Person data (matches Person interface)
  person_id: string;
  profile_picture_url?: string;
  first_name: string;
  last_name: string;
  full_name: string;
  linkedin_url?: string;
  twitter_url?: string;
  github_url?: string;
  about?: string;
  tagline?: string;
  location?: string;
  region?: string;
  highlights?: string[];
  level_of_seniority?: string;
  years_of_experience?: number;
  education_level?: string;
  experience?: {
    company_name: string;
    company_id?: string;
    domain?: string;
    linkedin_url?: string;
    description?: string;
    company_size?: string;
    industries?: string[];
    title?: string;
    departments?: string[];
    start_date?: string;
    end_date?: string | null;
    location?: string;
    is_current?: boolean;
    founded_year?: number;
    job_order?: number;
  };
  current_tenure?: number;
  average_tenure?: number;
  education?: {
    name: string;
    linkedin_url?: string;
    field_of_study?: string;
    degree_title?: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    location?: string;
  };
  languages?: { name: string; proficiency_level: string }[];
  skills?: string[];
  linkedin_followers?: number;
  linkedin_connections?: number;
}

// ============================================
// INVESTOR INTEREST TYPES
// ============================================

export interface InvestorInterestSignal {
  signal_id: string;
  signal_date: string;
  signal_score: number;
  signal_type: string; // e.g., "Company"
  source_types?: string;
  signal_total_funding_usd?: number;
  signal_last_funding_usd?: number;
  signal_last_funding_date?: string;
  signal_investors?: { name: string }[];
  entity_id: string; // Can be person_id or company_id
  
  // Company data (when signal_type is "Company")
  company?: {
    name: string;
    description?: string;
    website?: string;
    linkedin_url?: string;
    twitter_url?: string;
    founded_year?: number;
    hq?: {
      city?: string;
      state?: string;
      country?: string;
      region?: string;
    };
    industries?: string[];
  };
  
  // Person data (when signal is about a person)
  person?: {
    full_name: string;
    description?: string;
    website?: string;
    linkedin_url?: string;
    twitter_url?: string;
    founded_year?: number;
    location?: {
      city?: string;
      state?: string;
      country?: string;
      region?: string;
    };
    industries?: string;
  };
}

// ============================================
// ENRICHMENT TYPES
// ============================================

export interface EnrichPersonInput {
  linkedin_url?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
}

export interface EnrichCompanyInput {
  domain?: string;
  linkedin_url?: string;
  name?: string;
}

export interface EnrichResult<T> {
  input_index: number;
  data?: T;
  status: 'found' | 'not_found' | 'pending';
  match_confidence: number;
}

// ============================================
// COMPANY TYPES
// ============================================

export interface Company {
  id?: string; // Some endpoints return 'id'
  company_id?: string; // Some endpoints return 'company_id'
  name?: string; // Some endpoints return 'name'
  organization_name?: string; // Company search results return 'organization_name'
  description?: string;
  tagline?: string;
  logo_url?: string;
  industries?: string[];
  sub_industries?: string[];
  operating_status?: string;
  highlights?: string[];
  new_highlights?: string[];
  regions?: string[];
  founded_year?: number;
  founders?: string[];
  founder_info?: {
    specter_person_id?: string;
    full_name?: string;
    title?: string;
    departments?: string[];
    seniority?: string;
  }[];
  founder_count?: number;
  employee_count?: number;
  employee_count_range?: string;
  revenue_estimate_usd?: number;
  investors?: string[];
  investor_count?: number;
  patent_count?: number;
  trademark_count?: number;
  website?: {
    domain?: string;
    url?: string;
    domain_aliases?: string[];
  };
  hq?: {
    city?: string;
    state?: string;
    country?: string;
    region?: string;
  };
  contact?: {
    phone_number?: string;
    email?: string;
  };
  growth_stage?: string;
  funding?: {
    total_funding_usd?: number;
    last_funding_usd?: number;
    last_funding_date?: string;
    last_funding_type?: string;
    round_count?: number;
    round_details?: {
      type?: string;
      date?: string;
      raised?: number;
      investors?: string[];
    }[];
    post_money_valuation_usd?: number;
  };
  socials?: {
    twitter?: { url?: string; follower_count?: number };
    facebook?: { url?: string };
    linkedin?: { url?: string; follower_count?: number };
  };
}

/**
 * Fetch all lists for current user
 */
export async function fetchLists(token: string): Promise<List[]> {
  try {
    const fetchPromise = fetch(`${LISTS_BASE_URL}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.lists || data || [];
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ fetchLists error:", error);
    return [];
  }
}

/**
 * Get lists that a person belongs to
 */
export async function getPersonLists(
  token: string,
  personId: string
): Promise<string[]> {
  try {
    const fetchPromise = fetch(`${LISTS_BASE_URL}/people/${personId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.list_ids || data || [];
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ getPersonLists error:", error);
    return [];
  }
}

/**
 * Add person to a list
 */
export async function addToList(
  token: string,
  listId: string,
  personId: string
): Promise<void> {
  try {
    const fetchPromise = fetch(`${LISTS_BASE_URL}/${listId}/people`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ person_id: personId }),
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    if (__DEV__) {
      console.log(`✅ Added person ${personId} to list ${listId}`);
    }
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ addToList error:", error);
    throw new Error(error.message || "Failed to add to list");
  }
}

/**
 * Remove person from a list
 */
export async function removeFromList(
  token: string,
  listId: string,
  personId: string
): Promise<void> {
  try {
    const fetchPromise = fetch(`${LISTS_BASE_URL}/${listId}/people/${personId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    if (__DEV__) {
      console.log(`✅ Removed person ${personId} from list ${listId}`);
    }
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ removeFromList error:", error);
    throw new Error(error.message || "Failed to remove from list");
  }
}

// ============================================
// SAVED SEARCHES API
// ============================================

/**
 * Fetch all saved searches shared with the API
 * Returns searches across all product types (company, people, talent, investors)
 */
export async function fetchSavedSearches(
  _token?: string // Token kept for backwards compatibility but not used
): Promise<SavedSearch[]> {
  try {
    const apiKey = getSpecterApiKey();
    if (!apiKey) {
      console.warn("[fetchSavedSearches] No EXPO_PUBLIC_SPECTER_API_KEY configured");
      return [];
    }
    
    console.log("[fetchSavedSearches] Fetching from:", `${SPECTER_API_BASE_URL}/searches`);
    const fetchPromise = fetch(`${SPECTER_API_BASE_URL}/searches`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    console.log("[fetchSavedSearches] Response status:", response.status);
    
    if (response.status === 401 || response.status === 403) {
      const errorText = await response.text();
      console.error("[fetchSavedSearches] Auth error:", response.status, errorText);
      // Don't throw AuthError - just return empty array to avoid logout
      return [];
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[fetchSavedSearches] API error:", response.status, errorText);
      return [];
    }

    const data = await response.json();
    console.log("[fetchSavedSearches] Success! Got", data?.length || 0, "searches");
    
    return data || [];
  } catch (error: any) {
    console.error("❌ fetchSavedSearches error:", error);
    // Don't throw - just return empty to avoid crashing the app
    return [];
  }
}

/**
 * Fetch results from a people saved search
 */
export async function fetchPeopleSavedSearchResults(
  _token?: string, // Token kept for backwards compatibility but not used
  searchId?: number,
  params: { limit?: number; offset?: number } = {}
): Promise<{ items: Person[]; total?: number }> {
  try {
    const apiKey = getSpecterApiKey();
    if (!apiKey) {
      console.warn("[fetchPeopleSavedSearchResults] No EXPO_PUBLIC_SPECTER_API_KEY configured");
      return { items: [] };
    }
    
    if (!searchId) {
      console.error("[fetchPeopleSavedSearchResults] No searchId provided");
      return { items: [] };
    }
    
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());
    
    // Correct endpoint: /searches/people/{searchId}/results
    const url = `${SPECTER_API_BASE_URL}/searches/people/${searchId}/results?${queryParams}`;
    console.log("[fetchPeopleSavedSearchResults] Fetching from:", url);
    
    const fetchPromise = fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return {
      items: data.items || data || [],
      total: data.total,
    };
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ fetchPeopleSavedSearchResults error:", error);
    return { items: [] };
  }
}

/**
 * Fetch results from a company saved search
 */
export async function fetchCompanySavedSearchResults(
  _token?: string, // Token kept for backwards compatibility but not used
  searchId?: number,
  params: { limit?: number; offset?: number } = {}
): Promise<{ items: Company[]; total?: number }> {
  try {
    const apiKey = getSpecterApiKey();
    if (!apiKey) {
      console.warn("[fetchCompanySavedSearchResults] No EXPO_PUBLIC_SPECTER_API_KEY configured");
      return { items: [] };
    }
    
    if (!searchId) {
      console.error("[fetchCompanySavedSearchResults] No searchId provided");
      return { items: [] };
    }
    
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());
    
    // Correct endpoint: /searches/companies/{searchId}/results (note: plural "companies")
    const url = `${SPECTER_API_BASE_URL}/searches/companies/${searchId}/results?${queryParams}`;
    console.log("[fetchCompanySavedSearchResults] Fetching from:", url);
    
    const fetchPromise = fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return {
      items: data.items || data || [],
      total: data.total,
    };
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ fetchCompanySavedSearchResults error:", error);
    return { items: [] };
  }
}

// ============================================
// TALENT SIGNALS API
// ============================================

/**
 * Fetch talent signals from a saved search
 */
export async function fetchTalentSignals(
  _token?: string, // Token kept for backwards compatibility
  searchId?: number,
  params: { limit?: number; offset?: number; date_from?: string; date_to?: string } = {}
): Promise<{ items: TalentSignal[]; total?: number }> {
  try {
    const apiKey = getSpecterApiKey();
    if (!apiKey || !searchId) {
      return { items: [] };
    }
    
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());
    if (params.date_from) queryParams.set('date_from', params.date_from);
    if (params.date_to) queryParams.set('date_to', params.date_to);
    
    // Correct endpoint: /searches/talent/{searchId}/results
    const url = `${SPECTER_API_BASE_URL}/searches/talent/${searchId}/results?${queryParams}`;
    console.log("[fetchTalentSignals] Fetching from:", url);
    
    const fetchPromise = fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (__DEV__) {
      console.log(`✅ Fetched ${data.items?.length || 0} talent signals`);
    }
    
    return {
      items: data.items || data || [],
      total: data.total,
    };
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ fetchTalentSignals error:", error);
    return { items: [] };
  }
}

/**
 * Get a single talent signal by ID
 */
export async function getTalentSignalById(
  _token?: string, // Token kept for backwards compatibility
  signalId?: string
): Promise<TalentSignal | null> {
  try {
    const apiKey = getSpecterApiKey();
    if (!apiKey || !signalId) {
      return null;
    }
    
    const fetchPromise = fetch(`${SPECTER_API_BASE_URL}/talent/${signalId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 404) {
      return null;
    }

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ getTalentSignalById error:", error);
    return null;
  }
}

// ============================================
// INVESTOR INTEREST API
// ============================================

/**
 * Fetch investor interest signals from a saved search
 */
export async function fetchInvestorInterestSignals(
  _token?: string, // Token kept for backwards compatibility
  searchId?: number,
  params: { limit?: number; offset?: number } = {}
): Promise<{ items: InvestorInterestSignal[]; total?: number }> {
  try {
    const apiKey = getSpecterApiKey();
    if (!apiKey || !searchId) {
      return { items: [] };
    }
    
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());
    
    // Correct endpoint: /searches/investor-interest/{searchId}/results
    const url = `${SPECTER_API_BASE_URL}/searches/investor-interest/${searchId}/results?${queryParams}`;
    console.log("[fetchInvestorInterestSignals] Fetching from:", url);
    
    const fetchPromise = fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (__DEV__) {
      console.log(`✅ Fetched ${data.items?.length || 0} investor interest signals`);
    }
    
    return {
      items: data.items || data || [],
      total: data.total,
    };
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ fetchInvestorInterestSignals error:", error);
    return { items: [] };
  }
}

/**
 * Get a single investor interest signal by ID
 */
export async function getInvestorInterestById(
  _token?: string, // Token kept for backwards compatibility
  signalId?: string
): Promise<InvestorInterestSignal | null> {
  try {
    const apiKey = getSpecterApiKey();
    if (!apiKey || !signalId) {
      return null;
    }
    
    const fetchPromise = fetch(`${SPECTER_API_BASE_URL}/investor-interest/${signalId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 404) {
      return null;
    }

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ getInvestorInterestById error:", error);
    return null;
  }
}

// ============================================
// ENRICHMENT API
// ============================================

/**
 * Enrich people data from external identifiers
 */
export async function enrichPeople(
  _token?: string, // Token kept for backwards compatibility
  people?: EnrichPersonInput[]
): Promise<EnrichResult<Person>[]> {
  try {
    const apiKey = getSpecterApiKey();
    if (!apiKey || !people?.length) {
      return [];
    }
    
    const fetchPromise = fetch(`${SPECTER_API_BASE_URL}/enrichment/people`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({ people }),
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS * 2, // Enrichment may take longer
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (__DEV__) {
      const found = data.results?.filter((r: any) => r.status === 'found').length || 0;
      console.log(`✅ Enriched ${found}/${people.length} people`);
    }
    
    return data.results || [];
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ enrichPeople error:", error);
    return [];
  }
}

/**
 * Enrich company data from external identifiers
 */
export async function enrichCompanies(
  _token?: string, // Token kept for backwards compatibility
  companies?: EnrichCompanyInput[]
): Promise<EnrichResult<Company>[]> {
  try {
    const apiKey = getSpecterApiKey();
    if (!apiKey || !companies?.length) {
      return [];
    }
    
    const fetchPromise = fetch(`${SPECTER_API_BASE_URL}/enrichment/companies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({ companies }),
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS * 2, // Enrichment may take longer
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (__DEV__) {
      const found = data.results?.filter((r: any) => r.status === 'found').length || 0;
      console.log(`✅ Enriched ${found}/${companies.length} companies`);
    }
    
    return data.results || [];
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ enrichCompanies error:", error);
    return [];
  }
}

// ============================================
// COMPANY API
// ============================================

/**
 * Get company by ID
 */
export async function fetchCompanyDetail(
  token: string,
  companyId: string
): Promise<Company | null> {
  try {
    const fetchPromise = fetch(`${API_BASE_URL}/private/companies/${companyId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 404) {
      return null;
    }

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ fetchCompanyDetail error:", error);
    return null;
  }
}

/**
 * Get similar companies
 */
export async function fetchSimilarCompanies(
  token: string,
  companyId: string,
  params: { limit?: number } = {}
): Promise<Company[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.set('limit', params.limit.toString());
    
    const url = `${API_BASE_URL}/private/companies/${companyId}/similar?${queryParams}`;
    
    const fetchPromise = fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.items || data || [];
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ fetchSimilarCompanies error:", error);
    return [];
  }
}

/**
 * Get company employees/founders
 */
export async function fetchCompanyPeople(
  token: string,
  companyId: string,
  params: { limit?: number; offset?: number } = {}
): Promise<{ items: Person[]; total?: number }> {
  try {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());
    
    const url = `${API_BASE_URL}/private/companies/${companyId}/people?${queryParams}`;
    
    const fetchPromise = fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return {
      items: data.items || data || [],
      total: data.total,
    };
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ fetchCompanyPeople error:", error);
    return { items: [] };
  }
}

/**
 * Search companies by name
 */
export async function searchCompanies(
  token: string,
  query: string,
  params: { limit?: number } = {}
): Promise<Company[]> {
  try {
    const queryParams = new URLSearchParams();
    queryParams.set('name', query);
    if (params.limit) queryParams.set('limit', params.limit.toString());
    
    const url = `${API_BASE_URL}/private/companies/search?${queryParams}`;
    
    const fetchPromise = fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.items || data || [];
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ searchCompanies error:", error);
    return [];
  }
}

// ============================================
// GLOBAL TEXT SEARCH
// ============================================

/**
 * Global entity search across people and companies
 */
export async function searchEntities(
  token: string,
  query: string,
  params: { type?: 'people' | 'company' | 'all'; limit?: number } = {}
): Promise<Array<{ id: string; type: string; name: string; [key: string]: any }>> {
  try {
    const fetchPromise = fetch(`${API_BASE_URL}/private/entities/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query,
        type: params.type || 'all',
        limit: params.limit || 20,
      }),
    });

    const response = await withTimeout(
      fetchPromise,
      API_TIMEOUT_MS,
      "API request timed out"
    );

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("Authentication expired");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.items || data || [];
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error("❌ searchEntities error:", error);
    return [];
  }
}
