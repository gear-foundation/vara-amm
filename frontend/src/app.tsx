import { useAccount, useApi } from '@gear-js/react-hooks';

import { withProviders } from '@/app/hocs';
import { Loader } from '@/components/ui/loader';
import { useAccountAvailableBalanceSync } from '@/features/wallet/hooks';

import { useFactoryProgram } from '@/lib/sails';
import { Routing } from './pages';

function Component() {
  const { isApiReady } = useApi();
  const { isAccountReady } = useAccount();
  const program = useFactoryProgram();

  useAccountAvailableBalanceSync();

  const isAppReady = isApiReady && isAccountReady && program;

  return <main>{isAppReady ? <Routing /> : <Loader size="lg" text="Loading..." className="py-20" />}</main>;
}

export const App = withProviders(Component);
