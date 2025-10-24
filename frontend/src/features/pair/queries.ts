import type { HexString } from '@gear-js/api';
import { gql } from 'graphql-request';

export type Transaction = {
  amountA: string;
  amountB: string;
  amountOut: string;
  amountIn: string;
  id: string;
  liquidity: string;
  timestamp: string;
  tokenIn: string;
  tokenOut: string;
  type: string;
  user: string;
  pairId: HexString;
};

export type PairData = {
  id: HexString;
  token0: HexString;
  token1: HexString;
  token0Symbol: string | null;
  token1Symbol: string | null;
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  volumeUsd: number | string | null;
  volume1H: number | string | null;
  volume24H: number | string | null;
  volume7D: number | string | null;
  volume30D: number | string | null;
  volume1Y: number | string | null;
  tvlUsd: number | string | null;
  createdAt: string;
};

export type PairReserveData = {
  id: HexString;
  reserve0: string;
  reserve1: string;
};

export const TransactionsOrderBy = {
  ID_ASC: 'ID_ASC',
  ID_DESC: 'ID_DESC',
  TYPE_ASC: 'TYPE_ASC',
  TYPE_DESC: 'TYPE_DESC',
  USER_ASC: 'USER_ASC',
  USER_DESC: 'USER_DESC',
  TIMESTAMP_ASC: 'TIMESTAMP_ASC',
  TIMESTAMP_DESC: 'TIMESTAMP_DESC',
  BLOCK_NUMBER_ASC: 'BLOCK_NUMBER_ASC',
  BLOCK_NUMBER_DESC: 'BLOCK_NUMBER_DESC',
} as const;

export type TransactionsOrderBy = (typeof TransactionsOrderBy)[keyof typeof TransactionsOrderBy];

export const GetTransactionsQuery = gql`
  query GetTransactions($orderBy: [TransactionsOrderBy!], $filter: TransactionFilter, $first: Int, $offset: Int) {
    allTransactions(orderBy: $orderBy, filter: $filter, first: $first, offset: $offset) {
      nodes {
        amountA
        amountB
        amountOut
        amountIn
        id
        liquidity
        timestamp
        tokenIn
        tokenOut
        type
        user
        pairId
      }
      totalCount
    }
  }
`;

export const GetPairsQuery = gql`
  query GetPairs {
    allPairs {
      nodes {
        id
        token0
        token1
        token0Symbol
        token1Symbol
        reserve0
        reserve1
        totalSupply
        volumeUsd
        volume1H
        volume24H
        volume7D
        volume30D
        volume1Y
        tvlUsd
        createdAt
      }
    }
  }
`;

export const GetPairsReservesQuery = gql`
  query GetPairs {
    allPairs {
      nodes {
        id
        reserve0
        reserve1
      }
    }
  }
`;
