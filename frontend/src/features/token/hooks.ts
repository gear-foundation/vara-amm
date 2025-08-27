import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { graphqlClient } from '../../lib/graphql-client';
import { GetPairsQuery, type PairData } from '../pair/queries';

import { GET_TOKENS_WITH_PRICES, type GetTokensWithPricesResponse } from './queries';

export interface UseTokensWithPricesOptions {
  first?: number;
  orderBy?: string;
  filter?: string;
}

export function useTokensWithPrices(
  options: UseTokensWithPricesOptions = {},
  queryOptions?: Partial<UseQueryOptions<GetTokensWithPricesResponse>>,
) {
  return useQuery({
    queryKey: ['tokens-with-prices', options],
    queryFn: async () => {
      const { first = 50, orderBy, filter } = options;
      const orderByInput = orderBy
        ? [`${orderBy.replace('24h', '24H').replace('7d', '7D').replace('30d', '30D').toUpperCase()}_DESC`]
        : ['VOLUME24H_DESC'];

      return graphqlClient.request<GetTokensWithPricesResponse>(GET_TOKENS_WITH_PRICES, {
        first,
        orderBy: orderByInput,
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
