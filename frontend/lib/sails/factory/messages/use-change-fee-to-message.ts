import { HexString } from '@gear-js/api';
import { useAccount, useAlert, usePrepareProgramTransaction } from '@gear-js/react-hooks';
import { useMutation } from '@tanstack/react-query';

import { useFactoryProgram } from '@/lib/sails/sails';
import { getErrorMessage } from '@/lib/utils';

type Params = {
  feeTo: HexString;
};

export const useChangeFeeToMessage = () => {
  const program = useFactoryProgram();
  const { account } = useAccount();

  const alert = useAlert();
  const { prepareTransactionAsync } = usePrepareProgramTransaction({
    program,
    serviceName: 'factory',
    functionName: 'changeFeeTo',
  });

  const tx = async ({ feeTo }: Params) => {
    if (!program || !account) return;

    const { transaction } = await prepareTransactionAsync({
      args: [feeTo],
    });

    await transaction.signAndSend();
  };

  const { mutateAsync: changeFeeToMessage, isPending } = useMutation({
    mutationFn: tx,
    onError: (error) => {
      alert.error(getErrorMessage(error));
    },
  });

  return { changeFeeToMessage, isPending };
};
