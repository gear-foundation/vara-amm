import type { HexString } from '@gear-js/api';
import { useAccount, useAlert, usePrepareProgramTransaction } from '@gear-js/react-hooks';
import { useMutation } from '@tanstack/react-query';

import { useFactoryProgram } from '@/lib/sails/sails';
import { getErrorMessage } from '@/lib/utils';

type Params = {
  token0: HexString;
  token1: HexString;
};

export const useCreatePairMessage = () => {
  const program = useFactoryProgram();
  const { account } = useAccount();

  const alert = useAlert();
  const { prepareTransactionAsync } = usePrepareProgramTransaction({
    program,
    serviceName: 'factory',
    functionName: 'createPair',
  });

  const tx = async ({ token0, token1 }: Params) => {
    if (!program || !account) return;

    const { transaction } = await prepareTransactionAsync({
      args: [token0, token1],
    });

    await transaction.signAndSend();
  };

  const { mutateAsync: createPairMessage, isPending } = useMutation({
    mutationFn: tx,
    onError: (error) => {
      alert.error(getErrorMessage(error));
    },
  });

  return { createPairMessage, isPending };
};
