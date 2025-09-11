import { useAccount, useApi } from '@gear-js/react-hooks';

import { withProviders } from '@/app/hocs';
import { Navigation } from '@/components/navigation';
import { Loader } from '@/components/ui/loader';
import { useFactoryProgram } from '@/lib/sails';
import { Routing } from '@/pages';

function Component() {
  const { isApiReady } = useApi();
  const { isAccountReady } = useAccount();
  const program = useFactoryProgram();

  const isAppReady = isApiReady && isAccountReady && program;

  return (
    <main className="min-h-screen">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {isAppReady ? <Routing /> : <Loader size="lg" text="Loading..." className="py-20" />}
      </div>
    </main>
  );
}

export const App = withProviders(Component);
