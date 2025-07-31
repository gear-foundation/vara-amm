'use client';

import { HexString } from '@gear-js/api';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddLiquidity, RemoveLiquidity } from '@/features/pair';
import { PairsTokens } from '@/features/pair/types';

const userPositions = [
  {
    pool: 'ETH/VARA',
    token0: { symbol: 'ETH', logoURI: '/tokens/eth.png' },
    token1: { symbol: 'VARA', logoURI: '/tokens/vara.png' },
    liquidity: '$2,450.67',
    rewards: '12.34 VARA',
    share: '0.12%',
    pairAddress: '0x123' as HexString,
  },
  {
    pool: 'VARA/USDC',
    token0: { symbol: 'VARA', logoURI: '/tokens/vara.png' },
    token1: { symbol: 'USDC', logoURI: '/tokens/usdc.png' },
    liquidity: '$1,234.89',
    rewards: '5.67 VARA',
    share: '0.08%',
    pairAddress: '0x123' as HexString,
  },
];

type PoolPageProps = {
  pairsTokens: PairsTokens;
};

export function PoolPage({ pairsTokens }: PoolPageProps) {
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
          {userPositions.length > 0 ? (
            <div className="grid gap-6">
              {userPositions.map((position, index) => (
                <Card key={index} className="card">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex -space-x-2">
                        <img
                          src={position.token0.logoURI || '/placeholder.svg'}
                          alt={position.token0.symbol}
                          className="w-8 h-8 rounded-full border-2 border-gray-500/20"
                        />
                        <img
                          src={position.token1.logoURI || '/placeholder.svg'}
                          alt={position.token1.symbol}
                          className="w-8 h-8 rounded-full border-2 border-gray-500/20"
                        />
                      </div>
                      <CardTitle className="mono theme-text">{position.pool}</CardTitle>
                    </div>
                    <div className="flex space-x-2">
                      <RemoveLiquidity pairAddress={position.pairAddress} />
                      <Button className="btn-primary">ADD MORE</Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-gray-400 uppercase">LIQUIDITY</div>
                        <div className="text-lg font-medium mono theme-text">{position.liquidity}</div>
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
          <AddLiquidity pairsTokens={pairsTokens} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
