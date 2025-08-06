import type { HexString } from '@gear-js/api';
import { useAccount, useAlert, usePrepareProgramTransaction } from '@gear-js/react-hooks';
import { useMutation } from '@tanstack/react-query';

import { usePairProgram } from '@/lib/sails/sails';
import { getErrorMessage } from '@/lib/utils';

type Params = {
  to: HexString;
};

export const useVftGrantMinterRoleMessage = (pairAddress: HexString) => {
  const program = usePairProgram(pairAddress);
  const { account } = useAccount();

  const alert = useAlert();
  const { prepareTransactionAsync } = usePrepareProgramTransaction({
    program,
    serviceName: 'vft',
    functionName: 'grantMinterRole',
  });

  const tx = async ({ to }: Params) => {
    if (!program || !account) return;

    const { transaction } = await prepareTransactionAsync({
      args: [to],
    });

    await transaction.signAndSend();
  };

  const { mutateAsync: grantMinterRoleMessage, isPending } = useMutation({
    mutationFn: tx,
    onError: (error) => {
      alert.error(getErrorMessage(error));
    },
  });

  return { grantMinterRoleMessage, isPending };
};
