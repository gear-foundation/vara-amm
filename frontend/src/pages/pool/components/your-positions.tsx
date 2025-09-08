import type { HexString } from '@gear-js/api';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet } from '@/components/wallet';
import { RemoveLiquidity } from '@/features/pair';
import type { Token } from '@/features/pair/types';
import { formatUnitsTrimmed } from '@/features/pair/utils';

type UserPosition = {
  pool: string;
  token0: Token;
  token1: Token;
  liquidity: bigint;
  decimals: number;
  rewards: bigint;
  share: string;
  pairAddress: HexString;
};

type YourPositionsProps = {
  userPositions?: UserPosition[];
  account?: unknown;
  onAddMore: (token0: Token, token1: Token) => void;
  onCreateFirst: () => void;
  refetchBalances: () => void;
};

export function YourPositions({
  userPositions,
  account,
  onAddMore,
  onCreateFirst,
  refetchBalances,
}: YourPositionsProps) {
  if (userPositions && userPositions.length > 0) {
    return (
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
                    onAddMore(position.token0, position.token1);
                  }}>
                  ADD MORE
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-400 uppercase">LIQUIDITY</div>
                  <div className="text-sm font-medium mono theme-text">
                    {formatUnitsTrimmed(position.liquidity, position.decimals)} LP
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 uppercase">REWARDS</div>
                  <div className="text-sm font-medium mono theme-text">
                    {formatUnitsTrimmed(position.rewards, position.decimals)} LP
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 uppercase">POOL SHARE</div>
                  <div className="text-sm font-medium mono theme-text">{position.share}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card className="card">
      <CardContent className="text-center py-12">
        <div className="text-gray-400 mb-4">No liquidity positions found</div>
        {account ? (
          <Button className="btn-primary" onClick={onCreateFirst}>
            <Plus className="w-4 h-4 mr-2" />
            CREATE FIRST POSITION
          </Button>
        ) : (
          <Wallet />
        )}
      </CardContent>
    </Card>
  );
}
