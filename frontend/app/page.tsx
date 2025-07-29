'use client';

import { Navigation } from '@/components/navigation';
import { TradePage } from '@/components/trade-page';

import { withProviders } from './hocs';

function Home() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <TradePage />
      </main>
    </div>
  );
}

export default withProviders(Home);
