import { TrendingUp, TrendingDown, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const tokensData = [
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

const poolsData = [
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

const transactionsData = [
  { type: 'Swap', amount: '1.5 ETH → 1,875 VARA', wallet: '0x1234...5678', time: '2m ago', timeSort: 2, isMyTx: true },
  { type: 'Add', amount: '0.8 ETH + 1,000 VARA', wallet: '0xabcd...efgh', time: '5m ago', timeSort: 5, isMyTx: false },
  {
    type: 'Remove',
    amount: '2.1 ETH + 2,625 VARA',
    wallet: '0x9876...5432',
    time: '8m ago',
    timeSort: 8,
    isMyTx: true,
  },
  { type: 'Swap', amount: '500 USDC → 0.2 ETH', wallet: '0x5555...9999', time: '12m ago', timeSort: 12, isMyTx: false },
];

type SortField = string;
type SortDirection = 'asc' | 'desc';

export function ExplorePage() {
  const [tokenNetworkFilter, setTokenNetworkFilter] = useState('all');
  const [tokenFilter, setTokenFilter] = useState('all');
  const [tokenVolumeFilter, setTokenVolumeFilter] = useState('1d');
  const [poolNetworkFilter, setPoolNetworkFilter] = useState('all');
  const [poolVolumeFilter, setPoolVolumeFilter] = useState('1d');
  const [showMyPools, setShowMyPools] = useState(false);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all');
  const [showMyTransactions, setShowMyTransactions] = useState(false);

  // Sorting states
  const [tokenSort, setTokenSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: '',
    direction: 'desc',
  });
  const [poolSort, setPoolSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: '',
    direction: 'desc',
  });
  const [transactionSort, setTransactionSort] = useState<{ field: SortField; direction: SortDirection }>({
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

  const sortData = (data: any[], sortConfig: { field: SortField; direction: SortDirection }) => {
    if (!sortConfig.field) return data;

    return [...data].sort((a, b) => {
      let aVal = a[sortConfig.field];
      let bVal = b[sortConfig.field];

      // Handle nested properties for volume
      if (sortConfig.field.startsWith('volume')) {
        const volumeField = `volume${tokenVolumeFilter || poolVolumeFilter}`;
        aVal = a[volumeField];
        bVal = b[volumeField];
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
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

  const filteredPools = poolsData.filter((pool) => {
    if (poolNetworkFilter !== 'all' && pool.network !== poolNetworkFilter) return false;
    if (showMyPools && !pool.isMyPool) return false;
    return true;
  });

  const filteredTransactions = transactionsData.filter((tx) => {
    if (transactionTypeFilter !== 'all' && tx.type.toLowerCase() !== transactionTypeFilter) return false;
    if (showMyTransactions && !tx.isMyTx) return false;
    return true;
  });

  const sortedTokens = sortData(filteredTokens, tokenSort);
  const sortedPools = sortData(filteredPools, poolSort);
  const sortedTransactions = sortData(filteredTransactions, transactionSort);

  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const getTokenVolume = (token: any) => {
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

  const getPoolVolume = (pool: any) => {
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
    <div className="max-w-7xl mx-auto">
      {/* Statistics Section */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="text-sm text-gray-400 uppercase mb-2">24H VOLUME</div>
          <div className="flex items-center space-x-3">
            <div className="text-2xl font-bold mono theme-text">$4.33B</div>
            <div className="flex items-center space-x-1 text-[#00FF85] mono">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">5.7%</span>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="text-sm text-gray-400 uppercase mb-2">Total VARAΞDEX TVL</div>
          <div className="flex items-center space-x-3">
            <div className="text-2xl font-bold mono theme-text">$4.40B</div>
            <div className="flex items-center space-x-1 text-red-400 mono">
              <TrendingDown className="w-4 h-4" />
              <span className="text-sm font-medium">3.96%</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="tokens" className="w-full">
        {/* Tabs and Filters Layout */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <TabsList className="card p-1">
            <TabsTrigger
              value="tokens"
              className="data-[state=active]:bg-[#00FF85] data-[state=active]:text-black font-bold uppercase">
              TOKENS
            </TabsTrigger>
            <TabsTrigger
              value="pools"
              className="data-[state=active]:bg-[#00FF85] data-[state=active]:text-black font-bold uppercase">
              POOLS
            </TabsTrigger>
            <TabsTrigger
              value="transactions"
              className="data-[state=active]:bg-[#00FF85] data-[state=active]:text-black font-bold uppercase">
              TRANSACTIONS
            </TabsTrigger>
          </TabsList>

          {/* Dynamic Filters based on active tab */}
          <div className="flex flex-wrap gap-4">
            <TabsContent value="tokens" className="m-0">
              <div className="flex flex-wrap gap-4">
                <Select value={tokenNetworkFilter} onValueChange={setTokenNetworkFilter}>
                  <SelectTrigger className="w-48 input-field">
                    <SelectValue placeholder="All networks" />
                  </SelectTrigger>
                  <SelectContent className="card">
                    <SelectItem value="all">All networks</SelectItem>
                    <SelectItem value="Ethereum">Ethereum</SelectItem>
                    <SelectItem value="Vara Network">Vara Network</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={tokenFilter} onValueChange={setTokenFilter}>
                  <SelectTrigger className="w-48 input-field">
                    <SelectValue placeholder="All tokens" />
                  </SelectTrigger>
                  <SelectContent className="card">
                    <SelectItem value="all">All tokens</SelectItem>
                    <SelectItem value="eth">ETH</SelectItem>
                    <SelectItem value="vara">VARA</SelectItem>
                    <SelectItem value="usdc">USDC</SelectItem>
                    <SelectItem value="usdt">USDT</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={tokenVolumeFilter} onValueChange={setTokenVolumeFilter}>
                  <SelectTrigger className="w-32 input-field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="card">
                    <SelectItem value="1h">1H volume</SelectItem>
                    <SelectItem value="1d">1D volume</SelectItem>
                    <SelectItem value="1w">1W volume</SelectItem>
                    <SelectItem value="1m">1M volume</SelectItem>
                    <SelectItem value="1y">1Y volume</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="pools" className="m-0">
              <div className="flex flex-wrap items-center gap-4">
                <Select value={poolNetworkFilter} onValueChange={setPoolNetworkFilter}>
                  <SelectTrigger className="w-48 input-field">
                    <SelectValue placeholder="All networks" />
                  </SelectTrigger>
                  <SelectContent className="card">
                    <SelectItem value="all">All networks</SelectItem>
                    <SelectItem value="Ethereum">Ethereum</SelectItem>
                    <SelectItem value="Vara Network">Vara Network</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={poolVolumeFilter} onValueChange={setPoolVolumeFilter}>
                  <SelectTrigger className="w-32 input-field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="card">
                    <SelectItem value="1h">1H volume</SelectItem>
                    <SelectItem value="1d">1D volume</SelectItem>
                    <SelectItem value="1w">1W volume</SelectItem>
                    <SelectItem value="1m">1M volume</SelectItem>
                    <SelectItem value="1y">1Y volume</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowMyPools(false)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      !showMyPools ? 'bg-[#00FF85] text-black' : 'bg-gray-500/20 theme-text hover:bg-gray-500/30'
                    }`}>
                    All pools
                  </button>
                  <button
                    onClick={() => setShowMyPools(true)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      showMyPools ? 'bg-[#00FF85] text-black' : 'bg-gray-500/20 theme-text hover:bg-gray-500/30'
                    }`}>
                    My pools
                  </button>
                </div>

                <Button className="btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  ADD LIQUIDITY
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="transactions" className="m-0">
              <div className="flex flex-wrap items-center gap-4">
                <Select value={transactionTypeFilter} onValueChange={setTransactionTypeFilter}>
                  <SelectTrigger className="w-48 input-field">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent className="card">
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="swap">Swap</SelectItem>
                    <SelectItem value="add">Add Liquidity</SelectItem>
                    <SelectItem value="remove">Remove Liquidity</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowMyTransactions(false)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      !showMyTransactions ? 'bg-[#00FF85] text-black' : 'bg-gray-500/20 theme-text hover:bg-gray-500/30'
                    }`}>
                    All transactions
                  </button>
                  <button
                    onClick={() => setShowMyTransactions(true)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      showMyTransactions ? 'bg-[#00FF85] text-black' : 'bg-gray-500/20 theme-text hover:bg-gray-500/30'
                    }`}>
                    My transactions
                  </button>
                </div>
              </div>
            </TabsContent>
          </div>
        </div>

        <TabsContent value="tokens">
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
                          <img
                            src={token.logoURI || '/placeholder.svg'}
                            alt={token.name}
                            className="w-8 h-8 rounded-full"
                          />
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
        </TabsContent>

        <TabsContent value="pools">
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
                    <SortableHeader
                      field="tvl"
                      sort={poolSort}
                      onSort={(field) => handleSort(field, poolSort, setPoolSort)}>
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
        </TabsContent>

        <TabsContent value="transactions">
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-500/20">
                    <SortableHeaderLeft
                      field="type"
                      sort={transactionSort}
                      onSort={(field) => handleSort(field, transactionSort, setTransactionSort)}>
                      TYPE
                    </SortableHeaderLeft>
                    <th className="text-left py-4 px-6 font-bold uppercase text-sm text-gray-400">AMOUNT</th>
                    <SortableHeaderLeft
                      field="wallet"
                      sort={transactionSort}
                      onSort={(field) => handleSort(field, transactionSort, setTransactionSort)}>
                      WALLET
                    </SortableHeaderLeft>
                    <SortableHeader
                      field="timeSort"
                      sort={transactionSort}
                      onSort={(field) => handleSort(field, transactionSort, setTransactionSort)}>
                      TIME
                    </SortableHeader>
                  </tr>
                </thead>
                <tbody>
                  {sortedTransactions.map((tx, index) => (
                    <tr key={index} className="table-row">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                              tx.type === 'Swap'
                                ? 'bg-blue-500/20 text-blue-400'
                                : tx.type === 'Add'
                                  ? 'bg-[#00FF85]/20 text-[#00FF85]'
                                  : 'bg-red-500/20 text-red-400'
                            }`}>
                            {tx.type}
                          </span>
                          {tx.isMyTx && (
                            <span className="px-2 py-1 bg-[#00FF85]/20 text-[#00FF85] text-xs rounded-full">MY</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 mono theme-text">{tx.amount}</td>
                      <td className="py-4 px-6 mono text-gray-400">{tx.wallet}</td>
                      <td className="py-4 px-6 text-right text-gray-400">{tx.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
