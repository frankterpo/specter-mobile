import { useMutation, useQueryClient } from '@tanstack/react-query';
import { specterPublicAPI } from '../api/public-client/client';
import { useClerkToken } from './useClerkToken';
import { SIGNAL_KEYS } from './useSignals';

export type EntityStatus = 'liked' | 'disliked' | 'viewed';
export type EntityType = 'people' | 'company' | 'investors';

export function useEntityStatusMutation() {
  const { getAuthToken } = useClerkToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, type, status = 'liked' }: { id: string; type: EntityType; status?: EntityStatus }) => {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      return specterPublicAPI.updateStatus(type, id, status, token);
    },
    onMutate: async ({ id, type, status = 'liked' }) => {
      // Choose which queries to optimistically update
      const signalKey = type === 'people' ? SIGNAL_KEYS.PEOPLE : (type === 'company' ? SIGNAL_KEYS.COMPANY : SIGNAL_KEYS.INVESTORS);
      
      await queryClient.cancelQueries({ queryKey: [signalKey] });
      const previousData = queryClient.getQueryData([signalKey]);

      queryClient.setQueriesData({ queryKey: [signalKey] }, (old: any) => {
        if (!old || !old.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((item: any) => {
              const itemId = item.id || item.company_id || item.person_id || item.investor_id;
              if (itemId === id) {
                return { 
                  ...item, 
                  entityStatus: { 
                    status, 
                    updated_at: new Date().toISOString() 
                  } 
                };
              }
              return item;
            })
          }))
        };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        const signalKey = variables.type === 'people' ? SIGNAL_KEYS.PEOPLE : (variables.type === 'company' ? SIGNAL_KEYS.COMPANY : SIGNAL_KEYS.INVESTORS);
        queryClient.setQueryData([signalKey], context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      const signalKey = variables.type === 'people' ? SIGNAL_KEYS.PEOPLE : (variables.type === 'company' ? SIGNAL_KEYS.COMPANY : SIGNAL_KEYS.INVESTORS);
      queryClient.invalidateQueries({ queryKey: [signalKey] });
      // Also invalidate detail queries if they exist
      queryClient.invalidateQueries({ queryKey: [variables.type.slice(0, -1), variables.id] });
    },
  });
}

// Keep useLikeMutation for backward compatibility but redirect to useEntityStatusMutation
export function useLikeMutation() {
  const entityMutation = useEntityStatusMutation();
  
  return {
    ...entityMutation,
    mutate: (variables: { id: string; type: EntityType; status?: EntityStatus }) => 
      entityMutation.mutate(variables)
  };
}
