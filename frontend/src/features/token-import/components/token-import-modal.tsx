import { useState } from 'react';

import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogContent,
  Address,
  Button,
  DialogDescription,
  TokenCustomIcon,
} from '@/components';
import { Token } from '@/features/pair/types';
import { openBlockExplorer } from '@/utils';

type Props = {
  customToken: Token | null;
  isOpen: boolean;
  onClose: () => void;
  onAddNewToken: (token: Token) => void;
};

const TokenImportModal = ({ customToken, isOpen, onClose, onAddNewToken }: Props) => {
  const [importRisksAccepted, setImportRisksAccepted] = useState(false);

  const handleImportToken = () => {
    if (customToken && importRisksAccepted) {
      onAddNewToken(customToken);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="card max-w-md mx-auto z-[60]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold uppercase theme-text">Token Import</DialogTitle>
        </DialogHeader>

        {customToken && (
          <div className="space-y-4">
            <div className="space-y-4">
              <DialogDescription className="text-sm text-gray-400">
                Custom tokens on Vara can be created by anyone, using arbitrary names and symbols. Some may resemble
                well-known assets but have no affiliation with them.
              </DialogDescription>

              <p className="text-sm text-gray-400">
                This interface allows adding any fungible token by its contract address. Please double-check the
                contract source before interacting.
              </p>

              <p className="text-sm text-yellow-400">
                Be cautious — if you provide liquidity or swap an unverified token, there is a risk you won&apos;t be
                able to trade it back.
              </p>

              <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <TokenCustomIcon symbol={customToken.symbol} className="w-10 h-10 rounded-full" />
                  <div>
                    <div className="font-medium theme-text">{customToken.name}</div>
                    <div className="text-sm text-gray-400">{customToken.symbol}</div>
                  </div>
                </div>

                <Address
                  address={customToken.address}
                  shortened={false}
                  className="mb-2"
                  size="small"
                  hoverCopyButton={false}
                />

                <button
                  onClick={() => openBlockExplorer(customToken.address)}
                  tabIndex={-1}
                  className="text-xs text-[#00FF85] hover:underline">
                  View on Block Explorer
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="risks-checkbox"
                  checked={importRisksAccepted}
                  onChange={(e) => setImportRisksAccepted(e.target.checked)}
                />
                <label htmlFor="risks-checkbox" className="text-sm text-gray-400">
                  I understand the risks
                </label>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={() => {
                  setImportRisksAccepted(false);
                  onClose();
                }}
                variant="secondary"
                className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleImportToken} disabled={!importRisksAccepted} className="flex-1">
                Continue
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export { TokenImportModal };
