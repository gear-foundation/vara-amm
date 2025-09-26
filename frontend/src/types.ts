import { HexString } from '@gear-js/api';

type Token = {
  symbol: string;
  displaySymbol: string;
  name: string;
  address: HexString;
  decimals: number;
  logoURI: string;
  balance?: bigint;
  network?: string;
  isVaraNative?: boolean;
  isVerified?: boolean;
};

export type { Token };
