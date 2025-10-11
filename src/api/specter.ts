// Specter API Service
// Real API integration for VC people database

const API_BASE_URL = "https://specter-api-staging.up.railway.app";
const ENTITY_STATUS_BASE_URL = "https://app.staging.tryspecter.com/api/entity-status";

export interface Experience {
  company_name: string;
  title: string;
  is_current: boolean;
  company_size?: string;
  total_funding_amount?: number;
  start_date?: string;
  end_date?: string;
  industry?: string;
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
  experience: Experience[];
  people_highlights?: string[];
  linkedin_url?: string;
  twitter_url?: string;
  github_url?: string;
  followers_count?: number;
  connections_count?: number;
  entity_status?: {
    status: "viewed" | "liked" | "disliked";
    updated_at?: string;
  };
}

export interface FetchPeopleParams {
  limit: number;
  offset: number;
}

export interface FetchPeopleResponse {
  items: Person[];
  total?: number;
  has_more?: boolean;
}

/**
 * Fetch people from Specter API
 */
export async function fetchPeople(
  token: string,
  params: FetchPeopleParams
): Promise<FetchPeopleResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/private/people`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // API returns { items: [...] }
    return {
      items: data.items || data || [],
      total: data.total,
      has_more: data.has_more,
    };
  } catch (error: any) {
    console.error("fetchPeople error:", error);
    throw new Error(
      error.message || "Failed to fetch people. Please check your connection."
    );
  }
}

/**
 * Fetch single person details
 */
export async function fetchPersonDetail(
  token: string,
  personId: string
): Promise<Person> {
  try {
    const response = await fetch(`${API_BASE_URL}/private/people/${personId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("fetchPersonDetail error:", error);
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
    const response = await fetch(`${ENTITY_STATUS_BASE_URL}/people/${personId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "liked" }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }
  } catch (error: any) {
    console.error("likePerson error:", error);
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
    const response = await fetch(`${ENTITY_STATUS_BASE_URL}/people/${personId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "disliked" }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }
  } catch (error: any) {
    console.error("dislikePerson error:", error);
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
    const response = await fetch(`${ENTITY_STATUS_BASE_URL}/people/${personId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "viewed" }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }
  } catch (error: any) {
    console.error("markAsViewed error:", error);
    throw new Error(error.message || "Failed to mark as viewed. Please try again.");
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
  return `${person.first_name} ${person.last_name}`.trim();
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
  if (lowerHighlight.includes("fortune") || lowerHighlight.includes("500")) return "#3b82f6"; // blue
  if (lowerHighlight.includes("vc") || lowerHighlight.includes("backed")) return "#a855f7"; // purple
  if (lowerHighlight.includes("serial") || lowerHighlight.includes("founder")) return "#22c55e"; // green
  if (lowerHighlight.includes("exit")) return "#f97316"; // orange
  if (lowerHighlight.includes("ipo")) return "#eab308"; // gold
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
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) return "just now";
  if (diffMinutes === 1) return "1 minute ago";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}
