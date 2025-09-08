import { useAccount } from '@gear-js/react-hooks';
import { Wallet as GearWallet } from '@gear-js/wallet-connect';

import { cn } from '@/lib/utils';

type Props = {
  isFullWidth?: boolean;
};

export function Wallet({ isFullWidth = false }: Props) {
  const { account } = useAccount();

  return (
    <div
      className={cn(
        'w-full [&_button]:w-full mono [&_button]:text-sm [&_button]:space-x-2 [&_button]:rounded-xl [&_button]:px-4 [&_button]:py-2 [&_button]:shadow-none [&_button]:text-inherit [&_button_svg]:w-6 [&_button_svg]:h-6',
        account
          ? '[&_button]:bg-[#00FF85]/10 [&_button]:border [&_button]:border-[#00FF85]/20 [&_button]:border-solid'
          : `[&_button]:btn-primary ${isFullWidth ? '[&_div]:flex-1' : ''}`,
      )}>
      <GearWallet theme="vara" displayBalance={false} />
    </div>
  );
}
