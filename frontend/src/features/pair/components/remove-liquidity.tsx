import type { HexString } from '@gear-js/api';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import type { Token } from '../types';

import { RemoveLiquidityDialog } from './remove-liquidity-dialog';

type RemoveLiquidityProps = {
  pairAddress: HexString;
  token0: Token;
  token1: Token;
  refetchBalances: () => void;
};

const RemoveLiquidity = ({ pairAddress, token0, token1, refetchBalances }: RemoveLiquidityProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)}>
        REMOVE
      </Button>
      <RemoveLiquidityDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        refetchBalances={refetchBalances}
        pairAddress={pairAddress}
        token0={token0}
        token1={token1}
      />
    </>
  );
};

export { RemoveLiquidity };
