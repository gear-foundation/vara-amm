import { TrendingUp, TrendingDown, ChevronUp, ChevronDown } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

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

const tokensData: TokenData[] = [
  {
    name: 'Ethereum',
    symbol: 'ETH',
    logoURI: '/tokens/eth.png',
    price: 2345.67,
    change1h: 2.34,
    change1d: 5.67,
    fdv: 282100000000,
    volume1h: 1200000000,
    volume1d: 15200000000,
    volume1w: 98400000000,
    volume1m: 412800000000,
    volume1y: 5200000000000,
    network: 'Ethereum',
  },
  {
    name: 'Vara Token',
    symbol: 'VARA',
    logoURI: '/tokens/vara.png',
    price: 1.89,
    change1h: -1.23,
    change1d: 12.45,
    fdv: 1200000000,
    volume1h: 3800000,
    volume1d: 45600000,
    volume1w: 298200000,
    volume1m: 1100000000,
    volume1y: 12800000000,
    network: 'Vara Network',
  },
  {
    name: 'USD Coin',
    symbol: 'USDC',
    logoURI: '/tokens/usdc.png',
    price: 1.0,
    change1h: 0.01,
    change1d: 0.02,
    fdv: 32100000000,
    volume1h: 742000000,
    volume1d: 8900000000,
    volume1w: 62300000000,
    volume1m: 267800000000,
    volume1y: 3200000000000,
    network: 'Ethereum',
  },
  {
    name: 'Tether USD',
    symbol: 'USDT',
    logoURI: '/tokens/usdt.png',
    price: 1.0,
    change1h: 0.0,
    change1d: 0.01,
    fdv: 118500000000,
    volume1h: 2000000000,
    volume1d: 24100000000,
    volume1w: 168700000000,
    volume1m: 724300000000,
    volume1y: 8700000000000,
    network: 'Ethereum',
  },
];

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

  const filteredTokens = tokensData.filter((token) => {
    if (tokenNetworkFilter !== 'all' && token.network !== tokenNetworkFilter) return false;
    if (tokenFilter !== 'all' && !token.symbol.toLowerCase().includes(tokenFilter.toLowerCase())) return false;
    return true;
  });

  const sortedTokens = sortData(filteredTokens, tokenSort);

  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const getTokenVolume = (token: TokenData) => {
    switch (tokenVolumeFilter) {
      case '1h':
        return formatCurrency(token.volume1h);
      case '1d':
        return formatCurrency(token.volume1d);
      case '1w':
        return formatCurrency(token.volume1w);
      case '1m':
        return formatCurrency(token.volume1m);
      case '1y':
        return formatCurrency(token.volume1y);
      default:
        return formatCurrency(token.volume1d);
    }
  };

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
                <td className="py-4 px-6 text-right mono theme-text">{getTokenVolume(token)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
