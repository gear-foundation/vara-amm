import { useAccount, useAlert, usePrepareProgramTransaction } from '@gear-js/react-hooks';
import { useMutation } from '@tanstack/react-query';
import { useMemo } from 'react';

import { usePairsTokens } from '@/features/pair';
import { useVftVaraProgram } from '@/lib/sails/sails';
import { getErrorMessage } from '@/lib/utils';

type Params = {
  value: bigint;
};

export const useBurnMessage = () => {
  const { tokensData } = usePairsTokens();
  const varaTokenAddress = useMemo(
    () => tokensData && Array.from(tokensData).find(([_, { isVaraNative }]) => isVaraNative)?.[0],
    [tokensData],
  );

  const program = useVftVaraProgram(varaTokenAddress);
  const { account } = useAccount();

  const alert = useAlert();
  const { prepareTransactionAsync } = usePrepareProgramTransaction({
    program,
    serviceName: 'vftNativeExchange',
    functionName: 'burn',
  });

  const tx = async ({ value }: Params) => {
    if (!program || !account) return;
    const { transaction } = await prepareTransactionAsync({
      args: [value],
    });

    return transaction;
  };

  const { mutateAsync: burnMessage, isPending } = useMutation({
    mutationFn: tx,
    onError: (error) => {
      alert.error(getErrorMessage(error));
    },
  });

  return { burnMessage, isPending };
};
