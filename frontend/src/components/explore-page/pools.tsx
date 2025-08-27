import { ChevronUp, ChevronDown } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

import { type PoolData } from '@/features/pair';
import { formatCurrency, getVolumeByTimeframe } from '@/utils';

type SortField = string;
type SortDirection = 'asc' | 'desc';

type ExplorePagePoolsProps = {
  poolNetworkFilter: string;
  poolVolumeFilter: string;
  showMyPools: boolean;
  poolsData: PoolData[];
  isLoading: boolean;
  error?: Error | null;
};

export function ExplorePagePools({
  poolNetworkFilter,
  poolVolumeFilter,
  showMyPools,
  poolsData,
  isLoading,
  error,
}: ExplorePagePoolsProps) {
  const [poolSort, setPoolSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: '',
    direction: 'desc',
  });

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

  const sortData = (data: PoolData[], sortConfig: { field: SortField; direction: SortDirection }): PoolData[] => {
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

  const filteredPools = (poolsData || []).filter((pool: PoolData) => {
    if (poolNetworkFilter !== 'all' && pool.network !== poolNetworkFilter) return false;
    if (showMyPools && !pool.isMyPool) return false;
    return true;
  });

  const sortedPools = sortData(filteredPools, poolSort);

  const getPoolVolume = (pool: PoolData) => getVolumeByTimeframe(pool, poolVolumeFilter);

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
          <p className="text-red-400">Error loading pools: {error?.message || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
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
