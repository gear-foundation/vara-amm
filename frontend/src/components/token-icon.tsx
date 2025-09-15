import { Shield } from 'lucide-react';

import { Tooltip } from '@/components';
import type { Token } from '@/features/pair/types';

interface TokenIconProps {
  token: Pick<Token, 'logoURI' | 'name' | 'isVerified'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TokenIcon({ token, size = 'md', className = '' }: TokenIconProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 min-w-6 min-h-6',
    md: 'w-8 h-8 min-w-8 min-h-8',
    lg: 'w-12 h-12 min-w-12 min-h-12',
  };

  const badgeClasses = {
    sm: 'w-3 h-3 -top-0.5 -right-0.5',
    md: 'w-4 h-4 -top-1 -right-1',
    lg: 'w-5 h-5 -top-1.5 -right-1.5',
  };

  const shieldClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  return (
    <div className={`relative ${className}`}>
      <img
        src={token.logoURI || '/placeholder.svg'}
        alt={token.name}
        className={`${sizeClasses[size]} rounded-full flex-shrink-0 object-cover`}
      />
      {token.isVerified && (
        <div
          className={`absolute ${badgeClasses[size]} bg-[#00FF85] rounded-full flex items-center justify-center border-2 border-gray-900`}>
          <Tooltip content="Used in Vara Bridge for cross-chain swaps">
            <Shield className={`${shieldClasses[size]} text-black`} />
          </Tooltip>
        </div>
      )}
    </div>
  );
}
