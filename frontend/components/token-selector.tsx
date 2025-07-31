'use client';

import { Search, Check } from 'lucide-react';
import { useState } from 'react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Network, Token } from '@/features/pair/types';

const networks: Network[] = [
  {
    id: 'vara',
    name: 'Vara Network',
    chainId: 1,
    logoURI: '/tokens/vara.png',
    tokens: [
      {
        symbol: 'VARA',
        name: 'Vara Token',
        address: '0x...',
        decimals: 18,
        logoURI: '/tokens/vara.png',
        balance: '1,234.56',
      },
      {
        symbol: 'WETH',
        name: 'Wrapped Ethereum',
        address: '0x...',
        decimals: 18,
        logoURI: '/tokens/eth.png',
        balance: '2.45',
      },
      {
        symbol: 'WUSDT',
        name: 'Wrapped USDT',
        address: '0x...',
        decimals: 6,
        logoURI: '/tokens/usdt.png',
        balance: '5,678.90',
      },
      {
        symbol: 'WUSDC',
        name: 'Wrapped USDC',
        address: '0x...',
        decimals: 6,
        logoURI: '/tokens/usdc.png',
        balance: '3,456.78',
      },
    ],
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    logoURI: '/tokens/eth.png',
    tokens: [
      {
        symbol: 'WVARA',
        name: 'Wrapped VARA',
        address: '0x...',
        decimals: 18,
        logoURI: '/tokens/vara.png',
        balance: '0.00',
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        address: '0x...',
        decimals: 18,
        logoURI: '/tokens/eth.png',
        balance: '2.5',
      },
      {
        symbol: 'USDT',
        name: 'Tether USD',
        address: '0x...',
        decimals: 6,
        logoURI: '/tokens/usdt.png',
        balance: '1,000.00',
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0x...',
        decimals: 6,
        logoURI: '/tokens/usdc.png',
        balance: '500.00',
      },
    ],
  },
];

interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToken: (token: Token, network: Network) => void;
  selectedToken?: Token;
  title?: string;
}

export function TokenSelector({
  isOpen,
  onClose,
  onSelectToken,
  selectedToken,
  title = 'Select a token',
}: TokenSelectorProps) {
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(networks[0]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTokens = selectedNetwork.tokens.filter(
    (token) =>
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleTokenSelect = (token: Token) => {
    onSelectToken(token, selectedNetwork);
    onClose();
    setSearchQuery('');
  };

  const handleNetworkSelect = (network: Network) => {
    setSelectedNetwork(network);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="card max-w-md mx-auto max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg font-bold uppercase theme-text">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col space-y-4 flex-1 overflow-hidden">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search tokens"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          <div className="flex space-x-4 flex-1 overflow-hidden">
            {/* Token List */}
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-400 uppercase">Tokens</div>
                {filteredTokens.map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => handleTokenSelect(token)}
                    className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-500/10 transition-colors text-left">
                    <img src={token.logoURI || '/placeholder.svg'} alt={token.name} className="w-8 h-8 rounded-full" />
                    <div className="flex-1">
                      <div className="font-medium theme-text">{token.symbol}</div>
                      <div className="text-sm text-gray-400">{token.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm theme-text mono">{token.balance}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Network Selection */}
            <div className="w-48 border-l border-gray-500/20 pl-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-400 uppercase">Networks</div>

                {/* Network List */}
                <div className="space-y-1">
                  {networks.map((network) => (
                    <button
                      key={network.id}
                      onClick={() => handleNetworkSelect(network)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-500/10 transition-colors ${
                        selectedNetwork.id === network.id ? 'bg-[#00FF85]/10 border border-[#00FF85]/20' : ''
                      }`}>
                      <div className="flex items-center space-x-2">
                        <img
                          src={network.logoURI || '/placeholder.svg'}
                          alt={network.name}
                          className="w-6 h-6 rounded-full"
                        />
                        <span className="text-sm theme-text">{network.name}</span>
                      </div>
                      {selectedNetwork.id === network.id && <Check className="w-4 h-4 text-[#00FF85]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
