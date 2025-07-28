import { Navigation } from "@/components/navigation"
import { TradePage } from "@/components/trade-page"

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <TradePage />
      </main>
    </div>
  )
}
