import { useAccount } from '@gear-js/react-hooks';
import { ChevronDown, Info, Settings } from 'lucide-react';
import { memo, useEffect, useState, useRef, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';
import { Wallet } from '@/components/wallet';
import { useSimWsContext } from '@/features/sim';
import { cn } from '@/lib/utils';

import type { Market } from '../index';

type TradingPanelProps = {
  market: Market;
};

type OrderType = 'market' | 'limit';

const LEVERAGE_PRESETS = [0.1, 1, 2, 5, 10, 25, 50, 100];

// Debounce delay for preview requests (ms)
const PREVIEW_DEBOUNCE_MS = 300;

export const TradingPanel = memo(function TradingPanel({ market }: TradingPanelProps) {
  const { account } = useAccount();
  const { requestPreview, processedPreview } = useSimWsContext();
  const [direction, setDirection] = useState<'long' | 'short' | 'swap'>('long');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [payAmount, setPayAmount] = useState('');
  const [positionSize, setPositionSize] = useState('');
  const [leverage, setLeverage] = useState(2);
  const [limitPrice, setLimitPrice] = useState('');
  const [showTpSl, setShowTpSl] = useState(false);
  const [collateralToken] = useState('USD');

  const isWalletConnected = !!account;
  const preview = processedPreview;

  // Extract stable primitive value to prevent unnecessary effect triggers
  const marketApiSymbol = market.apiSymbol;

  // Debounce ref for preview requests
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Request preview when parameters change (debounced)
  useEffect(() => {
    // Clear previous timeout
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    const qty = parseFloat(positionSize) || 0;
    if (qty > 0 && leverage > 0 && (direction === 'long' || direction === 'short')) {
      // Debounce preview request to avoid spamming on rapid input changes
      previewTimeoutRef.current = setTimeout(() => {
        requestPreview(marketApiSymbol, direction, qty, leverage);
      }, PREVIEW_DEBOUNCE_MS);
    }

    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [marketApiSymbol, direction, positionSize, leverage, requestPreview]);

  const handleLeverageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0.1 && value <= 100) {
      setLeverage(value);
    }
  }, []);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setLeverage(value);
  }, []);

  return (
    <Card className="card overflow-hidden">
      <Tabs value={direction} onValueChange={(v) => setDirection(v as 'long' | 'short' | 'swap')} className="w-full">
        <TabsList className="w-full flex p-0 h-auto rounded-none bg-transparent border-b border-gray-500/20">
          <TabsTrigger
            value="long"
            className="flex-1 py-3 rounded-none data-[state=active]:bg-green-500 data-[state=active]:text-white font-bold uppercase">
            Long
          </TabsTrigger>
          <TabsTrigger
            value="short"
            className="flex-1 py-3 rounded-none data-[state=active]:bg-red-500 data-[state=active]:text-white font-bold uppercase">
            Short
          </TabsTrigger>
          <TabsTrigger
            value="swap"
            className="flex-1 py-3 rounded-none data-[state=active]:bg-gray-500 data-[state=active]:text-white font-bold uppercase">
            Swap
          </TabsTrigger>
        </TabsList>

        <CardContent className="p-4 space-y-4">
          {/* Order Type: Market / Limit */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setOrderType('market')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                  orderType === 'market' ? 'bg-gray-500/20 theme-text' : 'text-gray-400 hover:text-white',
                )}>
                Market
              </button>
              <button
                onClick={() => setOrderType('limit')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                  orderType === 'limit' ? 'bg-gray-500/20 theme-text' : 'text-gray-400 hover:text-white',
                )}>
                Limit
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <Tooltip content={<span className="text-xs">Order settings</span>}>
                <button className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-500/10">
                  <Info className="w-4 h-4" />
                </button>
              </Tooltip>
              <button className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-500/10">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Pay Input */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Pay</span>
              <span className="text-gray-400">Balance: 0.0</span>
            </div>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                placeholder="0.0"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="input-field flex-1 text-xl"
              />
              <Button variant="secondary" className="flex items-center space-x-2 min-w-[100px]">
                <div className="w-5 h-5 rounded-full bg-[#2775CA] flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">$</span>
                </div>
                <span>{collateralToken}</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-right text-xs text-gray-500">$0.00</div>
          </div>

          {/* Position Size (Long/Short only) */}
          <TabsContent value="long" className="mt-0 space-y-4">
            <PositionSizeInput
              direction="long"
              market={market}
              positionSize={positionSize}
              setPositionSize={setPositionSize}
              leverage={leverage}
            />
            {/* Limit Price Input (only when Limit is selected) */}
            {orderType === 'limit' && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Limit Price</span>
                  <span className="text-gray-400">Mark: ${market.price.toLocaleString()}</span>
                </div>
                <Input
                  type="number"
                  placeholder="Price USD"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  className="input-field w-full text-xl"
                />
              </div>
            )}
            <LeverageSlider
              leverage={leverage}
              setLeverage={setLeverage}
              handleLeverageChange={handleLeverageChange}
              handleSliderChange={handleSliderChange}
            />
            <PoolCollateralInfo market={market} collateralToken={collateralToken} />
            <TpSlToggle showTpSl={showTpSl} setShowTpSl={setShowTpSl} />
            {showTpSl && <TpSlInputs />}
            <TradeButton isWalletConnected={isWalletConnected} direction="long" baseAsset={market.baseAsset} />
            <TradeInfo
              liquidationPrice={preview?.liquidation_price}
              priceImpactUsd={preview?.price_impact_usd}
              closeFeesUsd={preview?.close_fees_usd}
            />
          </TabsContent>

          <TabsContent value="short" className="mt-0 space-y-4">
            <PositionSizeInput
              direction="short"
              market={market}
              positionSize={positionSize}
              setPositionSize={setPositionSize}
              leverage={leverage}
            />
            {/* Limit Price Input (only when Limit is selected) */}
            {orderType === 'limit' && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Limit Price</span>
                  <span className="text-gray-400">Mark: ${market.price.toLocaleString()}</span>
                </div>
                <Input
                  type="number"
                  placeholder="Price USD"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  className="input-field w-full text-xl"
                />
              </div>
            )}
            <LeverageSlider
              leverage={leverage}
              setLeverage={setLeverage}
              handleLeverageChange={handleLeverageChange}
              handleSliderChange={handleSliderChange}
            />
            <PoolCollateralInfo market={market} collateralToken={collateralToken} />
            <TpSlToggle showTpSl={showTpSl} setShowTpSl={setShowTpSl} />
            {showTpSl && <TpSlInputs />}
            <TradeButton isWalletConnected={isWalletConnected} direction="short" baseAsset={market.baseAsset} />
            <TradeInfo
              liquidationPrice={preview?.liquidation_price}
              priceImpactUsd={preview?.price_impact_usd}
              closeFeesUsd={preview?.close_fees_usd}
            />
          </TabsContent>

          <TabsContent value="swap" className="mt-0 space-y-4">
            <TradeButton isWalletConnected={isWalletConnected} direction="swap" baseAsset={market.baseAsset} />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
});

