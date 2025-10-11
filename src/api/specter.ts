// Specter API Service
// Real API integration for VC people database

const API_BASE_URL = "https://specter-api-staging.up.railway.app";

export interface Experience {
  company_name: string;
  title: string;
  is_current: boolean;
  company_size?: string;
  total_funding_amount?: number;
  start_date?: string;
  end_date?: string;
}

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  profile_image_url?: string;
  tagline?: string;
  location?: string;
  seniority?: string;
  years_of_experience?: number;
  experience: Experience[];
  people_highlights?: string[];
  entity_status?: {
    status: "viewed" | "liked" | "disliked";
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
    const response = await fetch(`${API_BASE_URL}/private/people/${personId}/like`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
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
    const response = await fetch(
      `${API_BASE_URL}/private/people/${personId}/dislike`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

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
