import { ChevronUp, ChevronDown } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

type PoolData = {
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

const poolsData: PoolData[] = [
  {
    name: 'ETH/VARA',
    token0: { symbol: 'ETH', logoURI: '/tokens/eth.png' },
    token1: { symbol: 'VARA', logoURI: '/tokens/vara.png' },
    feeTier: 0.3,
    tvl: 2400000,
    volume1h: 38000,
    volume1d: 456000,
    volume1w: 3200000,
    volume1m: 13800000,
    volume1y: 165600000,
    network: 'Vara Network',
    isMyPool: true,
  },
  {
    name: 'VARA/USDC',
    token0: { symbol: 'VARA', logoURI: '/tokens/vara.png' },
    token1: { symbol: 'USDC', logoURI: '/tokens/usdc.png' },
    feeTier: 0.3,
    tvl: 1800000,
    volume1h: 19000,
    volume1d: 234000,
    volume1w: 1600000,
    volume1m: 6900000,
    volume1y: 82800000,
    network: 'Vara Network',
    isMyPool: false,
  },
  {
    name: 'ETH/USDC',
    token0: { symbol: 'ETH', logoURI: '/tokens/eth.png' },
    token1: { symbol: 'USDC', logoURI: '/tokens/usdc.png' },
    feeTier: 0.05,
    tvl: 5200000,
    volume1h: 100000,
    volume1d: 1200000,
    volume1w: 8400000,
    volume1m: 36000000,
    volume1y: 432000000,
    network: 'Ethereum',
    isMyPool: false,
  },
];

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
            {sortedPools.map((pool, index) => (
              <tr key={index} className="table-row">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
