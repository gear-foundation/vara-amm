import { HexString } from '@gear-js/api';
import { useAccount, useAlert, usePrepareProgramTransaction } from '@gear-js/react-hooks';
import { useMutation } from '@tanstack/react-query';

import { usePairProgram } from '@/lib/sails/sails';
import { getErrorMessage } from '@/lib/utils';

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

  const alert = useAlert();
  const { prepareTransactionAsync } = usePrepareProgramTransaction({
    program,
    serviceName: 'pair',
    functionName: 'addLiquidity',
  });

  const tx = async ({ amountADesired, amountBDesired, amountAMin, amountBMin, deadline }: Params) => {
    if (!program || !account) return;

    const { transaction } = await prepareTransactionAsync({
      args: [amountADesired, amountBDesired, amountAMin, amountBMin, deadline],
      gasLimit: 105_000_000_000n,
    });

    return transaction;
  };

  const { mutateAsync: addLiquidityMessage, isPending } = useMutation({
    mutationFn: tx,
    onError: (error) => {
      alert.error(getErrorMessage(error));
    },
  });

  return { addLiquidityMessage, isPending };
};
