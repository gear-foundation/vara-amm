'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddLiquidity, RemoveLiquidity, usePairsBalances, useLpUserFees, useLpDecimals } from '@/features/pair';
import { PairsTokens, Token } from '@/features/pair/types';
import { formatUnits } from '@/features/pair/utils';
import { usePairsQuery } from '@/lib/sails';

type PoolPageProps = {
  pairsTokens: PairsTokens;
  refetchBalances: () => void;
};

export function PoolPage({ pairsTokens, refetchBalances: refetchVftBalances }: PoolPageProps) {
  const { pairs } = usePairsQuery();
  const [activeTab, setActiveTab] = useState<'positions' | 'new'>('positions');
  const { pairBalances, refetchPairBalances, pairPrograms } = usePairsBalances({ pairs });
  const { lpDecimals } = useLpDecimals({ pairPrograms });
  // ! TODO: use as rewards
  const { lpUserFees, refetchLpUserFees } = useLpUserFees({ pairPrograms });
  console.log('🚀 ~ PoolPage ~ lpUserFees:', lpUserFees);

  const refetchBalances = () => {
    void refetchPairBalances();
    void refetchLpUserFees();
    refetchVftBalances();
  };

  const pairsWithUserLiquidity = pairs?.map((pair, index) => {
    const { token0, token1 } = pairsTokens.find(({ pairAddress }) => pairAddress === pair[1]) || {};

    if (!token0 || !token1) throw new Error('Token not found');

    return {
      pool: `${token0.symbol}/${token1.symbol}`,
      token0,
      token1,
      liquidity: pairBalances?.[index] || 0n, // TODO: use $ price
      decimals: lpDecimals?.[index] || 18,
      rewards: lpUserFees?.[index] || 0n, // TODO: '0 VARA',
      share: '0.0%', // TODO: use share
      pairAddress: pair[1],
    };
  });

  const userPositions = pairsWithUserLiquidity?.filter((pair) => pair?.liquidity !== 0n);

  const [defaultToken0, setDefaultToken0] = useState<Token | null>(null);
  const [defaultToken1, setDefaultToken1] = useState<Token | null>(null);

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
          {userPositions && userPositions.length > 0 ? (
            <div className="grid gap-6">
              {userPositions.map((position, index) => (
                <Card key={index} className="card">
                  <CardHeader className="flex flex-col items-start justify-between sm:flex-row sm:items-center">
                    <div className="flex items-center space-x-3">
                      <div className="flex -space-x-2">
                        <img
                          src={position?.token0.logoURI || '/placeholder.svg'}
                          alt={position?.token0.symbol}
                          className="w-8 h-8 rounded-full border-2 border-gray-500/20"
                        />
                        <img
                          src={position?.token1.logoURI || '/placeholder.svg'}
                          alt={position?.token1.symbol}
                          className="w-8 h-8 rounded-full border-2 border-gray-500/20"
                        />
                      </div>
                      <CardTitle className="mono theme-text">{position?.pool}</CardTitle>
                    </div>
                    <div className="flex space-x-2">
                      <RemoveLiquidity
                        pairAddress={position.pairAddress}
                        token0={position.token0}
                        token1={position.token1}
                        refetchBalances={refetchBalances}
                      />

                      <Button
                        className="btn-primary"
                        onClick={() => {
                          setActiveTab('new');
                          setDefaultToken0(position.token0);
                          setDefaultToken1(position.token1);
                        }}>
                        ADD MORE
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-gray-400 uppercase">LIQUIDITY</div>
                        <div className="text-lg font-medium mono theme-text">
                          {formatUnits(position.liquidity, position.decimals)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400 uppercase">REWARDS</div>
                        <div className="text-lg font-medium mono theme-text">{position.rewards}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400 uppercase">POOL SHARE</div>
                        <div className="text-lg font-medium mono theme-text">{position.share}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="card">
              <CardContent className="text-center py-12">
                <div className="text-gray-400 mb-4">No liquidity positions found</div>
                <Button className="btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  CREATE FIRST POSITION
                </Button>
              </CardContent>
            </Card>
          )}
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
