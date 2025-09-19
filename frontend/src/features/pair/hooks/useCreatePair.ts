import { type HexString } from '@gear-js/api';
import { useAlert } from '@gear-js/react-hooks';

import { useCreatePairMessage, usePairsQuery } from '@/lib/sails';
import { getErrorMessage } from '@/lib/utils';

const useCreatePair = () => {
  const { createPairMessage } = useCreatePairMessage();
  const { refetch: refetchPairs } = usePairsQuery();
  const alert = useAlert();

  const createPair = async (token0: HexString, token1: HexString) =>
    createPairMessage(
      { token0, token1 },
      {
        onSuccess: () => {
          alert.success('Pair created successfully');
          void refetchPairs();
        },
        onError: (error) => {
          alert.error(getErrorMessage(error));
          console.error('Pair not created', error);
        },
      },
    );

  // const createPair = async (token0: HexString, token1: HexString) =>
  //   new Promise<HexString>((resolve, reject) => {
  //     if (!program) return reject(new Error('Program is not ready'));

  //     void program.factory.subscribeToPairCreatedEvent((payload) => {
  //       console.log('Pair created event', payload);
  //       if (
  //         (payload.token0 === token0 && payload.token1 === token1) ||
  //         (payload.token0 === token1 && payload.token1 === token0)
  //       ) {
  //         resolve(payload.pair_address);
  //         alert.success('Pair created successfully');
  //       }
  //     });

  //     void createPairMessage({ token0, token1 }).then(() => {
  //       setTimeout(() => {
  //         console.log('Start timeout');
  //         reject(new Error('Pair not created'));
  //         alert.error('Pair not created');
  //       }, 10000);
  //     });
  //   });

  return { createPair };
};

export { useCreatePair };
