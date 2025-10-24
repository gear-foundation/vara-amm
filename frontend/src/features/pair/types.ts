import type { HexString } from '@gear-js/api';

import { Token } from '@/types';

interface Network {
  id: string;
  name: string;
  chainId: number;
  logoURI: string;
  tokens: Token[];
}

type PairsArray = { token0: Token; token1: Token; pairAddress: HexString }[];

// Optimized data structures for better performance
interface PairInfo {
  token0Address: HexString;
  token1Address: HexString;
  pairAddress: HexString;
  index: number;
}

interface SelectedPairResult {
  selectedPair: { token0: Token; token1: Token; pairAddress: HexString };
  isPairReverse: boolean;
  pairIndex: number;
}

type TokenMap = Map<HexString, Token>;
type PairMap = Map<string, PairInfo>; // key: "token0Address:token1Address" (sorted)
type PairByAddressMap = Map<HexString, PairInfo>; // key: pairAddress

interface PairsTokens {
  tokens: TokenMap;
  pairs: PairMap;
  pairsByAddress: PairByAddressMap;
  pairsArray: PairsArray; // Keep for backward compatibility
  tokensFdvMap: Map<HexString, number>;
}

export type {
  Token,
  Network,
  PairsArray,
  PairInfo,
  SelectedPairResult,
  TokenMap,
  PairMap,
  PairByAddressMap,
  PairsTokens,
};
