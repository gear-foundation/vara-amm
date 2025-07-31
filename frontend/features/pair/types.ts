import { HexString } from '@gear-js/api';

interface Token {
  symbol: string;
  name: string;
  address: HexString;
  decimals: number;
  logoURI: string;
  balance?: bigint;
  network?: string;
}

interface Network {
  id: string;
  name: string;
  chainId: number;
  logoURI: string;
  tokens: Token[];
}

type PairsTokens = { token0: Token; token1: Token; pairAddress: HexString }[];

export type { Token, Network, PairsTokens };
