import { HexString } from '@gear-js/api';
import { Search, Check } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, Input, Address, TokenIcon } from '@/components';
import type { Network, Token } from '@/features/pair/types';
import { getFormattedBalance } from '@/features/pair/utils';

interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToken: (token: Token, network: Network) => void;
  title?: string;
  networks: Network[];
  disabledTokenAddress?: HexString;
  onSearch?: (query: string) => void;
}

export function TokenSelector({
  isOpen,
  onClose,
  onSelectToken,
  title = 'Select a token',
  networks,
  disabledTokenAddress,
  onSearch,
}: TokenSelectorProps) {
  const [selectedNetworkId, setSelectedNetworkId] = useState<string>(networks[0].id);
  const selectedNetwork = networks.find((network) => network.id === selectedNetworkId)!;
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTokens = selectedNetwork.tokens.filter(
    (token) =>
      (token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.displaySymbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.address.toLowerCase().includes(searchQuery.toLowerCase())) &&
      token.address !== disabledTokenAddress,
  );

  const handleTokenSelect = (token: Token) => {
    onSelectToken(token, selectedNetwork);
    onClose();
    setSearchQuery('');
  };

  const handleNetworkSelect = (network: Network) => {
    setSelectedNetworkId(network.id);
  };

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose} aria-describedby="token-selector-dialog">
      <DialogContent className="card max-w-md mx-auto max-h-[80vh] flex flex-col">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg font-bold uppercase theme-text">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col space-y-4 flex-1 overflow-hidden">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search tokens or paste address"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                onSearch?.(e.target.value);
              }}
              className="input-field pl-10"
            />
          </div>

          <div className="flex space-x-4 flex-1 overflow-hidden">
            {/* Token List */}
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-400 uppercase mb-3">Tokens</div>
                {filteredTokens.map((token) => (
                  <button
                    key={token.address}
                    onClick={() => handleTokenSelect(token)}
                    className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-500/10 transition-colors text-left group">
                    <TokenIcon token={token} withBadge />

                    <div className="flex-1 min-w-0">
                      <div className="font-medium theme-text text-base mb-1 leading-none">{token.displaySymbol}</div>

                      <div className="text-sm theme-text mono text-right leading-none">
                        {token.balance ? getFormattedBalance(token.balance, token.decimals) : '0'}
                      </div>

                      <Address address={token.address} />
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
                        <img src={network.logoURI} alt={network.name} className="w-6 h-6 rounded-full" />
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
