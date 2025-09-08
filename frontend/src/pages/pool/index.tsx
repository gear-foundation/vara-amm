import { useAccount } from '@gear-js/react-hooks';
import { useState } from 'react';

import { Loader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components';
import {
  AddLiquidity,
  usePairsBalances,
  useLpUserFees,
  useLpDecimals,
  usePairsTotalSupply,
  usePairsTokens,
} from '@/features/pair';
import type { Token } from '@/features/pair/types';
import { calculateExistingPoolShare } from '@/features/pair/utils';
import { usePairsQuery } from '@/lib/sails';

import { YourPositions } from './components/your-positions';

function Pool() {
  const { account } = useAccount();
  const { pairsTokens, refetchBalances: refetchVftBalances } = usePairsTokens();
  const { pairs } = usePairsQuery();
  const [activeTab, setActiveTab] = useState<'positions' | 'new'>('positions');
  const { pairBalances, refetchPairBalances, pairPrograms } = usePairsBalances({ pairs });
  const { lpDecimals } = useLpDecimals({ pairPrograms });
  const { lpUserFees, refetchLpUserFees } = useLpUserFees({ pairPrograms });
  const { pairTotalSupplies, refetchPairTotalSupplies } = usePairsTotalSupply({ pairPrograms });

  const [defaultToken0, setDefaultToken0] = useState<Token | null>(null);
  const [defaultToken1, setDefaultToken1] = useState<Token | null>(null);

  if (!pairsTokens) {
    return <Loader size="lg" text="Loading..." className="py-20" />;
  }

  const refetchBalances = () => {
    void refetchPairBalances();
    void refetchLpUserFees();
    void refetchPairTotalSupplies();
    refetchVftBalances();
  };

  const pairsWithUserLiquidity = pairs?.map((pair, index) => {
    const { token0, token1 } = pairsTokens.find(({ pairAddress }) => pairAddress === pair[1]) || {};

    if (!token0 || !token1) throw new Error('Token not found');

    const userLpBalance = (pairBalances && pairBalances[index]) || 0n;
    const totalSupply = (pairTotalSupplies && pairTotalSupplies[index]) || 0n;
    const poolShare = calculateExistingPoolShare(userLpBalance, totalSupply);

    return {
      pool: `${token0.symbol}/${token1.symbol}`,
      token0,
      token1,
      liquidity: userLpBalance,
      decimals: lpDecimals?.[index] || 18,
      rewards: lpUserFees?.[index] || 0n,
      share: `${poolShare}%`,
      pairAddress: pair[1],
    };
  });

  const userPositions = pairsWithUserLiquidity?.filter((pair) => pair?.liquidity !== 0n);

  return (
    <div className="max-w-4xl mx-auto">
      <Tabs value={activeTab} className="w-full" onValueChange={(value) => setActiveTab(value as 'positions' | 'new')}>
        <TabsList className="card p-1 mb-8">
          <TabsTrigger
            value="positions"
            onClick={() => {
              setDefaultToken0(null);
              setDefaultToken1(null);
            }}
            className="data-[state=active]:bg-[#00FF85] data-[state=active]:text-black font-bold uppercase">
            YOUR POSITIONS
          </TabsTrigger>
          <TabsTrigger
            value="new"
            className="data-[state=active]:bg-[#00FF85] data-[state=active]:text-black font-bold uppercase">
            NEW POSITION
          </TabsTrigger>
        </TabsList>

        <TabsContent value="positions">
          <YourPositions
            userPositions={userPositions}
            account={account}
            refetchBalances={refetchBalances}
            onAddMore={(token0, token1) => {
              setActiveTab('new');
              setDefaultToken0(token0);
              setDefaultToken1(token1);
            }}
            onCreateFirst={() => setActiveTab('new')}
          />
        </TabsContent>

        <TabsContent value="new">
          <AddLiquidity
            pairsTokens={pairsTokens}
            onSuccess={() => {
              refetchBalances();
              setActiveTab('positions');
            }}
            defaultToken0={defaultToken0}
            defaultToken1={defaultToken1}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Pool;
