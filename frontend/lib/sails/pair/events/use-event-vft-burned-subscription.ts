import { HexString } from '@gear-js/api';
import { useProgramEvent } from '@gear-js/react-hooks';
import { ActorId } from 'sails-js';

import { usePairProgram } from '@/lib/sails/sails';

export type VftBurnedPayload = {
  from: ActorId;
  value: string;
};

export type Params = {
  onData: (payload: VftBurnedPayload) => void;
  pairAddress: HexString;
};

export function useEventVftBurnedSubscription({ pairAddress, onData }: Params) {
  const program = usePairProgram(pairAddress);

  useProgramEvent({
    program,
    serviceName: 'vft',
    functionName: 'subscribeToBurnedEvent',
    onData,
  });
}
