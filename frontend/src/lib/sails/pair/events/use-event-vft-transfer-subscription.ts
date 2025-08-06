import type { HexString } from '@gear-js/api';
import { useProgramEvent } from '@gear-js/react-hooks';
import { ActorId } from 'sails-js';

import { usePairProgram } from '@/lib/sails/sails';

export type VftTransferPayload = {
  from: ActorId;
  to: ActorId;
  value: string;
};

export type Params = {
  onData: (payload: VftTransferPayload) => void;
  pairAddress: HexString;
};

export function useEventVftTransferSubscription({ pairAddress, onData }: Params) {
  const program = usePairProgram(pairAddress);

  useProgramEvent({
    program,
    serviceName: 'vft',
    functionName: 'subscribeToTransferEvent',
    onData,
  });
}
