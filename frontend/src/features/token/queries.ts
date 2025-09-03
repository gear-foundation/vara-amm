import { gql } from 'graphql-request';

export const GET_TOKENS_WITH_PRICES = gql`
  query GetTokensWithPrices($first: Int, $orderBy: [TokensOrderBy!], $filter: TokenFilter) {
    allTokens(first: $first, orderBy: $orderBy, filter: $filter) {
      nodes {
        id
        symbol
        name
        decimals
        createdAt
        updatedAt
        tokenPriceSnapshotsByTokenId(first: 1, orderBy: [TIMESTAMP_DESC]) {
          nodes {
            priceUsd
            fdv
            change1H
            change24H
            timestamp
          }
        }
      }
    }
  }
`;

// Types for the responses
export interface TokenPriceSnapshot {
  id: string;
  priceUsd: number | null;
  fdv?: number | null;
  change1H?: number | null;
  change24H?: number | null;
  timestamp: string;
  blockNumber: string;
}

export interface TokenData {
  id: string;
  symbol: string;
  name?: string | null;
  decimals: number;
  totalSupply?: string | null;
  createdAt: string;
  updatedAt: string;
  tokenPriceSnapshotsByTokenId?: {
    nodes: TokenPriceSnapshot[];
  };
}

export interface GetTokensWithPricesResponse {
  allTokens: {
    nodes: TokenData[];
  };
}
