import { LOGO_URI_BY_SYMBOL } from '@/consts';
import { formatCurrency, toNumber } from '@/utils';

import type { PairData } from '../pair';

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
export function transformTokenDataForTable(
  tokens: TokenData[],
  pairs?: PairData[],
): Array<{
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
  return tokens.map((token) => {
    const latestSnapshot = token.tokenPriceSnapshotsByTokenId?.nodes[0];

    // Calculate volumes from pairs if available, otherwise use snapshot data
    let volumes = {
      volume1h: toNumber(latestSnapshot?.volume1H),
      volume1d: toNumber(latestSnapshot?.volume24H),
      volume1w: toNumber(latestSnapshot?.volume7D),
      volume1m: toNumber(latestSnapshot?.volume30D),
      volume1y: toNumber(latestSnapshot?.volume1Y),
    };

    if (pairs && pairs.length > 0) {
      const calculatedVolumes = calculateTokenTradingVolumeBySymbol(token.symbol, pairs);
      volumes = {
        volume1h: calculatedVolumes.volume1h,
        volume1d: calculatedVolumes.volume24h,
        volume1w: calculatedVolumes.volume7d,
        volume1m: calculatedVolumes.volume30d,
        volume1y: calculatedVolumes.volume1y,
      };
    }

    return {
      name: token.name || token.symbol,
      symbol: token.symbol,
      logoURI: LOGO_URI_BY_SYMBOL[token.symbol] || '/placeholder.svg',
      price: toNumber(token.priceUsd),
      change1h: toNumber(latestSnapshot?.change1H),
      change1d: toNumber(latestSnapshot?.change24H),
      fdv: toNumber(token.fdv),
      ...volumes,
      network: 'Vara Network', // Default network
    };
  });
}

/**
 * Calculate token trading volume by symbol from pairs data
 */
export function calculateTokenTradingVolumeBySymbol(
  tokenSymbol: string,
  pairs: PairData[],
): {
  volume1h: number;
  volume24h: number;
  volume7d: number;
  volume30d: number;
  volume1y: number;
} {
  const relevantPairs = pairs.filter((pair) => pair.token0Symbol === tokenSymbol || pair.token1Symbol === tokenSymbol);

  return {
    volume1h: relevantPairs.reduce((sum, pair) => sum + toNumber(pair.volume1H), 0),
    volume24h: relevantPairs.reduce((sum, pair) => sum + toNumber(pair.volume24H), 0),
    volume7d: relevantPairs.reduce((sum, pair) => sum + toNumber(pair.volume7D), 0),
    volume30d: relevantPairs.reduce((sum, pair) => sum + toNumber(pair.volume30D), 0),
    volume1y: relevantPairs.reduce((sum, pair) => sum + toNumber(pair.volume1Y), 0),
  };
}

export { getTokenId };
