import { useAccount, usePrepareProgramTransaction } from '@gear-js/react-hooks';
import { useMutation } from '@tanstack/react-query';
import { useMemo } from 'react';

import { usePairsTokens } from '@/features/pair';
import { useVftVaraProgram } from '@/lib/sails/sails';

type Params = {
  value: bigint;
};

export const useBurnMessage = () => {
  const tokenMap = usePairsTokens().pairsTokens?.tokens;
  const varaTokenAddress = useMemo(
    () => tokenMap && Array.from(tokenMap).find(([_, { isVaraNative }]) => isVaraNative)?.[0],
    [tokenMap],
  );

  const program = useVftVaraProgram(varaTokenAddress);
  const { account } = useAccount();

  const { prepareTransactionAsync } = usePrepareProgramTransaction({
    program,
    serviceName: 'vftNativeExchange',
    functionName: 'burn',
  });

  const tx = async ({ value }: Params) => {
    if (!program || !account) throw new Error('Program or account is not found');
    const { transaction } = await prepareTransactionAsync({
      args: [value],
      gasLimit: 105_000_000_000n,
    });

    return transaction;
  };

  const { mutateAsync, isPending } = useMutation({ mutationFn: tx });

  return { mutateAsync, isPending, program };
};
