'use client';

import { ArrowDownUp, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Token, Network } from '@/features/pair/types';

import { TokenSelector } from './token-selector';
import { TradePageBuy } from './trade-page-buy';
import { TradePageSell } from './trade-page-sell';
import { WalletConnect } from '@/features/wallet';
import { useAccount } from '@gear-js/react-hooks';

export function TradePage() {
  const [fromToken, setFromToken] = useState<Token>({
    symbol: 'ETH',
    name: 'Ethereum',
    address: '0x...',
    decimals: 18,
    logoURI: '/tokens/eth.png',
    balance: '2.5',
    network: 'Ethereum',
  });
  const [toToken, setToToken] = useState<Token>({
    symbol: 'VARA',
    name: 'Vara Token',
    address: '0x...',
    decimals: 18,
    logoURI: '/tokens/vara.png',
    balance: '0.0',
    network: 'Vara Network',
  });
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
    // Mock calculation - in real app this would be based on actual amounts and prices
    const mockFeeUSD = Number.parseFloat(fromAmount || '0') * 0.003 * 2500; // Assuming ETH price of $2500
    return mockFeeUSD.toFixed(2);
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
                    Balance: {fromToken.balance} {fromToken.symbol}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Input
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
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
                  {['25%', '50%', '75%', 'MAX'].map((percent) => (
                    <Button
                      key={percent}
                      variant="ghost"
                      size="sm"
                      className="text-xs bg-gray-500/20 hover:bg-gray-500/30 theme-text">
                      {percent}
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
                    Balance: {toToken.balance} {toToken.symbol}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Input
                    value={toAmount}
                    onChange={(e) => setToAmount(e.target.value)}
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
      />

      <TokenSelector
        isOpen={showToTokenSelector}
        onClose={() => setShowToTokenSelector(false)}
        onSelectToken={handleToTokenSelect}
        selectedToken={toToken}
        title="Select token to swap to"
      />

      <WalletConnect isOpen={isOpenConnectWallet} onClose={closeConnectWallet} />
    </div>
  );
}
