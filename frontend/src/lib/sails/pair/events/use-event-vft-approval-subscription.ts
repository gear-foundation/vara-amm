import type { HexString } from '@gear-js/api';
import { useProgramEvent } from '@gear-js/react-hooks';
import { ActorId } from 'sails-js';

import { usePairProgram } from '@/lib/sails/sails';

export type VftApprovalPayload = {
  owner: ActorId;
  spender: ActorId;
  value: string;
};

export type Params = {
  onData: (payload: VftApprovalPayload) => void;
  pairAddress: HexString;
};

export function useEventVftApprovalSubscription({ pairAddress, onData }: Params) {
  const program = usePairProgram(pairAddress);

  useProgramEvent({
    program,
    serviceName: 'vft',
    functionName: 'subscribeToApprovalEvent',
    onData,
  });
}
