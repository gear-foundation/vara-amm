import type { HexString } from '@gear-js/api';
import { useAccount, useAlert, usePrepareProgramTransaction } from '@gear-js/react-hooks';
import { useMutation } from '@tanstack/react-query';

import { usePairProgram } from '@/lib/sails/sails';
import { getErrorMessage } from '@/lib/utils';

type Params = {
  from: HexString;
};

export const useVftRevokeAdminRoleMessage = (pairAddress: HexString) => {
  const program = usePairProgram(pairAddress);
  const { account } = useAccount();

  const alert = useAlert();
  const { prepareTransactionAsync } = usePrepareProgramTransaction({
    program,
    serviceName: 'vft',
    functionName: 'revokeAdminRole',
  });

  const tx = async ({ from }: Params) => {
    if (!program || !account) return;

    const { transaction } = await prepareTransactionAsync({
      args: [from],
    });

    await transaction.signAndSend();
  };

  const { mutateAsync: revokeAdminRoleMessage, isPending } = useMutation({
    mutationFn: tx,
    onError: (error) => {
      alert.error(getErrorMessage(error));
    },
  });

  return { revokeAdminRoleMessage, isPending };
};
