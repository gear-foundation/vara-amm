import { useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePairsTokens, usePoolsData } from '@/features/pair';
import { formatCurrency } from '@/utils';

import { ExplorePagePools } from './components/pools';
import { ExplorePagePoolsFilters } from './components/pools-filters';
import { ExplorePageTokens } from './components/tokens';
import { ExplorePageTokensFilters } from './components/tokens-filters';
import { ExplorePageTransactions } from './components/transactions';
import { ExplorePageTransactionsFilters } from './components/transactions-filters';

function ExplorePage() {
  const { pairsTokens, tokensData } = usePairsTokens();

  const { poolsData, metrics, isFetching: isPoolsLoading, error: poolsError } = usePoolsData(tokensData);
  const [tokenNetworkFilter, setTokenNetworkFilter] = useState('all');
  const [tokenFilter, setTokenFilter] = useState('all');
  const [tokenVolumeFilter, setTokenVolumeFilter] = useState('1d');
  const [poolNetworkFilter, setPoolNetworkFilter] = useState('all');
  const [poolVolumeFilter, setPoolVolumeFilter] = useState('1d');
  const [showMyPools, setShowMyPools] = useState(false);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all');
  const [showMyTransactions, setShowMyTransactions] = useState(false);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Statistics Section */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="text-sm text-gray-400 uppercase mb-2">24H VOLUME</div>
          <div className="flex items-center space-x-3">
            {isPoolsLoading ? (
              <div className="h-8 bg-gray-600 rounded animate-pulse w-24"></div>
            ) : (
              <div className="text-2xl font-bold mono theme-text">{formatCurrency(metrics?.total24hVolume || 0)}</div>
            )}
            {/* ! TODO: Add volume change */}
            {/* <div
              className={`flex items-center space-x-1 mono ${
                (metrics?.volumeChange24h || 0) >= 0 ? 'text-[#00FF85]' : 'text-red-400'
              }`}>
              {(metrics?.volumeChange24h || 0) >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">{Math.abs(metrics?.volumeChange24h || 0).toFixed(1)}%</span>
            </div> */}
          </div>
        </div>

        <div className="card p-6">
          <div className="text-sm text-gray-400 uppercase mb-2">Total VARAΞDEX TVL</div>
          <div className="flex items-center space-x-3">
            {isPoolsLoading ? (
              <div className="h-8 bg-gray-600 rounded animate-pulse w-24"></div>
            ) : (
              <div className="text-2xl font-bold mono theme-text">{formatCurrency(metrics?.totalTVL || 0)}</div>
            )}
            {/* ! TODO: Add volume change */}
            {/* <div
            <div
              className={`flex items-center space-x-1 mono ${
                (metrics?.tvlChange24h || 0) >= 0 ? 'text-[#00FF85]' : 'text-red-400'
              }`}>
              {(metrics?.tvlChange24h || 0) >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">{Math.abs(metrics?.tvlChange24h || 0).toFixed(2)}%</span>
            </div> */}
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
              <ExplorePageTokensFilters
                tokenNetworkFilter={tokenNetworkFilter}
                setTokenNetworkFilter={setTokenNetworkFilter}
                tokenFilter={tokenFilter}
                setTokenFilter={setTokenFilter}
                tokenVolumeFilter={tokenVolumeFilter}
                setTokenVolumeFilter={setTokenVolumeFilter}
              />
            </TabsContent>

            <TabsContent value="pools" className="m-0">
              <ExplorePagePoolsFilters
                poolNetworkFilter={poolNetworkFilter}
                setPoolNetworkFilter={setPoolNetworkFilter}
                poolVolumeFilter={poolVolumeFilter}
                setPoolVolumeFilter={setPoolVolumeFilter}
                showMyPools={showMyPools}
                setShowMyPools={setShowMyPools}
              />
            </TabsContent>

            <TabsContent value="transactions" className="m-0">
              <ExplorePageTransactionsFilters
                transactionTypeFilter={transactionTypeFilter}
                setTransactionTypeFilter={setTransactionTypeFilter}
                showMyTransactions={showMyTransactions}
                setShowMyTransactions={setShowMyTransactions}
              />
            </TabsContent>
          </div>
        </div>

        <TabsContent value="tokens">
          <ExplorePageTokens
            tokenNetworkFilter={tokenNetworkFilter}
            tokenFilter={tokenFilter}
            tokenVolumeFilter={tokenVolumeFilter}
            tokensDataMap={tokensData}
          />
        </TabsContent>

        <TabsContent value="pools">
          <ExplorePagePools
            poolNetworkFilter={poolNetworkFilter}
            poolVolumeFilter={poolVolumeFilter}
            showMyPools={showMyPools}
            poolsData={poolsData}
            isLoading={isPoolsLoading}
            error={poolsError}
          />
        </TabsContent>

        <TabsContent value="transactions">
          <ExplorePageTransactions
            showMyTransactions={showMyTransactions}
            transactionTypeFilter={transactionTypeFilter}
            pairsTokens={pairsTokens}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ExplorePage;
