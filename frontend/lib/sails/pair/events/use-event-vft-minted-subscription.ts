import { HexString } from '@gear-js/api';
import { useProgramEvent } from '@gear-js/react-hooks';
import { ActorId } from 'sails-js';

import { usePairProgram } from '@/lib/sails/sails';

export type VftMintedPayload = {
  to: ActorId;
  value: string;
};

export type Params = {
  onData: (payload: VftMintedPayload) => void;
  pairAddress: HexString;
};

export function useEventVftMintedSubscription({ pairAddress, onData }: Params) {
  const program = usePairProgram(pairAddress);

  useProgramEvent({
    program,
    serviceName: 'vft',
    functionName: 'subscribeToMintedEvent',
    onData,
  });
}
