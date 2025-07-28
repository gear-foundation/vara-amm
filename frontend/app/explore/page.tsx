"use client";

import { Navigation } from "@/components/navigation";
import { ExplorePage } from "@/components/explore-page";
import { withProviders } from "../hocs";

function Explore() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <ExplorePage />
      </main>
    </div>
  );
}

export default withProviders(Explore);
