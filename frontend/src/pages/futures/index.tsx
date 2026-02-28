import { useCallback, useMemo, useState } from 'react';

import { useSimWsContext } from '@/features/sim';

import { MarketHeader } from './components/market-header';
import { PositionsTable } from './components/positions-table';
import { TradingPanel } from './components/trading-panel';
import { TradingViewChart } from './components/trading-view-chart';

export type Market = {
  symbol: string; // Display symbol: BTC/USD
  apiSymbol: string; // API symbol for sim-engine: BTC-USD
  baseAsset: string;
  quoteAsset: string;
  price: number;
  change24h: number;
  volume24h: number;
  openInterestLong: number;
  openInterestShort: number;
  availableLiquidityLong: number;
  availableLiquidityShort: number;
  // Rates as percentage per hour (e.g., 0.01 = 0.01%/hour)
  fundingRatePerHour: number; // signed - can be positive or negative
  borrowingRatePerHour: number; // unsigned - always positive
  // TradingView integration
  tradingViewSymbol: string;
  // Contract integration
  marketIndex: number;
};

// Fallback data when WS not connected
const FALLBACK_MARKETS: Market[] = [
  {
    symbol: 'BTC/USD',
    apiSymbol: 'BTC-USD',
    baseAsset: 'BTC',
    quoteAsset: 'USDC',
    price: 0,
    change24h: 0,
    volume24h: 0,
    openInterestLong: 0,
    openInterestShort: 0,
    availableLiquidityLong: 0,
    availableLiquidityShort: 0,
    fundingRatePerHour: 0,
    borrowingRatePerHour: 0,
    tradingViewSymbol: 'BINANCE:BTCUSDT',
    marketIndex: 0,
  },
  {
    symbol: 'ETH/USD',
    apiSymbol: 'ETH-USD',
    baseAsset: 'ETH',
    quoteAsset: 'USDC',
    price: 0,
    change24h: 0,
    volume24h: 0,
    openInterestLong: 0,
    openInterestShort: 0,
    availableLiquidityLong: 0,
    availableLiquidityShort: 0,
    fundingRatePerHour: 0,
    borrowingRatePerHour: 0,
    tradingViewSymbol: 'BINANCE:ETHUSDT',
    marketIndex: 1,
  },
];

function Futures() {
  const { marketData, SYMBOL_CONFIG } = useSimWsContext();
  const [selectedMarketIndex, setSelectedMarketIndex] = useState(0);

  // Build markets from WS data - uses memoized marketData directly
  const markets = useMemo((): Market[] => {
    return Object.entries(SYMBOL_CONFIG).map(([apiSymbol, config]) => {
      const data = marketData.find((d) => d.symbol === apiSymbol);

      return {
        symbol: config.displaySymbol,
        apiSymbol,
        baseAsset: config.baseAsset,
        quoteAsset: config.quoteAsset,
        price: data?.price || 0,
        change24h: 0, // Not available from sim
        volume24h: 0, // Not available from sim
        openInterestLong: data?.openInterestLong || 0,
        openInterestShort: data?.openInterestShort || 0,
        availableLiquidityLong: data?.liquidityLong || 0,
        availableLiquidityShort: data?.liquidityShort || 0,
        fundingRatePerHour: data?.fundingRatePerHour || 0,
        borrowingRatePerHour: data?.borrowingRatePerHour || 0,
        tradingViewSymbol: config.tradingViewSymbol,
        marketIndex: config.marketIndex,
      };
    });
  }, [marketData, SYMBOL_CONFIG]);

  const hasLiveData = useMemo(() => {
    return markets.some(
      (market) =>
        market.price > 0 ||
        market.openInterestLong > 0 ||
        market.openInterestShort > 0 ||
        market.availableLiquidityLong > 0 ||
        market.availableLiquidityShort > 0,
    );
  }, [markets]);

  // Use last known data even if WS reconnects
  const displayMarkets = hasLiveData ? markets : FALLBACK_MARKETS;

  const selectedMarket = displayMarkets[selectedMarketIndex] || displayMarkets[0];

  // Stable callback - won't cause child re-renders
  const handleMarketChange = useCallback(
    (market: Market) => {
      setSelectedMarketIndex((prevIndex) => {
        // Find index in current markets (closure-safe)
        const newIndex = displayMarkets.findIndex((m) => m.apiSymbol === market.apiSymbol);
        return newIndex >= 0 ? newIndex : prevIndex;
      });
    },
    [displayMarkets],
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Market Header */}
      <MarketHeader market={selectedMarket} markets={displayMarkets} onMarketChange={handleMarketChange} />

      {/* Main Content: Chart + Trading Panel */}
      <div className="flex flex-col lg:flex-row gap-4 mt-4 relative z-0">
        {/* Chart Area */}
        <div className="flex-1 min-h-[500px]">
          <TradingViewChart market={selectedMarket} />
        </div>

        {/* Trading Panel */}
        <div className="w-full lg:w-[380px]">
          <TradingPanel market={selectedMarket} />
        </div>
      </div>

      {/* Positions Table */}
      <div className="mt-4">
        <PositionsTable />
      </div>
    </div>
  );
}

export default Futures;
