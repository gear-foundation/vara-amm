import { createContext } from 'react';

import { useSimWs } from '@/hooks/use-sim-ws';

export type SimWsContextType = ReturnType<typeof useSimWs>;

export const SimWsContext = createContext<SimWsContextType | null>(null);
