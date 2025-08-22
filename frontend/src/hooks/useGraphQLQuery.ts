import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';

import { graphqlClient } from '@/lib/graphql-client';

export function useGraphQLQuery<TData = unknown, TVariables extends object = object>(
  queryKey: unknown[],
  query: string,
  variables?: TVariables,
  options?: Omit<UseQueryOptions<TData, Error>, 'queryKey' | 'queryFn'>,
): UseQueryResult<TData, Error> {
  return useQuery<TData, Error>({
    queryKey: [...queryKey, variables],
    queryFn: () => {
      return graphqlClient.request<TData>(query, variables);
    },
    ...options,
  });
}
