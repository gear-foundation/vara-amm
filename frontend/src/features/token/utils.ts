import { LOGO_URI_BY_SYMBOL } from '@/consts';
import { toNumber } from '@/utils';

import type { PairData } from '../pair';

import type { TokenData } from './queries';

function transformTokenDataForTable(
  tokens: TokenData[],
  pairs: PairData[],
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
  if (pairs && pairs.length > 0) {
    return [];
  }

  return tokens.map((token) => {
    const latestSnapshot = token.tokenPriceSnapshotsByTokenId?.nodes[0];

    const calculatedVolumes = calculateTokenTradingVolumeBySymbol(token.symbol, pairs);

    return {
      name: token.name || token.symbol,
      symbol: token.symbol,
      logoURI: LOGO_URI_BY_SYMBOL[token.symbol] || '/placeholder.svg',
      price: toNumber(latestSnapshot?.priceUsd) || 0,
      change1h: toNumber(latestSnapshot?.change1H) || 0,
      change1d: toNumber(latestSnapshot?.change24H) || 0,
      fdv: toNumber(latestSnapshot?.fdv) || 0,
      volume1h: calculatedVolumes.volume1h,
      volume1d: calculatedVolumes.volume24h,
      volume1w: calculatedVolumes.volume7d,
      volume1m: calculatedVolumes.volume30d,
      volume1y: calculatedVolumes.volume1y,
      network: 'Vara Network', // Default network
    };
  });
}

function calculateTokenTradingVolumeBySymbol(
  tokenSymbol: string,
  pairs: PairData[],
): {
  volume1h: number;
  volume24h: number;
  volume7d: number;
  volume30d: number;
  volume1y: number;
} {
  if (!pairs || pairs.length === 0) {
    return {
      volume1h: 0,
      volume24h: 0,
      volume7d: 0,
      volume30d: 0,
      volume1y: 0,
    };
  }

  const relevantPairs = pairs.filter((pair) => pair.token0Symbol === tokenSymbol || pair.token1Symbol === tokenSymbol);

  return {
    volume1h: relevantPairs.reduce((sum, pair) => sum + (toNumber(pair.volume1H) || 0), 0),
    volume24h: relevantPairs.reduce((sum, pair) => sum + (toNumber(pair.volume24H) || 0), 0),
    volume7d: relevantPairs.reduce((sum, pair) => sum + (toNumber(pair.volume7D) || 0), 0),
    volume30d: relevantPairs.reduce((sum, pair) => sum + (toNumber(pair.volume30D) || 0), 0),
    volume1y: relevantPairs.reduce((sum, pair) => sum + (toNumber(pair.volume1Y) || 0), 0),
  };
}

export { transformTokenDataForTable };
