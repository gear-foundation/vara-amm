import { Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

import { Tooltip } from '@/components';
import { useIsMobile } from '@/hooks';
import { copyToClipboard, shortenAddress, openBlockExplorer } from '@/lib/utils';

interface AddressProps {
  address: string;
  className?: string;
  size?: 'small' | 'medium';
  hoverCopyButton?: boolean;
  shortened?: boolean;
  showBlockExplorer?: boolean;
}

export function Address({
  address,
  className = '',
  size = 'medium',
  hoverCopyButton = true,
  showBlockExplorer = true,
  shortened = true,
}: AddressProps) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const isMobile = useIsMobile();

  const handleCopy = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    copyToClipboard({
      value: address,
      successfulText: 'Address copied!',
    });

    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const displayAddress = shortened || isMobile ? shortenAddress(address) : address;

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span className={`text-gray-500 mono ${size === 'small' && !isMobile ? 'text-xxs' : 'text-xs'}`}>
        {displayAddress}
      </span>

      <div className="flex items-center">
        <Tooltip content={copiedAddress === address ? 'Copied!' : 'Copy address'}>
          <div
            role="button"
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleCopy(e);
              }
            }}
            onClick={handleCopy}
            className={`opacity-100 transition-opacity p-1 hover:bg-gray-500/20 rounded ${hoverCopyButton ? 'md:opacity-0 md:group-hover:opacity-100' : ''}`}>
            <Copy className="w-3 h-3 text-gray-400 hover:text-[#00FF85]" />
          </div>
        </Tooltip>

        {showBlockExplorer && (
          <Tooltip content="View on Block Explorer">
            <div
              role="button"
              tabIndex={-1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  openBlockExplorer(address);
                }
              }}
              onClick={() => openBlockExplorer(address)}
              className={`block opacity-100 transition-opacity p-1 hover:bg-gray-500/20 rounded ${hoverCopyButton ? 'md:opacity-0 md:group-hover:opacity-100' : ''}`}>
              <ExternalLink className="w-3 h-3 text-gray-400 hover:text-[#00FF85]" />
            </div>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
