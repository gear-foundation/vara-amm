import { ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPrice } from '@/lib/utils/currency';

import type { Market } from '../index';

type MarketHeaderProps = {
  market: Market;
  markets: Market[];
  onMarketChange: (market: Market) => void;
};

export function MarketHeader({ market, markets, onMarketChange }: MarketHeaderProps) {
  const [isMarketSelectorOpen, setIsMarketSelectorOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMarketSelectorOpen(false);
      }
    };

    if (isMarketSelectorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMarketSelectorOpen]);

  const openInterestPercent = Math.round(
    (market.openInterestLong / (market.openInterestLong + market.openInterestShort)) * 100,
  );

  return (
    <Card className="card p-4 relative z-20">
      <div className="flex flex-wrap items-center gap-4 lg:gap-8">
        {/* Market Selector */}
        <div className="relative" ref={dropdownRef}>
          <Button
            variant="secondary"
            onClick={() => setIsMarketSelectorOpen(!isMarketSelectorOpen)}
            className="flex items-center space-x-2 px-3 py-2">
            <div className="w-6 h-6 rounded-full bg-[#F7931A] flex items-center justify-center text-white text-xs font-bold">
              {market.baseAsset.charAt(0)}
            </div>
            <span className="font-bold">{market.symbol}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400">
              [{market.baseAsset}-{market.quoteAsset}]
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </Button>

          {/* Market Dropdown */}
          {isMarketSelectorOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 rounded-xl p-2 shadow-lg z-[60] bg-[#0e0e0e] border border-white/10">
              {markets.map((m) => (
                <button
                  key={m.symbol}
                  onClick={() => {
                    onMarketChange(m);
                    setIsMarketSelectorOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors',
                    m.symbol === market.symbol ? 'bg-[#00FF85]/10 text-[#00FF85]' : 'hover:bg-gray-500/10 theme-text',
                  )}>
                  <div className="w-6 h-6 rounded-full bg-[#F7931A] flex items-center justify-center text-white text-xs font-bold">
                    {m.baseAsset.charAt(0)}
                  </div>
                  <span className="font-medium">{m.symbol}</span>
                  <span className={cn('ml-auto text-sm', m.change24h >= 0 ? 'text-green-500' : 'text-red-500')}>
                    {m.change24h >= 0 ? '+' : ''}
                    {m.change24h.toFixed(2)}%
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Price */}
        <div className="flex flex-col">
          <span className="text-lg font-bold mono theme-text">{formatPrice(market.price)}</span>
          <span className={cn('text-sm flex items-center', market.change24h >= 0 ? 'text-green-500' : 'text-red-500')}>
            {market.change24h >= 0 ? (
              <TrendingUp className="w-3 h-3 mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 mr-1" />
            )}
            {market.change24h >= 0 ? '+' : ''}
            {market.change24h.toFixed(2)}%
          </span>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-6 text-sm">
          {/* 24H Volume */}
          <div className="flex flex-col">
            <span className="text-gray-400 text-xs uppercase">24H Volume</span>
            <span className="theme-text font-medium mono">{formatCurrency(market.volume24h)}</span>
          </div>

          {/* Open Interest */}
          <div className="flex flex-col">
            <span className="text-gray-400 text-xs uppercase">
              Open Interest ({openInterestPercent}/{100 - openInterestPercent}%)
            </span>
            <div className="flex items-center space-x-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <span className="text-green-500 mono">{formatCurrency(market.openInterestLong)}</span>
              <span className="text-gray-400">/</span>
              <TrendingDown className="w-3 h-3 text-red-500" />
              <span className="text-red-500 mono">{formatCurrency(market.openInterestShort)}</span>
            </div>
          </div>

          {/* Available Liquidity */}
          <div className="flex flex-col">
            <span className="text-gray-400 text-xs uppercase">Available Liquidity</span>
            <div className="flex items-center space-x-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <span className="text-green-500 mono">{formatCurrency(market.availableLiquidityLong)}</span>
              <span className="text-gray-400">/</span>
              <TrendingDown className="w-3 h-3 text-red-500" />
              <span className="text-red-500 mono">{formatCurrency(market.availableLiquidityShort)}</span>
            </div>
          </div>

          {/* Funding Rate */}
          <div className="flex flex-col">
            <span className="text-gray-400 text-xs uppercase">Net Rate / 1H</span>
            <div className="flex items-center space-x-1">
              <TrendingDown className="w-3 h-3 text-red-500" />
              <span className="text-red-500 mono">{(market.fundingRate * 100).toFixed(4)}%</span>
              <span className="text-gray-400">/</span>
              <TrendingUp className="w-3 h-3 text-green-500" />
              <span className="text-green-500 mono">+{(Math.abs(market.fundingRate) * 100).toFixed(4)}%</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
