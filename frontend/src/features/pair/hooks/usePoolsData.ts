import { useAccount } from '@gear-js/react-hooks';
import { useMemo } from 'react';

import { LOGO_URI_BY_SYMBOL } from '@/consts';
import { usePairsTokens } from '@/features/pair/hooks';
import { GetPairsQuery, type PairData } from '@/features/pair/queries';
import { useGraphQLQuery } from '@/hooks/useGraphQLQuery';
import { toNumber } from '@/utils';

export type PoolData = {
  id: string;
  name: string;
  token0: { symbol: string; logoURI: string };
  token1: { symbol: string; logoURI: string };
  feeTier: number;
  tvl: number;
  volume1h: number;
  volume1d: number;
  volume1w: number;
  volume1m: number;
  volume1y: number;
  network: string;
  isMyPool: boolean;
};

export type PoolsMetrics = {
  totalTVL: number;
  total24hVolume: number;
  tvlChange24h: number; // Percentage change
  volumeChange24h: number; // Percentage change
};

export const usePoolsData = () => {
  const { account } = useAccount();
  const { pairsTokens } = usePairsTokens();

  const {
    data: pairsResult,
    isFetching: isPairsFetching,
    error: pairsError,
  } = useGraphQLQuery<{
    allPairs: {
      nodes: PairData[];
    };
  }>(['pairs'], GetPairsQuery);

  const { poolsData, metrics } = useMemo(() => {
    const pairs = pairsResult?.allPairs?.nodes || [];
    if (!pairs.length || !pairsTokens) {
      return {
        poolsData: [],
        metrics: {
          totalTVL: 0,
          total24hVolume: 0,
          tvlChange24h: 0,
          volumeChange24h: 0,
        },
      };
    }

    let totalTVL = 0;
    let total24hVolume = 0;

    const _poolsData: PoolData[] = pairs.map((pair) => {
      // Find matching tokens from pairsTokens
      const matchingPair = pairsTokens.find((p) => p.pairAddress === pair.id);

      const token0Symbol = pair.token0Symbol || 'Unknown';
      const token1Symbol = pair.token1Symbol || 'Unknown';

      const tvl = toNumber(pair.tvlUsd);
      const volume24h = toNumber(pair.volume24H);

      // Add to totals
      totalTVL += tvl;
      total24hVolume += volume24h;

      // Check if it's user's pool (simplified - checking if user has any balance)
      const isMyPool = Boolean(
        account?.decodedAddress &&
          ((matchingPair?.token0?.balance && matchingPair.token0.balance > 0n) ||
            (matchingPair?.token1?.balance && matchingPair.token1.balance > 0n)),
      );

      const poolData: PoolData = {
        id: pair.id,
        name: `${token0Symbol}/${token1Symbol}`,
        token0: {
          symbol: token0Symbol,
          logoURI: LOGO_URI_BY_SYMBOL[token0Symbol] || '/placeholder.svg',
        },
        token1: {
          symbol: token1Symbol,
          logoURI: LOGO_URI_BY_SYMBOL[token1Symbol] || '/placeholder.svg',
        },
        feeTier: 0.3, // Default fee tier
        tvl,
        volume1h: toNumber(pair.volume1H),
        volume1d: toNumber(pair.volume24H),
        volume1w: toNumber(pair.volume7D),
        volume1m: toNumber(pair.volume30D),
        volume1y: toNumber(pair.volume1Y),
        network: 'Vara Network',
        isMyPool,
      };

      return poolData;
    });

    const _metrics: PoolsMetrics = {
      totalTVL,
      total24hVolume,
      tvlChange24h: 0, // TODO: Placeholder - should be calculated from historical data
      volumeChange24h: 0, // TODO: Placeholder - should be calculated from historical data
    };

    return { poolsData: _poolsData, metrics: _metrics };
  }, [pairsResult?.allPairs?.nodes, pairsTokens, account?.decodedAddress]);

  return {
    poolsData,
    metrics,
    isFetching: isPairsFetching,
    error: pairsError,
  };
};
