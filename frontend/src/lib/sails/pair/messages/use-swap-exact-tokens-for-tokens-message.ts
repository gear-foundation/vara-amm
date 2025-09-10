import type { HexString } from '@gear-js/api';
import { useAccount, usePrepareProgramTransaction } from '@gear-js/react-hooks';
import { useMutation } from '@tanstack/react-query';

import { usePairProgram } from '@/lib/sails/sails';

type Params = {
  amountIn: string;
  amountOutMin: string;
  isToken0ToToken1: boolean;
  deadline: string;
};

export const useSwapExactTokensForTokensMessage = (pairAddress?: HexString) => {
  const program = usePairProgram(pairAddress);
  const { account } = useAccount();

  const { prepareTransactionAsync } = usePrepareProgramTransaction({
    program,
    serviceName: 'pair',
    functionName: 'swapExactTokensForTokens',
  });

  const tx = async ({ amountIn, amountOutMin, isToken0ToToken1, deadline }: Params) => {
    if (!program || !account) throw new Error('Program or account is not found');

    const { transaction } = await prepareTransactionAsync({
      args: [amountIn, amountOutMin, isToken0ToToken1, deadline],
      gasLimit: 105_000_000_000n,
    });

    return transaction;
  };

  const { mutateAsync, isPending } = useMutation({ mutationFn: tx });

  return { mutateAsync, isPending, program };
};
