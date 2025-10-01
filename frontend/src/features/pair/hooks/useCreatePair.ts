import { type HexString } from '@gear-js/api';
import { useAlert } from '@gear-js/react-hooks';

import { useCreatePairMessage, usePairsQuery } from '@/lib/sails';

const useCreatePair = () => {
  const { createPairMessage, isPending } = useCreatePairMessage();
  const { refetch: refetchPairs } = usePairsQuery();
  const alert = useAlert();

  const createPair = (token0: HexString, token1: HexString) =>
    createPairMessage(
      { token0, token1 },
      {
        onSuccess: () => {
          alert.success('Pair created successfully');
          void refetchPairs();
        },
      },
    );

  return { createPair, isPending };
};

export { useCreatePair };
