import type { ReactNode } from 'react';

import { useSimWs } from '@/hooks/use-sim-ws';

import { SimWsContext } from './sim-ws-context';

export function SimWsProvider({ children }: { children: ReactNode }) {
  const simWs = useSimWs();

  return <SimWsContext.Provider value={simWs}>{children}</SimWsContext.Provider>;
}
