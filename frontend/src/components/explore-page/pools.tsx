import { useAccount } from '@gear-js/react-hooks';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type React from 'react';
import { useState, useMemo } from 'react';

import { LOGO_URI_BY_SYMBOL } from '@/consts';
import { usePairsTokens } from '@/features/pair/hooks/usePairsTokens';
import { GetPairsQuery, type PairData } from '@/features/pair/queries';
import { getTokenId } from '@/features/token-price';
import { useTokenPrices } from '@/features/token-price/api';
import { useGraphQLQuery } from '@/hooks/useGraphQLQuery';

type PoolData = {
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

const usePoolsData = () => {
  const { account } = useAccount();
  const { pairsTokens } = usePairsTokens();
  const { data: tokenPrices } = useTokenPrices();
  console.log('🚀 ~ usePoolsData ~ tokenPrices:', tokenPrices);

  const {
    data: pairsResult,
    isFetching: isPairsFetching,
    error: pairsError,
  } = useGraphQLQuery<{
    allPairs: {
      nodes: PairData[];
    };
  }>(['pairs'], GetPairsQuery);

  const poolsData = useMemo(() => {
    const pairs = pairsResult?.allPairs?.nodes || [];
    if (!pairs.length || !pairsTokens) return [];

    return pairs.map((pair) => {
      // Find matching tokens from pairsTokens
      const matchingPair = pairsTokens.find((p) => p.pairAddress === pair.id);

      const token0Symbol = pair.token0Symbol || matchingPair?.token0?.symbol || 'Unknown';
      const token1Symbol = pair.token1Symbol || matchingPair?.token1?.symbol || 'Unknown';

      // Calculate TVL using reserves and mock prices
      const reserve0 = BigInt(pair.reserve0);
      const reserve1 = BigInt(pair.reserve1);

      const token0Decimals = matchingPair?.token0?.decimals || 18;
      const token1Decimals = matchingPair?.token1?.decimals || 18;

      const token0price = tokenPrices?.[getTokenId(token0Symbol)]?.usd || 0;
      const token1price = tokenPrices?.[getTokenId(token1Symbol)]?.usd || 0;

      const reserve0USD = (Number(reserve0) / Math.pow(10, token0Decimals)) * token0price;
      const reserve1USD = (Number(reserve1) / Math.pow(10, token1Decimals)) * token1price;

      const tvl = reserve0USD + reserve1USD;

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
        // Mock volume data for now
        volume1h: Math.random() * tvl * 0.1,
        volume1d: Math.random() * tvl * 0.5,
        volume1w: Math.random() * tvl * 2,
        volume1m: Math.random() * tvl * 8,
        volume1y: Math.random() * tvl * 50,
        network: 'Vara Network',
        isMyPool,
      };

      return poolData;
    });
  }, [pairsResult?.allPairs?.nodes, pairsTokens, account?.decodedAddress, tokenPrices]);

  return {
    poolsData,
    isFetching: isPairsFetching,
    error: pairsError,
  };
};

type SortField = string;
type SortDirection = 'asc' | 'desc';

type ExplorePagePoolsProps = {
  poolNetworkFilter: string;
  poolVolumeFilter: string;
  showMyPools: boolean;
};

