import type { HexString } from '@gear-js/api';
import { useAccount } from '@gear-js/react-hooks';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';

import { Loader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components';
import {
  AddLiquidity,
  usePairsBalances,
  useLpUserFees,
  useLpDecimals,
  usePairsTotalSupply,
  usePairsTokens,
} from '@/features/pair';
import { calculateExistingPoolShare } from '@/features/pair/utils';
import { usePairsQuery } from '@/lib/sails';

import { UserPosition, YourPositions } from './components/your-positions';

type Tab = 'positions' | 'new-position';

function Pool() {
  const { account } = useAccount();
  const { pairsTokens, refetchBalances: refetchVftBalances } = usePairsTokens();
  const { pairs } = usePairsQuery();
  const location = useLocation();
  const routerState = location.state as { tab?: Tab } | null;
  const [activeTab, setActiveTab] = useState<Tab>(routerState?.tab || 'positions');
  const { pairBalances, refetchPairBalances, pairPrograms } = usePairsBalances();
  const { lpDecimals } = useLpDecimals({ pairPrograms });
  const { lpUserFees, refetchLpUserFees } = useLpUserFees({ pairPrograms });
  const { pairTotalSupplies, refetchPairTotalSupplies } = usePairsTotalSupply({ pairPrograms });

  const [defaultToken0, setDefaultToken0] = useState<HexString | null>(null);
  const [defaultToken1, setDefaultToken1] = useState<HexString | null>(null);

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
    const pairAddress = pair[1];
    const token0 = pairsTokens.tokens.get(pair[0][0]);
    const token1 = pairsTokens.tokens.get(pair[0][1]);

    if (!token0 || !token1) return null;

    const userLpBalance = (pairAddress && pairBalances?.[pairAddress]) || 0n;
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

  const userPositions = (pairsWithUserLiquidity?.filter((pair) => pair && pair.liquidity !== 0n) ||
    []) as UserPosition[];

  return (
    <div className="max-w-4xl mx-auto">
      <Tabs value={activeTab} className="w-full" onValueChange={(value) => setActiveTab(value as Tab)}>
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
            value="new-position"
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
              setActiveTab('new-position');
              setDefaultToken0(token0.address);
              setDefaultToken1(token1.address);
            }}
            onCreateFirst={() => setActiveTab('new-position')}
          />
        </TabsContent>

        <TabsContent value="new-position">
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
