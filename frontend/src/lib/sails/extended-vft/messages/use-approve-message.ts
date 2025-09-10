import type { HexString } from '@gear-js/api';
import { useAccount, usePrepareProgramTransaction } from '@gear-js/react-hooks';
import { useMutation } from '@tanstack/react-query';

import { useVftProgram } from '@/lib/sails/sails';

type Params = {
  spender: HexString;
  value: number | string | bigint;
};

export const useApproveMessage = (vftAddress: HexString) => {
  const program = useVftProgram(vftAddress);
  const { account } = useAccount();

  const { prepareTransactionAsync } = usePrepareProgramTransaction({
    program,
    serviceName: 'vft',
    functionName: 'approve',
  });

  const tx = async ({ spender, value }: Params) => {
    if (!program || !account) throw new Error('Program or account is not found');

    const { transaction } = await prepareTransactionAsync({
      args: [spender, value],
    });

    return transaction;
  };

  const { mutateAsync, isPending } = useMutation({ mutationFn: tx });

  return { mutateAsync, isPending, program };
};