export function ExplorePagePools({ poolNetworkFilter, poolVolumeFilter, showMyPools }: ExplorePagePoolsProps) {
  const [poolSort, setPoolSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: '',
    direction: 'desc',
  });

  const { poolsData, isFetching, error } = usePoolsData();

  const handleSort = (
    field: SortField,
    currentSort: { field: SortField; direction: SortDirection },
    setSort: (sort: { field: SortField; direction: SortDirection }) => void,
  ) => {
    const direction = currentSort.field === field && currentSort.direction === 'desc' ? 'asc' : 'desc';
    setSort({ field, direction });
  };

  const getSortIcon = (field: SortField, currentSort: { field: SortField; direction: SortDirection }) => {
    if (currentSort.field !== field) return null;
    return currentSort.direction === 'desc' ? (
      <ChevronDown className="w-3 h-3 ml-1" />
    ) : (
      <ChevronUp className="w-3 h-3 ml-1" />
    );
  };

  const sortData = (data: PoolData[], sortConfig: { field: SortField; direction: SortDirection }) => {
    if (!sortConfig.field) return data;

    return [...data].sort((a, b) => {
      let aVal = a[sortConfig.field as keyof PoolData];
      let bVal = b[sortConfig.field as keyof PoolData];

      // Handle nested properties for volume
      if (sortConfig.field.startsWith('volume')) {
        const volumeField = `volume${poolVolumeFilter}` as keyof PoolData;
        aVal = a[volumeField];
        bVal = b[volumeField];
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const filteredPools = poolsData.filter((pool) => {
    if (poolNetworkFilter !== 'all' && pool.network !== poolNetworkFilter) return false;
    if (showMyPools && !pool.isMyPool) return false;
    return true;
  });

  const sortedPools = sortData(filteredPools, poolSort);

  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const getPoolVolume = (pool: PoolData) => {
    switch (poolVolumeFilter) {
      case '1h':
        return formatCurrency(pool.volume1h);
      case '1d':
        return formatCurrency(pool.volume1d);
      case '1w':
        return formatCurrency(pool.volume1w);
      case '1m':
        return formatCurrency(pool.volume1m);
      case '1y':
        return formatCurrency(pool.volume1y);
      default:
        return formatCurrency(pool.volume1d);
    }
  };

  const SortableHeader = ({
    field,
    children,
    sort,
    onSort,
  }: {
    field: string;
    children: React.ReactNode;
    sort: { field: SortField; direction: SortDirection };
    onSort: (field: string) => void;
  }) => (
    <th
      className="text-right py-4 px-6 font-bold uppercase text-sm text-gray-400 cursor-pointer hover:text-[#00FF85] transition-colors select-none"
      onClick={() => onSort(field)}>
      <div className="flex items-center justify-end">
        {children}
        {getSortIcon(field, sort)}
      </div>
    </th>
  );

  const SortableHeaderLeft = ({
    field,
    children,
    sort,
    onSort,
  }: {
    field: string;
    children: React.ReactNode;
    sort: { field: SortField; direction: SortDirection };
    onSort: (field: string) => void;
  }) => (
    <th
      className="text-left py-4 px-6 font-bold uppercase text-sm text-gray-400 cursor-pointer hover:text-[#00FF85] transition-colors select-none"
      onClick={() => onSort(field)}>
      <div className="flex items-center">
        {children}
        {getSortIcon(field, sort)}
      </div>
    </th>
  );

  if (error) {
    return (
      <div className="card overflow-hidden">
        <div className="p-6 text-center">
          <p className="text-red-400">Error loading pools: {error.message}</p>
        </div>
      </div>
    );
  }

  if (isFetching) {
    return (
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-500/20">
                <th className="text-left py-4 px-6 font-bold uppercase text-sm text-gray-400">POOL</th>
                <th className="text-right py-4 px-6 font-bold uppercase text-sm text-gray-400">FEE TIER</th>
                <th className="text-right py-4 px-6 font-bold uppercase text-sm text-gray-400">TVL</th>
                <th className="text-right py-4 px-6 font-bold uppercase text-sm text-gray-400">
                  {poolVolumeFilter.toUpperCase()} VOLUME
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }, (_, index) => (
                <tr key={index} className="table-row">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      <div className="flex -space-x-2">
                        <div className="w-6 h-6 rounded-full bg-gray-600 animate-pulse"></div>
                        <div className="w-6 h-6 rounded-full bg-gray-600 animate-pulse"></div>
                      </div>
                      <div className="h-4 bg-gray-600 rounded animate-pulse w-20"></div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="h-4 bg-gray-600 rounded animate-pulse w-12 ml-auto"></div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="h-4 bg-gray-600 rounded animate-pulse w-16 ml-auto"></div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="h-4 bg-gray-600 rounded animate-pulse w-14 ml-auto"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-500/20">
              <SortableHeaderLeft
                field="name"
                sort={poolSort}
                onSort={(field) => handleSort(field, poolSort, setPoolSort)}>
                POOL
              </SortableHeaderLeft>
              <SortableHeader
                field="feeTier"
                sort={poolSort}
                onSort={(field) => handleSort(field, poolSort, setPoolSort)}>
                FEE TIER
              </SortableHeader>
              <SortableHeader field="tvl" sort={poolSort} onSort={(field) => handleSort(field, poolSort, setPoolSort)}>
                TVL
              </SortableHeader>
              <SortableHeader
                field="volume"
                sort={poolSort}
                onSort={(field) => handleSort(field, poolSort, setPoolSort)}>
                {poolVolumeFilter.toUpperCase()} VOLUME
              </SortableHeader>
            </tr>
          </thead>
          <tbody>
            {sortedPools.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 px-6 text-center text-gray-400">
                  No pools found
                </td>
              </tr>
            ) : (
              sortedPools.map((pool) => (
                <tr key={pool.id} className="table-row">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      <div className="flex -space-x-2">
                        <img
                          src={pool.token0.logoURI || '/placeholder.svg'}
                          alt={pool.token0.symbol}
                          className="w-6 h-6 rounded-full border-2 border-gray-500/20"
                        />
                        <img
                          src={pool.token1.logoURI || '/placeholder.svg'}
                          alt={pool.token1.symbol}
                          className="w-6 h-6 rounded-full border-2 border-gray-500/20"
                        />
                      </div>
                      <span className="font-medium mono theme-text">{pool.name}</span>
                      {pool.isMyPool && (
                        <span className="px-2 py-1 bg-[#00FF85]/20 text-[#00FF85] text-xs rounded-full">MY</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right font-medium mono theme-text">{pool.feeTier}%</td>
                  <td className="py-4 px-6 text-right font-medium mono theme-text">{formatCurrency(pool.tvl)}</td>
                  <td className="py-4 px-6 text-right mono theme-text">{getPoolVolume(pool)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
