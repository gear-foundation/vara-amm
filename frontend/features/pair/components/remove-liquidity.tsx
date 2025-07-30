import { HexString } from '@gear-js/api';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { RemoveLiquidityDialog } from './remove-liquidity-dialog';

type RemoveLiquidityProps = {
  pairAddress: HexString;
};

const RemoveLiquidity = ({ pairAddress }: RemoveLiquidityProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button className="btn-secondary" onClick={() => setIsOpen(true)}>
        REMOVE
      </Button>
      <RemoveLiquidityDialog isOpen={isOpen} onClose={() => setIsOpen(false)} pairAddress={pairAddress} />
    </>
  );
};

export { RemoveLiquidity };
