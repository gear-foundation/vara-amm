import { TrendingUp, TrendingDown } from 'lucide-react';
import { useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePairsTokens } from '@/features/pair';

import { ExplorePagePools } from './pools';
import { ExplorePagePoolsFilters } from './pools-filters';
import { ExplorePageTokens } from './tokens';
import { ExplorePageTokensFilters } from './tokens-filters';
import { ExplorePageTransactions } from './transactions';
import { ExplorePageTransactionsFilters } from './transactions-filters';

export function ExplorePage() {
  const { pairsTokens } = usePairsTokens();
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
          />
        </TabsContent>

        <TabsContent value="pools">
          <ExplorePagePools
            poolNetworkFilter={poolNetworkFilter}
            poolVolumeFilter={poolVolumeFilter}
            showMyPools={showMyPools}
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
