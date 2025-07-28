"use client";

import { Navigation } from "@/components/navigation"
import { PoolPage } from "@/components/pool-page"
import { withProviders } from "../hocs";

function Pool() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <PoolPage />
      </main>
    </div>
  );
}

export default withProviders(Pool);
