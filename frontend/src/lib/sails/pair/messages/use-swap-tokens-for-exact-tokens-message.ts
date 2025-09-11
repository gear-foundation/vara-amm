import type { HexString } from '@gear-js/api';
import { useAccount, useAlert, usePrepareProgramTransaction } from '@gear-js/react-hooks';
import { useMutation } from '@tanstack/react-query';

import { usePairProgram } from '@/lib/sails/sails';
import { getErrorMessage } from '@/lib/utils';

type Params = {
  amountOut: string;
  amountInMax: string;
  isToken0ToToken1: boolean;
  deadline: string;
};

export const useSwapTokensForExactTokensMessage = (pairAddress?: HexString) => {
  const program = usePairProgram(pairAddress);
  const { account } = useAccount();

  const alert = useAlert();
  const { prepareTransactionAsync } = usePrepareProgramTransaction({
    program,
    serviceName: 'pair',
    functionName: 'swapTokensForExactTokens',
  });

  const tx = async ({ amountOut, amountInMax, isToken0ToToken1, deadline }: Params) => {
    if (!program || !account) return;

    const { transaction } = await prepareTransactionAsync({
      args: [amountOut, amountInMax, isToken0ToToken1, deadline],
      gasLimit: 105_000_000_000n,
    });

    return transaction;
  };

  const { mutateAsync: swapTokensForExactTokensMessage, isPending } = useMutation({
    mutationFn: tx,
    onError: (error) => {
      alert.error(getErrorMessage(error));
    },
  });

  return { swapTokensForExactTokensMessage, isPending };
};
