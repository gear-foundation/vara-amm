import { TrendingUp, TrendingDown, ChevronUp, ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { formatCurrency, getVolumeByTimeframe } from '@/utils';

import { useTokensWithPrices, transformTokenDataForTable, usePairsData } from '../../features/token-price';

type TokenData = {
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
};

type SortField = string;
type SortDirection = 'asc' | 'desc';

type ExplorePageTokensProps = {
  tokenNetworkFilter: string;
  tokenFilter: string;
  tokenVolumeFilter: string;
};

export function ExplorePageTokens({ tokenNetworkFilter, tokenFilter, tokenVolumeFilter }: ExplorePageTokensProps) {
  const [tokenSort, setTokenSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: '',
    direction: 'desc',
  });

  // Fetch tokens data from indexer
  const {
    data: tokensResponse,
    isLoading: tokensLoading,
    error: tokensError,
  } = useTokensWithPrices({
    first: 100,
    orderBy: tokenSort.field || 'volume24h',
  });

  // Fetch pairs data for volume calculations
  const { data: pairsData, isLoading: pairsLoading, error: pairsError } = usePairsData();

  // Transform tokens data with calculated volumes from pairs
  const tokensData =
    tokensResponse?.allTokens?.nodes && pairsData?.allPairs?.nodes
      ? transformTokenDataForTable(tokensResponse.allTokens.nodes, pairsData.allPairs.nodes)
      : tokensResponse?.allTokens?.nodes
        ? transformTokenDataForTable(tokensResponse.allTokens.nodes)
        : [];

  const isLoading = tokensLoading || pairsLoading;
  const error = tokensError || pairsError;

  console.log('🚀 ~ ExplorePageTokens ~ tokensData:', tokensData);
  console.log('🚀 ~ ExplorePageTokens ~ pairsData:', pairsData?.allPairs?.nodes?.length, 'pairs');
  console.log('🚀 ~ ExplorePageTokens ~ tokensResponse:', tokensResponse?.allTokens?.nodes?.length, 'tokens');

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

  const sortData = (data: TokenData[], sortConfig: { field: SortField; direction: SortDirection }) => {
    if (!sortConfig.field) return data;

    return [...data].sort((a, b) => {
      let aVal = a[sortConfig.field as keyof TokenData];
      let bVal = b[sortConfig.field as keyof TokenData];

      // Handle nested properties for volume
      if (sortConfig.field.startsWith('volume')) {
        const volumeField = `volume${tokenVolumeFilter}` as keyof TokenData;
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

  const filteredTokens = tokensData?.filter((token) => {
    if (tokenNetworkFilter !== 'all' && token.network !== tokenNetworkFilter) return false;
    if (tokenFilter !== 'all' && !token.symbol.toLowerCase().includes(tokenFilter.toLowerCase())) return false;
    return true;
  });

  const sortedTokens = sortData(filteredTokens, tokenSort);

  const formatPriceChange = (change: number) => {
    const isPositive = change >= 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const colorClass = isPositive ? 'text-[#00FF85]' : 'text-red-400';

    return (
      <div className={`flex items-center justify-end space-x-1 mono ${colorClass}`}>
        <Icon className="w-3 h-3" />
        <span>{Math.abs(change).toFixed(2)}%</span>
      </div>
    );
  };

  const SortableHeader = ({
    field,
    children,
    sort,
    onSort,
  }: {
    field: string;
    children: ReactNode;
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
    children: ReactNode;
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

  // Show loading state
  if (isLoading) {
    return (
      <div className="card overflow-hidden">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00FF85]"></div>
          <span className="ml-3 text-gray-400">Loading tokens...</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="card overflow-hidden">
        <div className="flex items-center justify-center py-8">
          <span className="text-red-400">Error loading tokens. Using fallback data.</span>
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
                sort={tokenSort}
                onSort={(field) => handleSort(field, tokenSort, setTokenSort)}>
                TOKEN
              </SortableHeaderLeft>
              <SortableHeader
                field="price"
                sort={tokenSort}
                onSort={(field) => handleSort(field, tokenSort, setTokenSort)}>
                PRICE
              </SortableHeader>
              <SortableHeader
                field="change1h"
                sort={tokenSort}
                onSort={(field) => handleSort(field, tokenSort, setTokenSort)}>
                1H
              </SortableHeader>
              <SortableHeader
                field="change1d"
                sort={tokenSort}
                onSort={(field) => handleSort(field, tokenSort, setTokenSort)}>
                1D
              </SortableHeader>
              <SortableHeader
                field="fdv"
                sort={tokenSort}
                onSort={(field) => handleSort(field, tokenSort, setTokenSort)}>
                FDV
              </SortableHeader>
              <SortableHeader
                field="volume"
                sort={tokenSort}
                onSort={(field) => handleSort(field, tokenSort, setTokenSort)}>
                {tokenVolumeFilter.toUpperCase()} VOLUME
              </SortableHeader>
            </tr>
          </thead>
          <tbody>
            {sortedTokens.map((token, index) => (
              <tr key={index} className="table-row">
                <td className="py-4 px-6">
                  <div className="flex items-center space-x-3">
                    <img src={token.logoURI || '/placeholder.svg'} alt={token.name} className="w-8 h-8 rounded-full" />
                    <div>
                      <div className="font-medium theme-text">{token.name}</div>
                      <div className="text-sm text-gray-400 mono">{token.symbol}</div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6 text-right font-medium mono theme-text">${token.price.toFixed(2)}</td>
                <td className="py-4 px-6 text-right">{formatPriceChange(token.change1h)}</td>
                <td className="py-4 px-6 text-right">{formatPriceChange(token.change1d)}</td>
                <td className="py-4 px-6 text-right mono theme-text">{formatCurrency(token.fdv)}</td>
                <td className="py-4 px-6 text-right mono theme-text">
                  {getVolumeByTimeframe(token, tokenVolumeFilter)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
