import { HexString } from '@gear-js/api';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SECONDS_IN_MINUTE } from '@/consts';
import {
  useCalculateLpUserFeeQuery,
  useCalculateRemoveLiquidityQuery,
  useRemoveLiquidityMessage,
  useVftBalanceOfQuery,
  useVftDecimalsQuery,
} from '@/lib/sails';

type RemoveLiquidityDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  pairAddress: HexString;
};

const RemoveLiquidityDialog = ({ isOpen, onClose, pairAddress }: RemoveLiquidityDialogProps) => {
  const [error, setError] = useState<string | null>(null);
  const [userInput, setUserInput] = useState<string>('');
  const { lpUserFee } = useCalculateLpUserFeeQuery(pairAddress);
  const { removeLiquidityMessage, isPending: isRemoveLiquidityPending } = useRemoveLiquidityMessage(pairAddress);
  const { balance: userLpBalance, isFetching: isUserLpBalanceFetching } = useVftBalanceOfQuery(pairAddress);
  const { decimals: lpDecimals, isFetching: isLpDecimalsFetching } = useVftDecimalsQuery(pairAddress);

  const lpInput = lpDecimals && userInput ? Number(userInput) * 10 ** lpDecimals : 0;
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

    const slippage = 0.05;
    const amountAMin = BigInt(removeLiquidityAmounts.amount_a) * BigInt(1 - slippage);
    const amountBMin = BigInt(removeLiquidityAmounts.amount_b) * BigInt(1 - slippage);

    const deadline = Math.floor(Date.now() / 1000) + 20 * SECONDS_IN_MINUTE;

    await removeLiquidityMessage({
      liquidity: String(lpInput),
      amountAMin: String(amountAMin),
      amountBMin: String(amountBMin),
      deadline: String(deadline),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="card max-w-md mx-auto max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg font-bold uppercase theme-text">Remove Liquidity</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col space-y-4 flex-1">
          <div className="flex justify-between text-sm text-gray-400">
            <span>LP TOKEN</span>
            <span>
              Balance: {userLpBalance} {lpDecimals}
            </span>
          </div>
          <Input
            value={userInput}
            type="number"
            className="input-field flex-1 text-xl"
            onChange={(e) => setUserInput(e.target.value)}
          />
        </div>

        <div className="flex justify-between text-sm text-gray-400">
          <span>TOKEN 0</span>
          <span>Expected amount: {removeLiquidityAmounts?.amount_a}</span>
        </div>

        <div className="flex justify-between text-sm text-gray-400">
          <span>TOKEN 1</span>
          <span>Expected amount: {removeLiquidityAmounts?.amount_b}</span>
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
