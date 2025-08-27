import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { graphqlClient } from '../../lib/graphql-client';
import { GetPairsQuery, type PairData } from '../pair/queries';

import {
  GET_TOKENS_WITH_PRICES,
  GET_TOKEN_PRICE_HISTORY,
  GET_TOKEN_BY_ADDRESS,
  GET_TOKENS_BY_VOLUME,
  type GetTokensWithPricesResponse,
  type GetTokenPriceHistoryResponse,
  type GetTokenByAddressResponse,
} from './queries';

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

export interface UseTokenPriceHistoryOptions {
  tokenId: string;
  first?: number;
  timeframe?: '1h' | '24h' | '7d' | '30d' | '1y';
}

export function useTokenPriceHistory(
  options: UseTokenPriceHistoryOptions,
  queryOptions?: Partial<UseQueryOptions<GetTokenPriceHistoryResponse>>,
) {
  const { tokenId, first = 100, timeframe = '24h' } = options;

  return useQuery({
    queryKey: ['token-price-history', tokenId, timeframe, first],
    queryFn: async () => {
      const now = new Date();
      let startTime: Date;

      switch (timeframe) {
        case '1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          startTime = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      return graphqlClient.request<GetTokenPriceHistoryResponse>(GET_TOKEN_PRICE_HISTORY, {
        tokenId,
        first,
        orderBy: ['TIMESTAMP_DESC'],
        filter: {
          timestamp: { greaterThanOrEqualTo: startTime.toISOString() },
        },
      });
    },
    enabled: !!tokenId,
    ...queryOptions,
  });
}

export function useTokenByAddress(address: string, queryOptions?: Partial<UseQueryOptions<GetTokenByAddressResponse>>) {
  return useQuery({
    queryKey: ['token-by-address', address],
    queryFn: async () => {
      return graphqlClient.request<GetTokenByAddressResponse>(GET_TOKEN_BY_ADDRESS, { id: address });
    },
    enabled: !!address,
    ...queryOptions,
  });
}

export interface UseTokensByVolumeOptions {
  first?: number;
  timeframe?: '1h' | '24h' | '7d' | '30d';
}

export function useTokensByVolume(
  options: UseTokensByVolumeOptions = {},
  queryOptions?: Partial<UseQueryOptions<GetTokensWithPricesResponse>>,
) {
  return useQuery({
    queryKey: ['tokens-by-volume', options],
    queryFn: async () => {
      return graphqlClient.request<GetTokensWithPricesResponse>(GET_TOKENS_BY_VOLUME, options);
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
