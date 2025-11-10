import type { HexString } from '@gear-js/api';

import { Dialog, DialogContent, DialogDescription, DialogTitle, VisuallyHidden } from '@/components';
import { AddLiquidity, type PairsTokens } from '@/features/pair';

interface AddLiquidityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pairsTokens: PairsTokens;
  defaultToken0: HexString | null;
  defaultToken1: HexString | null;
  onSuccess?: () => void;
}

export function AddLiquidityDialog({
  isOpen,
  onClose,
  pairsTokens,
  defaultToken0,
  defaultToken1,
  onSuccess,
}: AddLiquidityDialogProps) {
  const handleSuccess = () => {
    onSuccess?.();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} aria-describedby="add-liquidity-dialog">
      <DialogContent
        aria-label="Add liquidity"
        aria-describedby="add-liquidity-dialog"
        className="max-w-sm mx-auto p-0 bg-transparent border-none shadow-none">
        <VisuallyHidden>
          <DialogTitle>Add Liquidity</DialogTitle>
          <DialogDescription>Add liquidity to a pool. Fixed fee tier: 0.3%</DialogDescription>
        </VisuallyHidden>
        <AddLiquidity
          pairsTokens={pairsTokens}
          onSuccess={handleSuccess}
          defaultToken0={defaultToken0}
          defaultToken1={defaultToken1}
        />
      </DialogContent>
    </Dialog>
  );
}
