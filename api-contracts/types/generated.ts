/**
 * GENERATED TYPES FOR SPECTER MOBILE V1
 * Derived from discovery samples
 */

export type EntityStatus = "viewed" | "liked" | "disliked" | null;

export interface TeamEntityStatus {
  status: string;
  updated_at: string;
  user: {
    first_name: string;
    last_name: string;
    avatar: string;
  };
}

export interface Experience {
  specter_company_id: string;
  title: string;
  domain: string;
  end_date: string | null;
  start_date: string;
  company_name: string;
  company_size?: string;
  industry?: string[];
}

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  linkedin_url: string;
  profile_image_url: string | null;
  tagline: string | null;
  location: string | null;
  region: string | null;
  seniority: string | null;
  years_of_experience: number | null;
  experience: Experience[];
  entityStatus?: {
    status: EntityStatus;
    updated_at: string;
  };
}

export interface Company {
  id: string;
  name: string;
  domain: string;
  logoUrl: string | null;
  industry: string[];
  hqRegion: string | null;
  descriptionShort: string | null;
  foundedYear: number | null;
  growthStage: string | null;
  totalFundingAmount: number | null;
  highlights: string[];
  entityStatus?: {
    status: EntityStatus;
    updated_at: string;
  };
  teamEntityStatuses?: TeamEntityStatus[];
}

export interface Investor {
  id: string;
  name: string;
  domain: string;
  logoUrl: string | null;
  HQRegion: string | null;
  HQLocation: string | null;
  rank: number;
  types: string[];
  nInvestments: number;
  nLeadInvestments: number;
  nExits: number;
  InvestorHighlights: Array<{ highlight: string; isNew: boolean }>;
}

export interface RevenueSignal extends Company {
  growth_metrics: {
    web_visits_1mo_ratio: number | null;
    web_visits_3mo_ratio: number | null;
    popularity_rank_1mo_diff: number | null;
    employee_count_1mo_ratio: number | null;
    linkedin_followers_1mo_ratio: number | null;
  };
}

export interface FundingRound {
  id: string;
  companyName: string;
  fundingType: string;
  announcedOn: string;
  raisedAmount: number | null;
  company: { id: string };
}

export interface Acquisition {
  id: string;
  acquirerName: string;
  acquiredName: string;
  acquisitionType: string;
  acquiredOn: string;
  acquisitionPrice: number | null;
  acquired: { id: string; name: string; domain: string };
}

export interface IPO {
  id: string;
  companyName: string;
  stockExchangeSymbol: string;
  stockSymbol: string;
  wentPublicOn: string;
  sharePrice: number | null;
  company: { id: string };
}

export interface PeopleList {
  id: string;
  name: string;
  type: "people" | "company";
  createdAt: string;
  modifiedAt: string;
  userId: string;
  _count: number;
  isPublic: boolean;
  isGlobalHub: boolean;
}

export interface PaginatedResponse<T> {
  page: number;
  items: T[];
  total?: number;
}

export interface SearchHistoryItem {
  id: string;
  name: string;
  domain?: string;
  logo_url?: string;
  short_description?: string;
  entityStatus: {
    product_id: string;
    product: "company" | "person";
    status: EntityStatus;
  };
}

export interface SearchCounts {
  companies: number;
  people: number;
  investors: number;
}
