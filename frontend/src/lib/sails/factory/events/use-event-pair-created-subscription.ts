import { useProgramEvent } from '@gear-js/react-hooks';
import { ActorId } from 'sails-js';

import { useFactoryProgram } from '@/lib/sails/sails';

export type PairCreatedPayload = {
  token0: ActorId;
  token1: ActorId;
  pair_address: ActorId;
};

export type Params = {
  onData: (payload: PairCreatedPayload) => void;
};

export function useEventPairCreatedSubscription({ onData }: Params) {
  const program = useFactoryProgram();

  useProgramEvent({
    program,
    serviceName: 'factory',
    functionName: 'subscribeToPairCreatedEvent',
    onData,
  });
}
