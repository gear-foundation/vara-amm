import { useState } from 'react';

import { MarketHeader } from './components/market-header';
import { PositionsTable } from './components/positions-table';
import { TradingPanel } from './components/trading-panel';
import { TradingViewChart } from './components/trading-view-chart';

export type Market = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  change24h: number;
  volume24h: number;
  openInterestLong: number;
  openInterestShort: number;
  availableLiquidityLong: number;
  availableLiquidityShort: number;
  fundingRate: number;
  nextFundingTime: number;
  // TradingView integration
  tradingViewSymbol: string;
  // Contract integration
  marketIndex: number;
};

const MOCK_MARKETS: Market[] = [
  {
    symbol: 'BTC/USD',
    baseAsset: 'BTC',
    quoteAsset: 'USDC',
    price: 89548.88,
    change24h: -0.03,
    volume24h: 50500000,
    openInterestLong: 18100000,
    openInterestShort: 14600000,
    availableLiquidityLong: 65300000,
    availableLiquidityShort: 69100000,
    fundingRate: -0.0017,
    nextFundingTime: Date.now() + 3600000,
    // TradingView - Binance BTC/USDT
    tradingViewSymbol: 'BINANCE:BTCUSDT',
    // Contract market index
    marketIndex: 0,
  },
  {
    symbol: 'ETH/USD',
    baseAsset: 'ETH',
    quoteAsset: 'USDC',
    price: 3245.67,
    change24h: 1.24,
    volume24h: 28300000,
    openInterestLong: 12500000,
    openInterestShort: 9800000,
    availableLiquidityLong: 42100000,
    availableLiquidityShort: 38700000,
    fundingRate: 0.0023,
    nextFundingTime: Date.now() + 3600000,
    // TradingView - Binance ETH/USDT
    tradingViewSymbol: 'BINANCE:ETHUSDT',
    // Contract market index
    marketIndex: 1,
  },
];

function Futures() {
  const [selectedMarket, setSelectedMarket] = useState<Market>(MOCK_MARKETS[0]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Market Header */}
      <MarketHeader market={selectedMarket} markets={MOCK_MARKETS} onMarketChange={setSelectedMarket} />

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
