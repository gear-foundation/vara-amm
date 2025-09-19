import { Shield } from 'lucide-react';

import { Tooltip, TokenCustomIcon } from '@/components';
import type { Token } from '@/features/pair/types';

interface TokenIconProps {
  token: Pick<Token, 'logoURI' | 'name' | 'isVerified' | 'displaySymbol'>;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  containerClassName?: string;
  withBadge?: boolean;
  withBorder?: boolean;
}

export function TokenIcon({
  token,
  size = 'md',
  className = '',
  containerClassName = '',
  withBadge = false,
  withBorder = false,
}: TokenIconProps) {
  const sizeClasses = {
    xs: 'w-5 h-5 min-w-5 min-h-5',
    sm: 'w-6 h-6 min-w-6 min-h-6',
    md: 'w-8 h-8 min-w-8 min-h-8',
    lg: 'w-12 h-12 min-w-12 min-h-12',
  };

  const badgeClasses = {
    xs: 'w-2 h-2 -top-0.5 -right-0.5',
    sm: 'w-3 h-3 -top-0.5 -right-0.5',
    md: 'w-4 h-4 -top-1 -right-1',
    lg: 'w-5 h-5 -top-1.5 -right-1.5',
  };

  const shieldClasses = {
    xs: 'w-1 h-1',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  const borderClassname = withBorder ? 'border-2 border-gray-500/20' : '';
  const commonClassname = `rounded-full flex-shrink-0 object-cover ${borderClassname}`;

  return (
    <div className={`relative ${containerClassName}`}>
      {token.logoURI ? (
        <img src={token.logoURI} alt={token.name} className={`${commonClassname} ${sizeClasses[size]} ${className}`} />
      ) : (
        <TokenCustomIcon
          symbol={token.displaySymbol}
          className={`${commonClassname} ${sizeClasses[size]} ${className}`}
        />
      )}

      {token.isVerified && withBadge && (
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
