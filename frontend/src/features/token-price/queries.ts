import { gql } from 'graphql-request';

export const GET_TOKENS_WITH_PRICES = gql`
  query GetTokensWithPrices($first: Int, $orderBy: [TokensOrderBy!], $filter: TokenFilter) {
    allTokens(first: $first, orderBy: $orderBy, filter: $filter) {
      nodes {
        id
        symbol
        name
        decimals
        priceUsd
        volume24H
        volume7D
        volume30D
        fdv
        createdAt
        updatedAt
        tokenPriceSnapshotsByTokenId(first: 1, orderBy: [TIMESTAMP_DESC]) {
          nodes {
            priceUsd
            change1H
            change24H
            change7D
            change30D
            volume1H
            volume24H
            volume7D
            volume30D
            volume1Y
            timestamp
          }
        }
      }
    }
  }
`;

export const GET_TOKEN_PRICE_HISTORY = gql`
  query GetTokenPriceHistory(
    $tokenId: String!
    $first: Int
    $orderBy: [TokenPriceSnapshotsOrderBy!]
    $filter: TokenPriceSnapshotFilter
  ) {
    tokenPriceSnapshots(
      first: $first
      orderBy: $orderBy
      filter: { and: [{ tokenId: { equalTo: $tokenId } }, $filter] }
    ) {
      nodes {
        id
        priceUsd
        volume1H
        volume24H
        volume7D
        volume30D
        volume1Y
        change1H
        change24H
        change7D
        change30D
        timestamp
        blockNumber
      }
    }
  }
`;

export const GET_TOKEN_BY_ADDRESS = gql`
  query GetTokenByAddress($id: String!) {
    token(id: $id) {
      id
      symbol
      name
      decimals
      totalSupply
      priceUsd
      volume24H
      volume7D
      volume30D
      fdv
      createdAt
      updatedAt
      tokenPriceSnapshotsByTokenId(first: 24, orderBy: [TIMESTAMP_DESC]) {
        nodes {
          priceUsd
          change1H
          change24H
          change7D
          change30D
          volume1H
          volume24H
          volume7D
          volume30D
          volume1Y
          timestamp
          blockNumber
        }
      }
    }
  }
`;

export const GET_TOKENS_BY_VOLUME = gql`
  query GetTokensByVolume($first: Int = 50, $timeframe: String = "24h") {
    allTokens(first: $first, orderBy: [VOLUME24H_DESC], filter: { volume24H: { greaterThan: 0 } }) {
      nodes {
        id
        symbol
        name
        decimals
        priceUsd
        volume24H
        volume7D
        volume30D
        fdv
        tokenPriceSnapshotsByTokenId(first: 1, orderBy: [TIMESTAMP_DESC]) {
          nodes {
            change1H
            change24H
            change7D
            change30D
            volume1H
            volume24H
            volume7D
            volume30D
            volume1Y
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
  volume1H?: number | null;
  volume24H?: number | null;
  volume7D?: number | null;
  volume30D?: number | null;
  volume1Y?: number | null;
  change1H?: number | null;
  change24H?: number | null;
  change7D?: number | null;
  change30D?: number | null;
  timestamp: string;
  blockNumber: string;
}

export interface TokenData {
  id: string;
  symbol: string;
  name?: string | null;
  decimals: number;
  totalSupply?: string | null;
  priceUsd?: number | null;
  volume24H?: number | null;
  volume7D?: number | null;
  volume30D?: number | null;
  fdv?: number | null;
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

export interface GetTokenPriceHistoryResponse {
  tokenPriceSnapshots: {
    nodes: TokenPriceSnapshot[];
  };
}

export interface GetTokenByAddressResponse {
  token: TokenData | null;
}
