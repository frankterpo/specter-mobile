// TypeScript types for Specter Public API
// Derived from existing types and public API structure

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
  is_unicorn?: boolean;
}

export interface Education {
  school_name: string;
  degree?: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
}

export interface Award {
  award_name: string;
  award_date?: string;
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
  education?: Education[];
  awards?: Award[];
  people_highlights?: string[];
  linkedin_url?: string;
  twitter_url?: string;
  github_url?: string;
  followers_count?: number;
  connections_count?: number;
  entity_status?: {
    status: "viewed" | "liked" | "disliked" | null;
    updated_at?: string;
    viewed_by_team?: boolean;
    liked_by_team?: boolean;
    disliked_by_team?: boolean;
  };
}

export interface Company {
  id: string;
  name: string;
  organization_name?: string;
  logoUrl?: string;
  logo_url?: string;
  descriptionShort?: string;
  tagline?: string;
  industry?: string[];
  hqRegion?: string;
  location?: string;
  b2x?: string;
  rank?: number;
  operatingStatus?: string;
  employeeCount?: number;
  employee_count?: number;
  employee3moGrowthPct?: number;
  totalFundingAmount?: number;
  lastFundingType?: string;
  lastFundingAt?: string;
  website?: string;
  linkedinUrl?: string;
  highlights?: string[];
  awards?: Award[];
  entityStatus?: {
    status: "viewed" | "liked" | "disliked" | null;
  };
}

export interface FilterOptions {
  seniority?: string[];
  yearsOfExperience?: {
    min?: number;
    max?: number;
  };
  location?: string[];
  department?: string[];
  hasCurrentPosition?: boolean;
  companyIndustries?: string[];
  companySize?: string[];
  companyGrowthStage?: string[];
  educationLevel?: string[];
  fieldOfStudy?: string[];
  highlights?: string[];
  hasLinkedIn?: boolean;
  hasTwitter?: boolean;
  hasGitHub?: boolean;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  page?: number;
}

export interface FetchPeopleParams extends PaginationParams {
  filters?: FilterOptions;
  queryId?: string;
}

export interface FetchPeopleResponse {
  items: Person[];
  total?: number;
  has_more?: boolean;
  query_id?: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface PeopleList {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
  is_global?: boolean;
  people_count?: number;
}

export interface SearchResultsResponse {
  items: Person[];
  total?: number;
  has_more?: boolean;
}

// Error types
export class SpecterAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorCode?: string
  ) {
    super(message);
    this.name = "SpecterAPIError";
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

