'use client';

import { ArrowDownUp, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { TokenSelector } from './token-selector';

interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI: string;
  balance?: string;
  network?: string;
}

interface Network {
  id: string;
  name: string;
  chainId: number;
  logoURI: string;
  tokens: Token[];
}

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
  const [isWalletConnected, setIsWalletConnected] = useState(false);

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

  const connectWallet = () => {
    setIsWalletConnected(true);
  };

  const handleSwap = () => {
    if (!isWalletConnected) {
      connectWallet();
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
          <Card className="card">
            <CardHeader>
              <CardTitle className="text-lg font-bold uppercase theme-text">BUY CRYPTO</CardTitle>
              <p className="text-sm text-gray-400">Choose your preferred provider to buy crypto with fiat</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {/* Coinbase */}
                <button className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">C</span>
                    </div>
                    <div className="text-left">
                      <div className="font-medium theme-text">Coinbase</div>
                      <div className="text-xs text-gray-400">Popular & trusted</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
                </button>

                {/* BANXA */}
                <button className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">B</span>
                    </div>
                    <div className="text-left">
                      <div className="font-medium theme-text">BANXA</div>
                      <div className="text-xs text-gray-400">Fast onboarding</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
                </button>

                {/* Gate.io */}
                <button className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">G</span>
                    </div>
                    <div className="text-left">
                      <div className="font-medium theme-text">Gate.io</div>
                      <div className="text-xs text-gray-400">Global exchange</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
                </button>

                {/* Crypto.com */}
                <button className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">C</span>
                    </div>
                    <div className="text-left">
                      <div className="font-medium theme-text">Crypto.com</div>
                      <div className="text-xs text-gray-400">Card & app integration</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
                </button>

                {/* MEXC */}
                <button className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">M</span>
                    </div>
                    <div className="text-left">
                      <div className="font-medium theme-text">MEXC</div>
                      <div className="text-xs text-gray-400">Low fees</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
                </button>

                {/* BitMart */}
                <button className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">B</span>
                    </div>
                    <div className="text-left">
                      <div className="font-medium theme-text">BitMart</div>
                      <div className="text-xs text-gray-400">Multiple payment methods</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
                </button>
              </div>

              <div className="mt-6 p-4 bg-gray-500/10 border border-gray-500/20 rounded-lg">
                <div className="text-sm text-gray-400 mb-2">💡 Pro Tip</div>
                <div className="text-sm theme-text">
                  Compare fees and payment methods across providers to find the best option for your region.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sell" className="mt-6">
          <Card className="card">
            <CardHeader>
              <CardTitle className="text-lg font-bold uppercase theme-text">SELL CRYPTO</CardTitle>
              <p className="text-sm text-gray-400">Choose your preferred exchange to sell crypto for fiat</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {/* Coinbase */}
                <button className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">C</span>
                    </div>
                    <div className="text-left">
                      <div className="font-medium theme-text">Coinbase</div>
                      <div className="text-xs text-gray-400">Instant cashout available</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
                </button>

                {/* BANXA */}
                <button className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">B</span>
                    </div>
                    <div className="text-left">
                      <div className="font-medium theme-text">BANXA</div>
                      <div className="text-xs text-gray-400">Bank transfer support</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
                </button>

                {/* Gate.io */}
                <button className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">G</span>
                    </div>
                    <div className="text-left">
                      <div className="font-medium theme-text">Gate.io</div>
                      <div className="text-xs text-gray-400">P2P trading available</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
                </button>

                {/* Crypto.com */}
                <button className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">C</span>
                    </div>
                    <div className="text-left">
                      <div className="font-medium theme-text">Crypto.com</div>
                      <div className="text-xs text-gray-400">Visa card cashout</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
                </button>

                {/* MEXC */}
                <button className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">M</span>
                    </div>
                    <div className="text-left">
                      <div className="font-medium theme-text">MEXC</div>
                      <div className="text-xs text-gray-400">Competitive rates</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
                </button>

                {/* BitMart */}
                <button className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">B</span>
                    </div>
                    <div className="text-left">
                      <div className="font-medium theme-text">BitMart</div>
                      <div className="text-xs text-gray-400">Multiple withdrawal options</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
                </button>
              </div>

              <div className="mt-6 p-4 bg-gray-500/10 border border-gray-500/20 rounded-lg">
                <div className="text-sm text-gray-400 mb-2">⚠️ Important</div>
                <div className="text-sm theme-text">
                  Always verify withdrawal fees and processing times before selling. Some exchanges may require KYC
                  verification.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Token Selectors */}
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
    </div>
  );
}
