import type { HexString } from '@gear-js/api';
import { useAccount, usePrepareProgramTransaction } from '@gear-js/react-hooks';
import { useMutation } from '@tanstack/react-query';

import { usePairProgram } from '@/lib/sails/sails';

type Params = {
  amountADesired: bigint;
  amountBDesired: bigint;
  amountAMin: bigint;
  amountBMin: bigint;
  deadline: string;
};

export const useAddLiquidityMessage = (pairAddress?: HexString) => {
  const program = usePairProgram(pairAddress);
  const { account } = useAccount();

  const { prepareTransactionAsync } = usePrepareProgramTransaction({
    program,
    serviceName: 'pair',
    functionName: 'addLiquidity',
  });

  const tx = async ({ amountADesired, amountBDesired, amountAMin, amountBMin, deadline }: Params) => {
    if (!program || !account) throw new Error('Program or account is not found');

    const { transaction } = await prepareTransactionAsync({
      args: [amountADesired, amountBDesired, amountAMin, amountBMin, deadline],
      gasLimit: 105_000_000_000n,
    });

    return transaction;
  };

  const { mutateAsync, isPending } = useMutation({ mutationFn: tx });

  return { mutateAsync, isPending, program };
};
