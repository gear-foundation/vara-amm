import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { graphqlClient } from '../../lib/graphql-client';
import { GetPairsQuery, type PairData } from '../pair/queries';

import { GET_TOKENS_WITH_PRICES, type GetTokensWithPricesResponse } from './queries';

export interface UseTokensWithPricesOptions {
  first?: number;
  filter?: string;
}

export function useTokensWithPrices(
  options: UseTokensWithPricesOptions = {},
  queryOptions?: Partial<UseQueryOptions<GetTokensWithPricesResponse>>,
) {
  return useQuery({
    queryKey: ['tokens-with-prices', options.first, options.filter],
    queryFn: async () => {
      const { first = 50, filter } = options;

      return graphqlClient.request<GetTokensWithPricesResponse>(GET_TOKENS_WITH_PRICES, {
        first,
        orderBy: ['CREATED_AT_DESC'], // Simple default ordering by creation time
        filter,
      });
    },
    ...queryOptions,
  });
}

/**
 * Hook to get pairs data for volume calculations
 */
export function usePairsData(queryOptions?: Partial<UseQueryOptions<{ allPairs: { nodes: PairData[] } }>>) {
  return useQuery({
    queryKey: ['pairs-data'],
    queryFn: async () => {
      return graphqlClient.request<{ allPairs: { nodes: PairData[] } }>(GetPairsQuery);
    },
    ...queryOptions,
  });
}
