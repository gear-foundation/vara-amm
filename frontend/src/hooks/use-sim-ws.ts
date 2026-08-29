import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ENV } from '@/consts';

// Micro-USD to USD conversion (divide by 1_000_000)
const MICRO_TO_USD = 1_000_000;

// Throttle interval for UI updates (ms) - ~30fps is enough for trading data
const UI_UPDATE_INTERVAL = 33;

// BPS fixed-point to percentage conversion
// funding_rate_bps_hour_fp is bps * 1e6, 1 bps = 0.01%
// So: rate_percent = bps_hour_fp / 1e6 / 100 = bps_hour_fp / 1e8
const BPS_FP_TO_PERCENT = 1 / 100_000_000;

// Types from sim-engine
export type OracleTick = {
  symbol: string;
  price_min: number;
  price_max: number;
  ts: number;
};

export type MarketSnapshot = {
  symbol: string;
  oi_long_usd: number;
  oi_short_usd: number;
  liquidity_usd: number;
  // Rates: bps * 1e6 per hour
  funding_rate_bps_hour_fp: number; // signed
  borrowing_rate_bps_hour_fp: number; // unsigned
  ts: number;
};

export type PositionSnapshot = {
  symbol: string;
  side: 'long' | 'short';
  size_usd: number;
  entry_price: number;
  current_price: number;
  unrealized_pnl: number;
  liquidation_price: number;
  leverage_actual: number;
  is_liquidatable: boolean;
};

export type PreviewRequest = {
  action: 'preview';
  symbol: string;
  side: 'long' | 'short';
  qty: number;
  leverage: number;
};

export type PreviewResponse = {
  symbol: string;
  side: string;
  qty: number;
  leverage: number;
  size_usd: number;
  collateral: number;
  entry_price: number;
  current_price: number;
  liquidation_price: number;
  // Fee estimates (micro-USD)
  funding_fee_usd: number; // signed
  borrowing_fee_usd: number;
  price_impact_usd: number; // signed
  close_fees_usd: number;
};

// Processed market data for UI
export type SimMarketData = {
  symbol: string; // API symbol: BTC-USD
  displaySymbol: string; // UI symbol: BTC/USD
  baseAsset: string;
  quoteAsset: string;
  price: number; // mid price in USD
  priceMin: number;
  priceMax: number;
  openInterestLong: number;
  openInterestShort: number;
  liquidityLong: number;
  liquidityShort: number;
  // Rates as percentage per hour (e.g., 0.01 = 0.01%/hour)
  fundingRatePerHour: number; // signed
  borrowingRatePerHour: number;
  ts: number;
};

type WsMessage = {
  type: 'Event' | 'Response' | 'Error';
  payload: unknown;
};

// Old nested format (for backwards compatibility)
type NestedEventPayload = {
  OracleTick?: OracleTick;
  MarketSnapshot?: MarketSnapshot;
  PositionSnapshot?: PositionSnapshot;
  OrderExecuted?: unknown;
  PositionLiquidated?: unknown;
};

// New flat format with event_type field
type FlatEventPayload = {
  event_type: string;
  symbol?: string;
  // OracleTick fields
  price_min?: number;
  price_max?: number;
  ts?: number;
  // MarketSnapshot fields
  oi_long_usd?: number;
  oi_short_usd?: number;
  liquidity_usd?: number;
  funding_rate_bps_hour_fp?: number;
  borrowing_rate_bps_hour_fp?: number;
  // PositionSnapshot fields
  side?: 'long' | 'short';
  size_usd?: number;
  entry_price?: number;
  current_price?: number;
  unrealized_pnl?: number;
  liquidation_price?: number;
  leverage_actual?: number;
  is_liquidatable?: boolean;
};

type EventPayload = NestedEventPayload | FlatEventPayload;

// Symbol mapping
const SYMBOL_CONFIG: Record<
  string,
  {
    displaySymbol: string;
    baseAsset: string;
    quoteAsset: string;
    tradingViewSymbol: string;
    marketIndex: number;
  }
> = {
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

function isWsMessage(value: unknown): value is WsMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { type?: unknown };
  return candidate.type === 'Event' || candidate.type === 'Response' || candidate.type === 'Error';
}

