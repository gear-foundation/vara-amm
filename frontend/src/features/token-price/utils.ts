import { LOGO_URI_BY_SYMBOL } from '@/consts';
import { formatCurrency } from '@/utils';

import { TOKEN_ID } from './api';
import type { TokenData } from './queries';

const getTokenId = (symbol: string) => {
  const lowerCaseSymbol = symbol?.toLowerCase();

  if (lowerCaseSymbol?.includes('vara')) return TOKEN_ID.VARA;
  if (lowerCaseSymbol?.includes('eth')) return TOKEN_ID.ETH;
  if (lowerCaseSymbol?.includes('usdc')) return TOKEN_ID.USDC;
  if (lowerCaseSymbol?.includes('usdt')) return TOKEN_ID.USDT;
  if (lowerCaseSymbol?.includes('btc')) return TOKEN_ID.BTC;

  throw new Error(`Token not found: ${symbol}`);
};

// Helper functions for formatting data
export function formatTokenPrice(price?: number | null): string {
  if (!price) return '$0.00';

  if (price < 0.01) {
    return `$${price.toFixed(6)}`;
  } else if (price < 1) {
    return `$${price.toFixed(4)}`;
  } else {
    return `$${price.toFixed(2)}`;
  }
}

export function formatMarketCap(fdv?: number | null): string {
  if (!fdv) return 'N/A';
  return formatCurrency(fdv);
}

export function formatPriceChange(change?: number | null): {
  value: string;
  isPositive: boolean;
} {
  if (change === undefined || change === null) {
    return { value: '0.00%', isPositive: true };
  }

  return {
    value: `${Math.abs(change).toFixed(2)}%`,
    isPositive: change >= 0,
  };
}

// Transform indexed data to frontend format
export function transformTokenDataForTable(tokens: TokenData[]): Array<{
  name: string;
  symbol: string;
  logoURI: string;
  price: number;
  change1h: number;
  change1d: number;
  fdv: number;
  volume1h: number;
  volume1d: number;
  volume1w: number;
  volume1m: number;
  volume1y: number;
  network: string;
}> {
  const toNumber = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    return typeof value === 'string' ? parseFloat(value) || 0 : Number(value) || 0;
  };

  return tokens.map((token) => {
    const latestSnapshot = token.tokenPriceSnapshotsByTokenId?.nodes[0];

    return {
      name: token.name || token.symbol,
      symbol: token.symbol,
      logoURI: LOGO_URI_BY_SYMBOL[token.symbol] || '/placeholder.svg',
      price: toNumber(token.priceUsd),
      change1h: toNumber(latestSnapshot?.change1H),
      change1d: toNumber(latestSnapshot?.change24H),
      fdv: toNumber(token.fdv),
      volume1h: toNumber(latestSnapshot?.volume1H),
      volume1d: toNumber(latestSnapshot?.volume24H),
      volume1w: toNumber(latestSnapshot?.volume7D),
      volume1m: toNumber(latestSnapshot?.volume30D),
      volume1y: toNumber(latestSnapshot?.volume1Y),
      network: 'Vara Network', // Default network
    };
  });
}

export { getTokenId };
