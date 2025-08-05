import { HexString } from '@gear-js/api';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { INPUT_PERCENTAGES, SECONDS_IN_MINUTE, SLIPPAGE } from '@/consts';
import {
  useCalculateRemoveLiquidityQuery,
  useRemoveLiquidityMessage,
  useVftBalanceOfQuery,
  useVftDecimalsQuery,
} from '@/lib/sails';

import { Token } from '../types';
import { calculatePercentage, formatUnits, parseUnits } from '../utils';

type RemoveLiquidityDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  refetchBalances: () => void;
  pairAddress: HexString;
  token0: Token;
  token1: Token;
};

const RemoveLiquidityDialog = ({
  isOpen,
  onClose,
  refetchBalances,
  pairAddress,
  token0,
  token1,
}: RemoveLiquidityDialogProps) => {
  const [error, setError] = useState<string | null>(null);
  const [userInput, setUserInput] = useState<string>('');
  const { removeLiquidityMessage, isPending: isRemoveLiquidityPending } = useRemoveLiquidityMessage(pairAddress);
  const { balance: userLpBalance, isFetching: isUserLpBalanceFetching } = useVftBalanceOfQuery(pairAddress);
  const { decimals: lpDecimals, isFetching: isLpDecimalsFetching } = useVftDecimalsQuery(pairAddress);

  const lpInput = lpDecimals && userInput ? parseUnits(userInput, lpDecimals) : 0n;
  const { removeLiquidityAmounts, isFetching: isRemoveLiquidityAmountsFetching } = useCalculateRemoveLiquidityQuery(
    pairAddress,
    String(lpInput),
  ); // or manually: liquidity * reserve_a / total_supply

  const isFetching =
    isUserLpBalanceFetching || isLpDecimalsFetching || isRemoveLiquidityAmountsFetching || isRemoveLiquidityPending;

  const removeLiquidity = async () => {
    setError(null);
    if (!lpDecimals) {
      setError('Failed to get LP token decimals');
      return;
    }

    if (!userLpBalance) {
      setError('Insufficient LP token balance');
      return;
    }

    if (!removeLiquidityAmounts) {
      setError('Failed to calculate expected amounts');
      return;
    }

    const amountAMin = calculatePercentage(BigInt(removeLiquidityAmounts[0]), 1 - SLIPPAGE);
    const amountBMin = calculatePercentage(BigInt(removeLiquidityAmounts[1]), 1 - SLIPPAGE);

    const deadline = (Math.floor(Date.now() / 1000) + 20 * SECONDS_IN_MINUTE) * 1000;

    await removeLiquidityMessage({
      liquidity: String(lpInput),
      amountAMin: String(amountAMin),
      amountBMin: String(amountBMin),
      deadline: String(deadline),
    });
    refetchBalances();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} aria-describedby="remove-liquidity-dialog">
      <DialogContent className="card max-w-md mx-auto max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg font-bold uppercase theme-text">Remove Liquidity</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col space-y-4 flex-1">
          <div className="flex justify-between text-sm text-gray-400">
            <span>LP TOKEN</span>
            {lpDecimals && <span>Balance: {formatUnits(BigInt(userLpBalance || 0), lpDecimals)}</span>}
          </div>
          <Input
            value={userInput}
            type="number"
            className="input-field flex-1 text-xl"
            onChange={(e) => setUserInput(e.target.value)}
          />
        </div>
        <div className="flex space-x-2">
          {INPUT_PERCENTAGES.map(({ label, value }) => (
            <Button
              key={label}
              variant="ghost"
              size="sm"
              className="text-xs bg-gray-500/20 hover:bg-gray-500/30 theme-text"
              onClick={() =>
                setUserInput(formatUnits(calculatePercentage(userLpBalance || 0n, value), lpDecimals || 0))
              }>
              {label}
            </Button>
          ))}
        </div>

        <div className="flex justify-between text-sm text-gray-400">
          <span>{token0.symbol}</span>
          <span>Expected amount: {formatUnits(BigInt(removeLiquidityAmounts?.[0] || 0), token0.decimals)}</span>
        </div>

        <div className="flex justify-between text-sm text-gray-400">
          <span>{token1.symbol}</span>
          <span>Expected amount: {formatUnits(BigInt(removeLiquidityAmounts?.[1] || 0), token1.decimals)}</span>
        </div>

        {error && <p className="text-red-500">{error}</p>}

        <Button onClick={removeLiquidity} disabled={isFetching} className="btn-primary w-full py-4 text-lg">
          REMOVE LIQUIDITY
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export { RemoveLiquidityDialog };
