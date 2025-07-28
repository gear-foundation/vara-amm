import { Navigation } from "@/components/navigation"
import { PoolPage } from "@/components/pool-page"

export default function Pool() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <PoolPage />
      </main>
    </div>
  )
}
