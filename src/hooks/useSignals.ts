import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { specterPublicAPI } from '../api/public-client/client';
import { useClerkToken } from './useClerkToken';

export const SIGNAL_KEYS = {
  COMPANY: 'signals_company',
  PEOPLE: 'signals_people',
  TALENT: 'signals_talent',
  INVESTORS: 'signals_investors',
  REVENUE: 'signals_revenue',
  STRATEGIC: 'signals_strategic',
  FUNDING: 'signals_funding',
  ACQUISITION: 'signals_acquisition',
  IPO: 'signals_ipo',
} as const;

interface SignalFilters {
  search?: string;
  industry?: string[];
  location?: string[];
  seniority?: string[];
  department?: string[];
}

function getStableItemId(item: any): string | null {
  if (!item || typeof item !== "object") return null;
  const candidate =
    item.id ??
    item.company_id ??
    item.person_id ??
    item.investor_id ??
    item.transaction_id ??
    item.deal_id ??
    item.signal_id ??
    item.uuid;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

export function useSignals(type: keyof typeof SIGNAL_KEYS, filters: SignalFilters = {}) {
  const { getAuthToken } = useClerkToken();

  return useInfiniteQuery({
    queryKey: [SIGNAL_KEYS[type], filters],
    // Signals endpoints behave like 1-based paging in practice (page=1 is the first page).
    queryFn: async ({ pageParam = 1 }) => {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const params = { ...filters, page: pageParam, limit: 30 };

      switch (type) {
        case 'COMPANY':
          return specterPublicAPI.companies.getCompanySignals(token, params);
        case 'PEOPLE':
          return specterPublicAPI.people.getPeopleSignals(token, params);
        case 'TALENT':
          return specterPublicAPI.people.getTalentSignals(token, params);
        case 'INVESTORS':
          return specterPublicAPI.investors.getSignals(token, params);
        case 'REVENUE':
          return specterPublicAPI.companies.getRevenueSignals(token, params);
        case 'STRATEGIC':
          return specterPublicAPI.transactions.getStrategicSignals(token, params);
        case 'FUNDING':
          return specterPublicAPI.transactions.getFundingSignals(token, params);
        case 'ACQUISITION':
          return specterPublicAPI.transactions.getAcquisitionSignals(token, params);
        case 'IPO':
          return specterPublicAPI.transactions.getIPOSignals(token, params);
        default:
          throw new Error(`Unknown signal type: ${type}`);
      }
    },
    initialPageParam: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    select: (data) => {
      const seen = new Set<string>();
      const pages = data.pages.map((page: any) => {
        if (!page || !Array.isArray(page.items)) return page;
        const dedupedItems = page.items.filter((item: any) => {
          const id = getStableItemId(item);
          if (!id) return true;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        return { ...page, items: dedupedItems };
      });
      return { ...data, pages };
    },
    getNextPageParam: (lastPage: any, allPages: any[]) => {
      const LIMIT = 30;
      const currentItems = lastPage?.items?.length || 0;
      
      if (currentItems < LIMIT) return undefined;
      // Pages are 1-based; after the first page (1), next should be 2, etc.
      return allPages.length + 1;
    },
  });
}

export function useSignalCount(type: keyof typeof SIGNAL_KEYS, filters: SignalFilters = {}) {
  const { getAuthToken } = useClerkToken();

  return useQuery({
    queryKey: [SIGNAL_KEYS[type], 'count', filters],
    staleTime: 10 * 60 * 1000, // 10 minutes
    queryFn: async () => {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      switch (type) {
        case 'COMPANY':
          return specterPublicAPI.companies.getCompanySignalsCount(token, filters);
        case 'PEOPLE':
          return specterPublicAPI.people.getPeopleSignalsCount(token, filters);
        case 'TALENT':
          return specterPublicAPI.people.getTalentSignalsCount(token);
        case 'INVESTORS':
          return specterPublicAPI.investors.getCount(token);
        case 'REVENUE':
          return specterPublicAPI.companies.getRevenueSignalsCount(token);
        default:
          return { count: 0 };
      }
    },
  });
}