// Sub-components

function PositionSizeInput({
  direction,
  market,
  positionSize,
  setPositionSize,
  leverage,
}: {
  direction: 'long' | 'short';
  market: Market;
  positionSize: string;
  setPositionSize: (v: string) => void;
  leverage: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{direction === 'long' ? 'Long' : 'Short'}</span>
      </div>
      <div className="flex items-center space-x-2">
        <Input
          type="number"
          placeholder="0.0"
          value={positionSize}
          onChange={(e) => setPositionSize(e.target.value)}
          className="input-field flex-1 text-xl"
        />
        <Button variant="secondary" className="flex items-center space-x-2 min-w-[100px]">
          <div className="w-5 h-5 rounded-full bg-[#F7931A] flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">₿</span>
          </div>
          <span>{market.baseAsset}/USD</span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>$0.00</span>
        <span>Leverage: {leverage.toFixed(1)}x</span>
      </div>
    </div>
  );
}

function LeverageSlider({
  leverage,
  setLeverage,
  handleLeverageChange,
  handleSliderChange,
}: {
  leverage: number;
  setLeverage: (v: number) => void;
  handleLeverageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSliderChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-3">
        <input
          type="range"
          min="0.1"
          max="100"
          step="0.1"
          value={leverage}
          onChange={handleSliderChange}
          className="flex-1 h-1 bg-gray-500/20 rounded-lg appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-[#00FF85]
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-[#00FF85]
            [&::-moz-range-thumb]:border-none
            [&::-moz-range-thumb]:cursor-pointer"
        />
        <div className="flex items-center bg-gray-500/10 rounded-lg px-2">
          <input
            type="number"
            value={leverage}
            onChange={handleLeverageChange}
            min="0.1"
            max="100"
            step="0.1"
            className="w-12 bg-transparent text-center text-sm theme-text outline-none"
          />
          <span className="text-sm text-gray-400">x</span>
        </div>
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        {LEVERAGE_PRESETS.map((preset) => (
          <button
            key={preset}
            onClick={() => setLeverage(preset)}
            className={cn('hover:text-[#00FF85] transition-colors', leverage === preset && 'text-[#00FF85]')}>
            {preset}x
          </button>
        ))}
      </div>
    </div>
  );
}

function PoolCollateralInfo({ market, collateralToken }: { market: Market; collateralToken: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">Pool</span>
        <span className="theme-text hover:!text-inherit">
          {market.baseAsset}-{market.quoteAsset}
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-400 flex items-center">
          Collateral In
          <Tooltip content={<span className="text-xs">Token used as collateral</span>}>
            <Info className="w-3 h-3 ml-1" />
          </Tooltip>
        </span>
        <span className="text-sm theme-text">{collateralToken}</span>
      </div>
    </div>
  );
}

function TpSlToggle({ showTpSl, setShowTpSl }: { showTpSl: boolean; setShowTpSl: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400">Take Profit / Stop Loss</span>
      <button
        onClick={() => setShowTpSl(!showTpSl)}
        className={cn(
          'w-10 h-5 rounded-full transition-colors relative',
          showTpSl ? 'bg-[#00FF85]' : 'bg-gray-500/30',
        )}>
        <div
          className={cn(
            'absolute w-4 h-4 bg-white rounded-full top-0.5 transition-transform',
            showTpSl ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

function TpSlInputs() {
  return (
    <div className="space-y-3 p-3 bg-gray-500/5 rounded-lg">
      <div className="space-y-1">
        <label htmlFor="take-profit" className="text-xs text-gray-400">
          Take Profit
        </label>
        <Input id="take-profit" type="number" placeholder="Enter price" className="input-field text-sm" />
      </div>
      <div className="space-y-1">
        <label htmlFor="stop-loss" className="text-xs text-gray-400">
          Stop Loss
        </label>
        <Input id="stop-loss" type="number" placeholder="Enter price" className="input-field text-sm" />
      </div>
    </div>
  );
}

function TradeButton({
  isWalletConnected,
  direction,
  baseAsset,
}: {
  isWalletConnected: boolean;
  direction: 'long' | 'short' | 'swap';
  baseAsset: string;
}) {
  if (!isWalletConnected) {
    return <Wallet />;
  }

  const hoverClass =
    direction === 'long'
      ? 'hover:!bg-green-500 hover:!shadow-[0_10px_15px_-3px_rgba(34,197,94,0.2)]'
      : direction === 'short'
        ? 'hover:!bg-red-500 hover:!shadow-[0_10px_15px_-3px_rgba(239,68,68,0.2)]'
        : '';

  return (
    <Button variant="default" disabled={!isWalletConnected} className={cn('w-full py-4 text-lg', hoverClass)}>
      {direction === 'swap' ? 'Swap' : direction === 'long' ? 'Long' : 'Short'} {baseAsset}
    </Button>
  );
}

type TradeInfoProps = {
  liquidationPrice?: number;
  priceImpactUsd?: number;
  closeFeesUsd?: number;
};

function TradeInfo({ liquidationPrice, priceImpactUsd, closeFeesUsd }: TradeInfoProps) {
  const formatPrice = (price: number | undefined) => {
    if (price === undefined || price === null) return '-';
    if (price === 0) return '$0.00';
    return `$${Math.abs(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatImpact = (impact: number | undefined) => {
    if (impact === undefined || impact === null) return '-';
    const sign = impact >= 0 ? '' : '-';
    return `${sign}$${Math.abs(impact).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-2 pt-2 border-t border-gray-500/10">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">Liquidation Price</span>
        <span className="theme-text">{formatPrice(liquidationPrice)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">Price Impact / Fees</span>
        <span className="theme-text">
          {formatImpact(priceImpactUsd)} / {formatPrice(closeFeesUsd)}
        </span>
      </div>
      <button className="flex items-center justify-between w-full text-sm text-gray-400 hover:text-white">
        <span>Execution Details</span>
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  );
}
