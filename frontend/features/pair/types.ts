import { HexString } from '@gear-js/api';

interface Token {
  symbol: string;
  name: string;
  address: HexString;
  decimals: number;
  logoURI: string;
  balance?: string;
  network?: string;
}

interface Network {
  id: string;
  name: string;
  chainId: number;
  logoURI: string;
  tokens: Token[];
}

export type { Token, Network };
