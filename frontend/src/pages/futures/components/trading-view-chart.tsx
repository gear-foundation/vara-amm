import { memo } from 'react';
import { AdvancedRealTimeChart } from 'react-ts-tradingview-widgets';

import type { Market } from '../index';

type TradingViewChartProps = {
  market: Market;
};

// Memoize chart to prevent re-renders unless symbol changes
export const TradingViewChart = memo(
  function TradingViewChart({ market }: TradingViewChartProps) {
    return (
      <div className="tradingview-chart-container h-full min-h-[500px]">
        <AdvancedRealTimeChart
          symbol={market.tradingViewSymbol}
          theme="dark"
          autosize
          interval="60"
          timezone="Etc/UTC"
          style="1"
          locale="en"
          enable_publishing={false}
          hide_top_toolbar={false}
          hide_side_toolbar={true}
          allow_symbol_change={false}
          save_image={false}
          container_id={`tradingview_${market.marketIndex}`}
          withdateranges={true}
          copyrightStyles={{
            parent: { display: 'none' },
          }}
        />
      </div>
    );
  },
  // Custom comparison - only re-render if symbol or index changes
  (prevProps, nextProps) =>
    prevProps.market.tradingViewSymbol === nextProps.market.tradingViewSymbol &&
    prevProps.market.marketIndex === nextProps.market.marketIndex,
);
