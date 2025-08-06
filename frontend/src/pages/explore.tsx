import { ExplorePage } from '@/components/explore-page';
import { Navigation } from '@/components/navigation';

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

export default Explore;
