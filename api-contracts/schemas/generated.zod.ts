import { z } from 'zod';

export const EntityStatusSchema = z.enum(["viewed", "liked", "disliked"]).nullable();

export const TeamEntityStatusSchema = z.object({
  status: z.string(),
  updated_at: z.string(),
  user: z.object({
    first_name: z.string(),
    last_name: z.string(),
    avatar: z.string().url(),
  }),
});

export const ExperienceSchema = z.object({
  specter_company_id: z.string(),
  title: z.string(),
  domain: z.string(),
  end_date: z.string().nullable(),
  start_date: z.string(),
  company_name: z.string(),
  company_size: z.string().optional(),
  industry: z.array(z.string()).optional(),
});

export const PersonSchema = z.object({
  id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  full_name: z.string(),
  linkedin_url: z.string().url(),
  profile_image_url: z.string().url().nullable(),
  tagline: z.string().nullable(),
  location: z.string().nullable(),
  region: z.string().nullable(),
  seniority: z.string().nullable(),
  years_of_experience: z.number().nullable(),
  experience: z.array(ExperienceSchema),
  entityStatus: z.object({
    status: EntityStatusSchema,
    updated_at: z.string(),
  }).optional(),
});

export const CompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  logoUrl: z.string().url().nullable(),
  industry: z.array(z.string()),
  hqRegion: z.string().nullable(),
  descriptionShort: z.string().nullable(),
  foundedYear: z.number().nullable(),
  growthStage: z.string().nullable(),
  totalFundingAmount: z.number().nullable(),
  highlights: z.array(z.string()),
  entityStatus: z.object({
    status: EntityStatusSchema,
    updated_at: z.string(),
  }).optional(),
  teamEntityStatuses: z.array(TeamEntityStatusSchema).optional(),
});

export const InvestorSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  logoUrl: z.string().url().nullable(),
  HQRegion: z.string().nullable(),
  HQLocation: z.string().nullable(),
  rank: z.number(),
  types: z.array(z.string()),
  nInvestments: z.number(),
  nLeadInvestments: z.number(),
  nExits: z.number(),
  InvestorHighlights: z.array(z.object({
    highlight: z.string(),
    isNew: z.boolean(),
  })),
});

export const RevenueSignalSchema = CompanySchema.extend({
  growth_metrics: z.object({
    web_visits_1mo_ratio: z.number().nullable(),
    web_visits_3mo_ratio: z.number().nullable(),
    popularity_rank_1mo_diff: z.number().nullable(),
    employee_count_1mo_ratio: z.number().nullable(),
    linkedin_followers_1mo_ratio: z.number().nullable(),
  }),
});

export const FundingRoundSchema = z.object({
  id: z.string(),
  companyName: z.string(),
  fundingType: z.string(),
  announcedOn: z.string(),
  raisedAmount: z.number().nullable(),
  company: z.object({ id: z.string() }),
});

export const AcquisitionSchema = z.object({
  id: z.string(),
  acquirerName: z.string(),
  acquiredName: z.string(),
  acquisitionType: z.string(),
  acquiredOn: z.string(),
  acquisitionPrice: z.number().nullable(),
  acquired: z.object({ id: z.string(), name: z.string(), domain: z.string() }),
});

export const IPOSchema = z.object({
  id: z.string(),
  companyName: z.string(),
  stockExchangeSymbol: z.string(),
  stockSymbol: z.string(),
  wentPublicOn: z.string(),
  sharePrice: z.number().nullable(),
  company: z.object({ id: z.string() }),
});

export const PeopleListSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["people", "company"]),
  createdAt: z.string(),
  modifiedAt: z.string(),
  userId: z.string(),
  _count: z.number(),
  isPublic: z.boolean(),
  isGlobalHub: z.boolean(),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(schema: T) => z.object({
  page: z.number(),
  items: z.array(schema),
  total: z.number().optional(),
});

export const SearchHistoryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string().optional(),
  logo_url: z.string().url().optional(),
  short_description: z.string().optional(),
  entityStatus: z.object({
    product_id: z.string(),
    product: z.enum(["company", "person"]),
    status: EntityStatusSchema,
  }),
});

export const SearchCountsSchema = z.object({
  companies: z.number(),
  people: z.number(),
  investors: z.number(),
});
