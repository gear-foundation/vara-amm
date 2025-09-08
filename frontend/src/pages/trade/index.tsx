import { Loader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components';
import { usePairsTokens } from '@/features/pair';

import { Buy, Sell, Swap } from './components';

function Trade() {
  const { pairsTokens, refetchBalances } = usePairsTokens();

  return pairsTokens ? (
    <div className="max-w-md mx-auto">
      <Tabs defaultValue="swap" className="w-full">
        <TabsList className="card p-1 w-full flex">
          <TabsTrigger
            value="swap"
            className="data-[state=active]:bg-[#00FF85] data-[state=active]:text-black font-bold uppercase flex-1">
            SWAP
          </TabsTrigger>
          <TabsTrigger
            value="buy"
            className="data-[state=active]:bg-[#00FF85] data-[state=active]:text-black font-bold uppercase flex-1">
            BUY
          </TabsTrigger>
          <TabsTrigger
            value="sell"
            className="data-[state=active]:bg-[#00FF85] data-[state=active]:text-black font-bold uppercase flex-1">
            SELL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="swap" className="mt-6">
          <Swap pairsTokens={pairsTokens} refetchBalances={refetchBalances} />
        </TabsContent>

        <TabsContent value="buy" className="mt-6">
          <Buy />
        </TabsContent>

        <TabsContent value="sell" className="mt-6">
          <Sell />
        </TabsContent>
      </Tabs>
    </div>
  ) : (
    <Loader size="lg" text="Loading..." className="py-20" />
  );
}

export default Trade;
