import type { HexString } from '@gear-js/api';
import { useAccount, usePrepareProgramTransaction } from '@gear-js/react-hooks';
import { useMutation } from '@tanstack/react-query';

import { usePairProgram } from '@/lib/sails/sails';

type Params = {
  amountOut: string;
  amountInMax: string;
  isToken0ToToken1: boolean;
  deadline: string;
};

export const useSwapTokensForExactTokensMessage = (pairAddress?: HexString) => {
  const program = usePairProgram(pairAddress);
  const { account } = useAccount();

  const { prepareTransactionAsync } = usePrepareProgramTransaction({
    program,
    serviceName: 'pair',
    functionName: 'swapTokensForExactTokens',
  });

  const tx = async ({ amountOut, amountInMax, isToken0ToToken1, deadline }: Params) => {
    if (!program || !account) throw new Error('Program or account is not found');

    const { transaction } = await prepareTransactionAsync({
      args: [amountOut, amountInMax, isToken0ToToken1, deadline],
      gasLimit: 105_000_000_000n,
    });

    return transaction;
  };

  const { mutateAsync, isPending } = useMutation({ mutationFn: tx });

  return { mutateAsync, isPending, program };
};