// Check if message is a direct event (not wrapped in {type, payload})
function isDirectEvent(value: unknown): value is EventPayload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return 'OracleTick' in candidate || 'MarketSnapshot' in candidate || 'PositionSnapshot' in candidate;
}

export function useSimWs() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsUrl = ENV.SIM_WS_URL;

  // Market data state
  const [prices, setPrices] = useState<Record<string, OracleTick>>({});
  const [marketSnapshots, setMarketSnapshots] = useState<Record<string, MarketSnapshot>>({});
  const [positions, setPositions] = useState<PositionSnapshot[]>([]);
  const [previewResponse, setPreviewResponse] = useState<PreviewResponse | null>(null);

  // ============== THROTTLING MECHANISM ==============
  // Buffers to accumulate updates between UI flushes
  const pricesBufferRef = useRef<Record<string, OracleTick>>({});
  const snapshotsBufferRef = useRef<Record<string, MarketSnapshot>>({});
  const positionsBufferRef = useRef<PositionSnapshot[]>([]);
  const hasPendingUpdatesRef = useRef(false);
  const lastFlushTimeRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  // Flush buffered updates to React state (throttled)
  const flushUpdates = useCallback(() => {
    if (!mountedRef.current || !hasPendingUpdatesRef.current) {
      rafIdRef.current = null;
      return;
    }

    const now = performance.now();
    const timeSinceLastFlush = now - lastFlushTimeRef.current;

    // If not enough time passed, schedule another RAF
    if (timeSinceLastFlush < UI_UPDATE_INTERVAL) {
      rafIdRef.current = requestAnimationFrame(flushUpdates);
      return;
    }

    // Batch all state updates together
    setPrices({ ...pricesBufferRef.current });
    setMarketSnapshots({ ...snapshotsBufferRef.current });
    setPositions([...positionsBufferRef.current]);

    lastFlushTimeRef.current = now;
    hasPendingUpdatesRef.current = false;
    rafIdRef.current = null;
  }, []);

  // Schedule a throttled UI update
  const scheduleUpdate = useCallback(() => {
    hasPendingUpdatesRef.current = true;

    // Only schedule RAF if not already scheduled
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(flushUpdates);
    }
  }, [flushUpdates]);
  // ============== END THROTTLING MECHANISM ==============

  // Connect to WebSocket
  useEffect(() => {
    mountedRef.current = true;

    const connect = () => {
      // Don't reconnect if unmounted
      if (!mountedRef.current) {
        return;
      }

      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (!mountedRef.current) {
            ws.close();
            return;
          }
          setIsConnected(true);
          setError(null);
        };

        ws.onclose = (event) => {
          setIsConnected(false);

          // Only reconnect if still mounted and it wasn't a clean close
          if (mountedRef.current && event.code !== 1000) {
            reconnectTimeoutRef.current = setTimeout(connect, 3000);
          }
        };

        ws.onerror = () => {
          setError('WebSocket connection error');
        };

        ws.onmessage = (event: MessageEvent) => {
          const raw: unknown = event.data;
          if (typeof raw !== 'string') {
            return;
          }

          try {
            const parsed: unknown = JSON.parse(raw);

            // Handle wrapped format: {type: "Event", payload: {...}}
            if (isWsMessage(parsed)) {
              handleMessage(parsed);
              return;
            }

            // Handle direct event format: {OracleTick: {...}} or {MarketSnapshot: {...}}
            if (isDirectEvent(parsed)) {
              handleMessage({ type: 'Event', payload: parsed });
              return;
            }
          } catch {
            // Silent fail for unparseable messages
          }
        };

        wsRef.current = ws;
      } catch {
        setError('Failed to connect to simulator');

        if (mountedRef.current) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      }
    };

    // Handle incoming messages
    const handleMessage = (message: WsMessage) => {
      if (message.type === 'Event') {
        const rawPayload = message.payload as Record<string, unknown>;

        // Check for flat format (event_type field)
        if ('event_type' in rawPayload) {
          const flat = rawPayload as unknown as FlatEventPayload;

          if (flat.event_type === 'OracleTick' && flat.symbol && flat.price_min !== undefined) {
            const tick: OracleTick = {
              symbol: flat.symbol,
              price_min: flat.price_min,
              price_max: flat.price_max ?? flat.price_min,
              ts: flat.ts ?? Date.now(),
            };
            // Buffer update instead of direct setState
            pricesBufferRef.current[tick.symbol] = tick;
            scheduleUpdate();
          }

          if (flat.event_type === 'MarketSnapshot' && flat.symbol) {
            const snapshot: MarketSnapshot = {
              symbol: flat.symbol,
              oi_long_usd: flat.oi_long_usd ?? 0,
              oi_short_usd: flat.oi_short_usd ?? 0,
              liquidity_usd: flat.liquidity_usd ?? 0,
              funding_rate_bps_hour_fp: flat.funding_rate_bps_hour_fp ?? 0,
              borrowing_rate_bps_hour_fp: flat.borrowing_rate_bps_hour_fp ?? 0,
              ts: flat.ts ?? Date.now(),
            };
            // Buffer update instead of direct setState
            snapshotsBufferRef.current[snapshot.symbol] = snapshot;
            scheduleUpdate();
          }

          if (flat.event_type === 'PositionSnapshot' && flat.symbol && flat.side) {
            const pos: PositionSnapshot = {
              symbol: flat.symbol,
              side: flat.side,
              size_usd: flat.size_usd ?? 0,
              entry_price: flat.entry_price ?? 0,
              current_price: flat.current_price ?? 0,
              unrealized_pnl: flat.unrealized_pnl ?? 0,
              liquidation_price: flat.liquidation_price ?? 0,
              leverage_actual: flat.leverage_actual ?? 1,
              is_liquidatable: flat.is_liquidatable ?? false,
            };
            // Buffer position update
            const existingIdx = positionsBufferRef.current.findIndex(
              (p) => p.symbol === pos.symbol && p.side === pos.side,
            );
            if (existingIdx >= 0) {
              positionsBufferRef.current[existingIdx] = pos;
            } else {
              positionsBufferRef.current.push(pos);
            }

            // Also buffer price from PositionSnapshot
            if (flat.current_price && flat.symbol) {
              pricesBufferRef.current[flat.symbol] = {
                symbol: flat.symbol,
                price_min: flat.current_price,
                price_max: flat.current_price,
                ts: flat.ts ?? Date.now(),
              };
            }
            scheduleUpdate();
          }

          return;
        }

        // Handle nested format (OracleTick, MarketSnapshot as keys)
        const nested = rawPayload as unknown as NestedEventPayload;

        if (nested.OracleTick) {
          const tick = nested.OracleTick;
          pricesBufferRef.current[tick.symbol] = tick;
          scheduleUpdate();
        }

        if (nested.MarketSnapshot) {
          const snapshot = nested.MarketSnapshot;
          snapshotsBufferRef.current[snapshot.symbol] = snapshot;
          scheduleUpdate();
        }

        if (nested.PositionSnapshot) {
          const pos = nested.PositionSnapshot;
          const existingIdx = positionsBufferRef.current.findIndex(
            (p) => p.symbol === pos.symbol && p.side === pos.side,
          );
          if (existingIdx >= 0) {
            positionsBufferRef.current[existingIdx] = pos;
          } else {
            positionsBufferRef.current.push(pos);
          }
          scheduleUpdate();
        }
      }

      if (message.type === 'Response') {
        const data = (message.payload as { data?: PreviewResponse })?.data;
        if (data && 'liquidation_price' in data) {
          setPreviewResponse(data);
        }
      }

      if (message.type === 'Error') {
        console.error('[SimWS] Error:', message.payload);
      }
    };

    connect();

    return () => {
      mountedRef.current = false;

      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Cancel pending RAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
    };
  }, [wsUrl, scheduleUpdate]);

  // Send preview request
  const requestPreview = useCallback((symbol: string, side: 'long' | 'short', qty: number, leverage: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const request: PreviewRequest = {
      action: 'preview',
      symbol,
      side,
      qty,
      leverage,
    };

    wsRef.current.send(JSON.stringify(request));
  }, []);

  // Memoized market data for UI - stable reference unless data actually changes
  const marketData = useMemo((): SimMarketData[] => {
    return Object.keys(SYMBOL_CONFIG).map((apiSymbol) => {
      const config = SYMBOL_CONFIG[apiSymbol];
      const tick = prices[apiSymbol];
      const snapshot = marketSnapshots[apiSymbol];

      // Calculate mid price and convert from micro-USD to USD
      const priceMin = tick ? tick.price_min / MICRO_TO_USD : 0;
      const priceMax = tick ? tick.price_max / MICRO_TO_USD : 0;
      const price = tick ? (priceMin + priceMax) / 2 : 0;

      // Convert OI and liquidity from micro-USD to USD
      const oiLong = snapshot ? snapshot.oi_long_usd / MICRO_TO_USD : 0;
      const oiShort = snapshot ? snapshot.oi_short_usd / MICRO_TO_USD : 0;
      const liquidity = snapshot ? snapshot.liquidity_usd / MICRO_TO_USD : 0;

      // Convert rates from bps*1e6 to percentage
      const fundingRate = snapshot ? snapshot.funding_rate_bps_hour_fp * BPS_FP_TO_PERCENT : 0;
      const borrowingRate = snapshot ? snapshot.borrowing_rate_bps_hour_fp * BPS_FP_TO_PERCENT : 0;

      return {
        symbol: apiSymbol,
        displaySymbol: config.displaySymbol,
        baseAsset: config.baseAsset,
        quoteAsset: config.quoteAsset,
        price,
        priceMin,
        priceMax,
        openInterestLong: oiLong,
        openInterestShort: oiShort,
        liquidityLong: liquidity,
        liquidityShort: liquidity,
        fundingRatePerHour: fundingRate,
        borrowingRatePerHour: borrowingRate,
        ts: tick?.ts || 0,
      };
    });
  }, [prices, marketSnapshots]);

  // Memoized positions for UI (converted to USD)
  const processedPositions = useMemo((): PositionSnapshot[] => {
    return positions.map((pos) => ({
      ...pos,
      size_usd: pos.size_usd / MICRO_TO_USD,
      entry_price: pos.entry_price / MICRO_TO_USD,
      current_price: pos.current_price / MICRO_TO_USD,
      unrealized_pnl: pos.unrealized_pnl / MICRO_TO_USD,
      liquidation_price: pos.liquidation_price / MICRO_TO_USD,
    }));
  }, [positions]);

  // Memoized preview response (converted to USD)
  const processedPreview = useMemo((): PreviewResponse | null => {
    if (!previewResponse) return null;
    return {
      ...previewResponse,
      size_usd: previewResponse.size_usd / MICRO_TO_USD,
      collateral: previewResponse.collateral / MICRO_TO_USD,
      entry_price: previewResponse.entry_price / MICRO_TO_USD,
      current_price: previewResponse.current_price / MICRO_TO_USD,
      liquidation_price: previewResponse.liquidation_price / MICRO_TO_USD,
      funding_fee_usd: (previewResponse.funding_fee_usd ?? 0) / MICRO_TO_USD,
      borrowing_fee_usd: (previewResponse.borrowing_fee_usd ?? 0) / MICRO_TO_USD,
      price_impact_usd: (previewResponse.price_impact_usd ?? 0) / MICRO_TO_USD,
      close_fees_usd: (previewResponse.close_fees_usd ?? 0) / MICRO_TO_USD,
    };
  }, [previewResponse]);

  // Stable getter functions that don't change reference
  const getMarketData = useCallback(() => marketData, [marketData]);
  const getPositions = useCallback(() => processedPositions, [processedPositions]);
  const getPreview = useCallback(() => processedPreview, [processedPreview]);

  return {
    isConnected,
    error,
    // Raw data (avoid using directly - causes re-renders)
    prices,
    marketSnapshots,
    positions,
    previewResponse,
    // Processed data (memoized - use these!)
    marketData,
    processedPositions,
    processedPreview,
    // Legacy getter functions (for backwards compatibility)
    getMarketData,
    getPositions,
    getPreview,
    // Actions
    requestPreview,
    // Config
    SYMBOL_CONFIG,
  };
}
