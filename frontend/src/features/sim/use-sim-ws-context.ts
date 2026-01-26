import { useCallback, useContext, useMemo } from 'react';

import { type PositionSnapshot, type PreviewResponse, type SimMarketData } from '@/hooks/use-sim-ws';

import { SimWsContext, type SimWsContextType } from './sim-ws-context';

// Default fallback values for when context is not available (HMR, lazy loading transitions)
const FALLBACK_SYMBOL_CONFIG = {
  'BTC-USD': {
    displaySymbol: 'BTC/USD',
    baseAsset: 'BTC',
    quoteAsset: 'USDC',
    tradingViewSymbol: 'BINANCE:BTCUSDT',
    marketIndex: 0,
  },
  'ETH-USD': {
    displaySymbol: 'ETH/USD',
    baseAsset: 'ETH',
    quoteAsset: 'USDC',
    tradingViewSymbol: 'BINANCE:ETHUSDT',
    marketIndex: 1,
  },
};

export function useSimWsContext(): SimWsContextType {
  const context = useContext(SimWsContext);

  // Fallback values - used during HMR or lazy loading transitions
  const emptyMarketData = useMemo((): SimMarketData[] => [], []);
  const emptyPositions = useMemo((): PositionSnapshot[] => [], []);
  const emptyPreview = useMemo((): PreviewResponse | null => null, []);
  const noopGetMarketData = useCallback(() => emptyMarketData, [emptyMarketData]);
  const noopGetPositions = useCallback(() => emptyPositions, [emptyPositions]);
  const noopGetPreview = useCallback(() => emptyPreview, [emptyPreview]);
  const noopRequestPreview = useCallback(() => {}, []);

  // Return fallback if context not available (instead of throwing)
  if (!context) {
    // Log warning in development only
    if (process.env.NODE_ENV === 'development') {
      console.warn('[SimWsContext] Context not available - using fallback. This is normal during HMR.');
    }
    return {
      isConnected: false,
      error: null,
      prices: {},
      marketSnapshots: {},
      positions: [],
      previewResponse: null,
      marketData: emptyMarketData,
      processedPositions: emptyPositions,
      processedPreview: emptyPreview,
      getMarketData: noopGetMarketData,
      getPositions: noopGetPositions,
      getPreview: noopGetPreview,
      requestPreview: noopRequestPreview,
      SYMBOL_CONFIG: FALLBACK_SYMBOL_CONFIG,
    };
  }

  return context;
}
