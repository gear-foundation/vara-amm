'use client';

import { useAccount } from '@gear-js/react-hooks';
import { ArrowDownUp, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { INPUT_PERCENTAGES } from '@/consts';
import { usePairsBalances } from '@/features/pair';
import { Token, Network, PairsTokens } from '@/features/pair/types';
import {
  calculatePercentage,
  formatUnits,
  getFormattedBalance,
  getNetworks,
  getSelectedPair,
  parseUnits,
} from '@/features/pair/utils';
import { WalletConnect } from '@/features/wallet';
import { usePairsQuery } from '@/lib/sails';

import { TokenSelector } from './token-selector';
import { TradePageBuy } from './trade-page-buy';
import { TradePageSell } from './trade-page-sell';

type TradePageProps = {
  pairsTokens: PairsTokens;
};

export function TradePage({ pairsTokens }: TradePageProps) {
  const [fromToken, setFromToken] = useState<Token>(pairsTokens[0].token0);
  const [toToken, setToToken] = useState<Token>(pairsTokens[0].token1);
  const [lastInputTouch, setLastInputTouch] = useState<'from' | 'to'>('from');

  const { pairs } = usePairsQuery();
  const { pairBalances, refetchPairBalances, pairPrograms } = usePairsBalances({ pairs });
  const { pairAddress, isPairReverse, pairIndex } = getSelectedPair(pairsTokens, fromToken, toToken) || {};

  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [showFromTokenSelector, setShowFromTokenSelector] = useState(false);
  const [showToTokenSelector, setShowToTokenSelector] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { account } = useAccount();

  const isWalletConnected = !!account;
  const [isOpenConnectWallet, setIsOpenConnectWallet] = useState(false);
  const openConnectWallet = () => setIsOpenConnectWallet(true);
  const closeConnectWallet = () => setIsOpenConnectWallet(false);

  const swapTokens = () => {
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  const handleFromTokenSelect = (token: Token, network: Network) => {
    setFromToken({ ...token, network: network.name });
  };

  const handleToTokenSelect = (token: Token, network: Network) => {
    setToToken({ ...token, network: network.name });
  };

  const handleSwap = () => {
    if (!isWalletConnected) {
      openConnectWallet();
    } else {
      // Handle swap logic here
      console.log('Executing swap...');
    }
  };

  const getSwapDirection = () => {
    if (fromToken.network === toToken.network) {
      return `${fromToken.network}`;
    }
    return `${fromToken.network} → ${toToken.network}`;
  };

  const calculateFeeInUSD = () => {
    // TODO: remove mock
    const ETH_PRICE = 2500;
    const FEE = 0.003;
    const mockFeeUSD = Number.parseFloat(fromAmount || '0') * FEE * ETH_PRICE;
    return mockFeeUSD.toFixed(2);
  };

  const networks = getNetworks(pairsTokens);

  const getAmount = async (amount: string, isReverse?: boolean) => {
    if (pairIndex === undefined || !pairPrograms) return '';
    const pairProgram = pairPrograms[pairIndex];
    const isToken0ToToken1 = isReverse ? !isPairReverse : isPairReverse;
    const decimalsIn = isToken0ToToken1 ? toToken.decimals : fromToken.decimals;
    const decimalsOut = isToken0ToToken1 ? fromToken.decimals : toToken.decimals;
    const amountIn = parseUnits(amount, decimalsIn);

    let amountOut = 0n;
    if (isToken0ToToken1) {
      amountOut = await pairProgram.pair.getAmountIn(amountIn, isToken0ToToken1);
    } else {
      amountOut = await pairProgram.pair.getAmountOut(amountIn, !isToken0ToToken1);
    }

    return formatUnits(amountOut, decimalsOut);
  };

  return (
    <div className="max-w-md mx-auto">
      <Tabs defaultValue="swap" className="w-full">
        <TabsList className="grid w-full grid-cols-3 card p-1">
          <TabsTrigger
            value="swap"
            className="data-[state=active]:bg-[#00FF85] data-[state=active]:text-black font-bold uppercase">
            SWAP
          </TabsTrigger>
          <TabsTrigger
            value="buy"
            className="data-[state=active]:bg-[#00FF85] data-[state=active]:text-black font-bold uppercase">
            BUY
          </TabsTrigger>
          <TabsTrigger
            value="sell"
            className="data-[state=active]:bg-[#00FF85] data-[state=active]:text-black font-bold uppercase">
            SELL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="swap" className="mt-6">
          <Card className="card">
            <CardHeader className="pb-4">{/* Removed SWAP TOKENS title and settings gear icon */}</CardHeader>
            <CardContent className="space-y-4">
              {/* From Token */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>FROM</span>
                  <span>
                    Balance:{' '}
                    {fromToken.balance
                      ? getFormattedBalance(fromToken.balance, fromToken.decimals, fromToken.symbol)
                      : '0'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Input
                    value={fromAmount}
                    onChange={async (e) => {
                      setLastInputTouch('from');
                      setFromAmount(e.target.value);
                      const amountOut = await getAmount(e.target.value);
                      setToAmount(amountOut);
                    }}
                    placeholder="0.0"
                    className="input-field flex-1 text-xl"
                  />
                  <Button
                    onClick={() => setShowFromTokenSelector(true)}
                    className="btn-secondary flex items-center space-x-2 min-w-[120px]">
                    <img
                      src={fromToken.logoURI || '/placeholder.svg'}
                      alt={fromToken.name}
                      className="w-5 h-5 rounded-full"
                    />
                    <span>{fromToken.symbol}</span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex space-x-2">
                  {INPUT_PERCENTAGES.map(({ label, value }) => (
                    <Button
                      key={value}
                      variant="ghost"
                      size="sm"
                      className="text-xs bg-gray-500/20 hover:bg-gray-500/30 theme-text"
                      onClick={async () => {
                        const amountIn = formatUnits(
                          calculatePercentage(fromToken.balance || 0n, value),
                          fromToken.decimals || 0,
                        );
                        const amountOut = await getAmount(amountIn);
                        setFromAmount(amountIn);
                        setToAmount(amountOut);
                        setLastInputTouch('from');
                      }}>
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Swap Button */}
              <div className="flex justify-center">
                <Button
                  onClick={swapTokens}
                  variant="ghost"
                  size="icon"
                  className="rounded-full bg-gray-500/20 border-2 border-gray-500/30 hover:border-[#00FF85] hover:bg-[#00FF85]/10 theme-text hover:text-[#00FF85] transition-all duration-200">
                  <ArrowDownUp className="w-4 h-4" />
                </Button>
              </div>

              {/* To Token */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>TO</span>
                  <span>
                    Balance:{' '}
                    {toToken.balance ? getFormattedBalance(toToken.balance, toToken.decimals, toToken.symbol) : '0'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Input
                    value={toAmount}
                    onChange={async (e) => {
                      setLastInputTouch('to');
                      setToAmount(e.target.value);
                      const amountIn = await getAmount(e.target.value, true);
                      setFromAmount(amountIn);
                    }}
                    placeholder="0.0"
                    className="input-field flex-1 text-xl"
                  />
                  <Button
                    onClick={() => setShowToTokenSelector(true)}
                    className="btn-secondary flex items-center space-x-2 min-w-[120px]">
                    <img
                      src={toToken.logoURI || '/placeholder.svg'}
                      alt={toToken.name}
                      className="w-5 h-5 rounded-full"
                    />
                    <span>{toToken.symbol}</span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Expandable Details Block */}
              <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-500/5 transition-colors">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm theme-text">
                      1 {fromToken.symbol} = 1,250 {toToken.symbol}
                      {/* TODO: remove mock */}
                    </span>
                    <Info className="w-3 h-3 text-gray-400" />
                  </div>
                  {showDetails ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {showDetails && (
                  <div className="px-3 pb-3 space-y-2 border-t border-gray-500/10">
                    <div className="flex justify-between text-sm pt-2">
                      <span className="text-gray-400">Fee (0.3%)</span>
                      <span className="theme-text">${calculateFeeInUSD()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Swap direction</span>
                      <span className="theme-text">{getSwapDirection()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Max slippage</span>
                      <span className="theme-text">Auto 0.50%</span>
                    </div>
                  </div>
                )}
              </div>

              <Button onClick={handleSwap} className="btn-primary w-full py-4 text-lg">
                {isWalletConnected ? 'SWAP TOKENS' : 'CONNECT WALLET'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="buy" className="mt-6">
          <TradePageBuy />
        </TabsContent>

        <TabsContent value="sell" className="mt-6">
          <TradePageSell />
        </TabsContent>
      </Tabs>

      <TokenSelector
        isOpen={showFromTokenSelector}
        onClose={() => setShowFromTokenSelector(false)}
        onSelectToken={handleFromTokenSelect}
        selectedToken={fromToken}
        title="Select token to swap from"
        networks={networks}
      />

      <TokenSelector
        isOpen={showToTokenSelector}
        onClose={() => setShowToTokenSelector(false)}
        onSelectToken={handleToTokenSelect}
        selectedToken={toToken}
        title="Select token to swap to"
        networks={networks}
      />

      <WalletConnect isOpen={isOpenConnectWallet} onClose={closeConnectWallet} />
    </div>
  );
}
