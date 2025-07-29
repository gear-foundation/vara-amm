import { HexString } from '@gear-js/api';
import { useAccount, useAlert, usePrepareProgramTransaction } from '@gear-js/react-hooks';
import { useMutation } from '@tanstack/react-query';

import { usePairProgram } from '@/lib/sails/sails';
import { getErrorMessage } from '@/lib/utils';

type Params = {
  liquidity: string;
  amountAMin: string;
  amountBMin: string;
  deadline: string;
};

export const useRemoveLiquidityMessage = (pairAddress: HexString) => {
  const program = usePairProgram(pairAddress);
  const { account } = useAccount();

  const alert = useAlert();
  const { prepareTransactionAsync } = usePrepareProgramTransaction({
    program,
    serviceName: 'pair',
    functionName: 'removeLiquidity',
  });

  const tx = async ({ liquidity, amountAMin, amountBMin, deadline }: Params) => {
    if (!program || !account) return;

    const { transaction } = await prepareTransactionAsync({
      args: [liquidity, amountAMin, amountBMin, deadline],
    });

    await transaction.signAndSend();
  };

  const { mutateAsync: removeLiquidityMessage, isPending } = useMutation({
    mutationFn: tx,
    onError: (error) => {
      alert.error(getErrorMessage(error));
    },
  });

  return { removeLiquidityMessage, isPending };
};
