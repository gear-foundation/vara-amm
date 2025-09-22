import type { HexString } from '@gear-js/api';
import { useAccount, useAlert, usePrepareProgramTransaction } from '@gear-js/react-hooks';
import { useMutation } from '@tanstack/react-query';

import { useVftProgram } from '@/lib/sails/sails';
import { getErrorMessage } from '@/lib/utils';

type Params = {
  spender: HexString;
  value: number | string | bigint;
};

export const useApproveMessage = (vftAddress: HexString) => {
  const program = useVftProgram(vftAddress);
  const { account } = useAccount();

  const alert = useAlert();
  const { prepareTransactionAsync } = usePrepareProgramTransaction({
    program,
    serviceName: 'vft',
    functionName: 'approve',
  });

  const tx = async ({ spender, value }: Params) => {
    if (!program || !account) return;
    const { transaction } = await prepareTransactionAsync({
      args: [spender, value],
    });

    return transaction;
  };

  const { mutateAsync: approveMessage, isPending } = useMutation({
    mutationFn: tx,
    onError: (error) => {
      alert.error(getErrorMessage(error));
    },
  });

  return { approveMessage, isPending };
};
