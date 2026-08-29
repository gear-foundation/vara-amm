import { BarChart3, Clock } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/utils/currency';

import type { Market } from '../index';

type ChartPlaceholderProps = {
  market: Market;
};

const TIME_FRAMES = ['1m', '5m', '15m', '1h', '4h', 'D', 'W', 'M'];

export function ChartPlaceholder({ market }: ChartPlaceholderProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');

  return (
    <Card className="card h-full flex flex-col">
      {/* Chart Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-500/10">
        <div className="flex items-center space-x-4">
          {/* Price/Depth Toggle */}
          <div className="flex rounded-lg bg-gray-500/10 p-1">
            <button className="px-3 py-1 rounded-md text-sm font-medium bg-[#00FF85]/20 text-[#00FF85]">Price</button>
            <button className="px-3 py-1 rounded-md text-sm font-medium text-gray-400 hover:text-white transition-colors">
              Depth
            </button>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center space-x-1">
            {TIME_FRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors',
                  selectedTimeframe === tf
                    ? 'bg-[#00FF85]/20 text-[#00FF85]'
                    : 'text-gray-400 hover:text-white hover:bg-gray-500/10',
                )}>
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Tools */}
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
            <BarChart3 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
            Indicators
          </Button>
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 flex items-center justify-center min-h-[400px] relative">
        {/* Placeholder Content */}
        <div className="text-center">
          <BarChart3 className="w-16 h-16 text-gray-500/30 mx-auto mb-4" />
          <p className="text-gray-400 text-lg font-medium mb-2">{market.symbol} Chart</p>
          <p className="text-gray-500 text-sm">TradingView integration coming soon</p>
          <div className="flex items-center justify-center mt-4 text-gray-500 text-xs">
            <Clock className="w-3 h-3 mr-1" />
            <span>Real-time price data</span>
          </div>
        </div>

        {/* Mock Chart Grid */}
        <div className="absolute inset-4 pointer-events-none">
          {/* Horizontal Lines */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`h-${i}`}
              className="absolute w-full border-t border-gray-500/5"
              style={{ top: `${(i + 1) * 20}%` }}
            />
          ))}
          {/* Vertical Lines */}
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={`v-${i}`}
              className="absolute h-full border-l border-gray-500/5"
              style={{ left: `${(i + 1) * 10}%` }}
            />
          ))}
        </div>

        {/* Price Scale (right) */}
        <div className="absolute right-4 top-4 bottom-4 flex flex-col justify-between text-xs text-gray-500 mono">
          <span>{formatPrice(market.price * 1.01)}</span>
          <span>{formatPrice(market.price * 1.005)}</span>
          <span className="text-[#00FF85]">{formatPrice(market.price)}</span>
          <span>{formatPrice(market.price * 0.995)}</span>
          <span>{formatPrice(market.price * 0.99)}</span>
        </div>
      </div>

      {/* Time Scale (bottom) */}
      <div className="flex justify-between px-8 py-2 text-xs text-gray-500 border-t border-gray-500/10">
        <span>12:00</span>
        <span>13:00</span>
        <span>14:00</span>
        <span>15:00</span>
        <span>16:00</span>
        <span>17:00</span>
      </div>
    </Card>
  );
}
