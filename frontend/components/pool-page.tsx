'use client';

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddLiquidity, RemoveLiquidity, usePairsBalances, useLpUserFees } from '@/features/pair';
import { PairsTokens } from '@/features/pair/types';
import { usePairsQuery } from '@/lib/sails';

type PoolPageProps = {
  pairsTokens: PairsTokens;
  refetchBalances: () => void;
};

export function PoolPage({ pairsTokens, refetchBalances: refetchVftBalances }: PoolPageProps) {
  const { pairs } = usePairsQuery();
  const { pairBalances, refetchPairBalances, pairPrograms } = usePairsBalances({ pairs });
  // ! TODO: use as rewards
  const { lpUserFees, refetchLpUserFees } = useLpUserFees({ pairPrograms });
  console.log('🚀 ~ PoolPage ~ lpUserFees:', lpUserFees);

  const refetchBalances = () => {
    void refetchPairBalances();
    void refetchLpUserFees();
    refetchVftBalances();
  };

  const pairsWithUserLiquidity = pairs?.filter((_, index) => pairBalances?.[index] !== 0n);

  const userPositions = pairsWithUserLiquidity?.map((pair) => {
    const { token0, token1 } = pairsTokens.find(({ pairAddress }) => pairAddress === pair[1]) || {};

    if (!token0 || !token1) return null;

    return {
      pool: `${token0.symbol}/${token1.symbol}`,
      token0,
      token1,
      liquidity: '$2,450.67',
      rewards: '0 VARA',
      share: '0.0%',
      pairAddress: pair[1],
    };
  });

  return (
    <div className="max-w-4xl mx-auto">
      <Tabs defaultValue="positions" className="w-full">
        <TabsList className="card p-1 mb-8">
          <TabsTrigger
            value="positions"
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
                  <CardHeader className="flex flex-row items-center justify-between">
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
                      {position?.pairAddress && (
                        <RemoveLiquidity
                          pairAddress={position.pairAddress}
                          token0={position.token0}
                          token1={position.token1}
                          refetchBalances={refetchBalances}
                        />
                      )}
                      <Button className="btn-primary">ADD MORE</Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-gray-400 uppercase">LIQUIDITY</div>
                        <div className="text-lg font-medium mono theme-text">{position?.liquidity}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400 uppercase">REWARDS</div>
                        <div className="text-lg font-medium mono theme-text">{position?.rewards}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400 uppercase">POOL SHARE</div>
                        <div className="text-lg font-medium mono theme-text">{position?.share}</div>
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
          <AddLiquidity pairsTokens={pairsTokens} refetchBalances={refetchBalances} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
