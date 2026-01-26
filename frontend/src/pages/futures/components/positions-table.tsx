import { useState } from 'react';

import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/currency';

type Position = {
  id: string;
  market: string;
  direction: 'long' | 'short';
  size: number;
  collateral: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  pnl: number;
  pnlPercent: number;
};

type Order = {
  id: string;
  market: string;
  type: string;
  size: number;
  triggerPrice: number;
  markPrice: number;
};

// Mock data - will be replaced with real data later
const MOCK_POSITIONS: Position[] = [];
const MOCK_ORDERS: Order[] = [];

export function PositionsTable() {
  const [showChartPositions, setShowChartPositions] = useState(true);

  const getTabLabel = (label: string, count?: number) => (
    <span className="flex items-center space-x-1">
      <span>{label}</span>
      {count !== undefined && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-500/20">{count}</span>}
    </span>
  );

  return (
    <Card className="card overflow-hidden">
      <Tabs defaultValue="positions" className="w-full">
        <div className="flex items-center justify-between px-4 border-b border-gray-500/10">
          <TabsList className="bg-transparent p-0 h-auto">
            <TabsTrigger
              value="positions"
              className="px-4 py-3 rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#00FF85] font-medium uppercase">
              {getTabLabel('Positions', MOCK_POSITIONS.length)}
            </TabsTrigger>
            <TabsTrigger
              value="orders"
              className="px-4 py-3 rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#00FF85] font-medium uppercase">
              {getTabLabel('Orders', MOCK_ORDERS.length)}
            </TabsTrigger>
            <TabsTrigger
              value="trades"
              className="px-4 py-3 rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#00FF85] font-medium uppercase">
              Trades
            </TabsTrigger>
            <TabsTrigger
              value="claims"
              className="px-4 py-3 rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#00FF85] font-medium uppercase">
              Claims
            </TabsTrigger>
          </TabsList>

          {/* Chart Positions Toggle */}
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showChartPositions}
              onChange={(e) => setShowChartPositions(e.target.checked)}
              className="w-4 h-4 rounded border-gray-500/30 bg-transparent 
                checked:bg-[#00FF85] checked:border-[#00FF85] 
                focus:ring-0 focus:ring-offset-0"
            />
            <span className="text-sm text-gray-400">Chart positions</span>
          </label>
        </div>

        <div className="min-h-[200px]">
          <TabsContent value="positions" className="mt-0">
            <PositionsContent positions={MOCK_POSITIONS} />
          </TabsContent>
          <TabsContent value="orders" className="mt-0">
            <OrdersContent orders={MOCK_ORDERS} />
          </TabsContent>
          <TabsContent value="trades" className="mt-0">
            <TradesContent />
          </TabsContent>
          <TabsContent value="claims" className="mt-0">
            <ClaimsContent />
          </TabsContent>
        </div>
      </Tabs>
    </Card>
  );
}

function PositionsContent({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-500/10">
              <th className="text-left py-4 px-6 font-bold uppercase text-xs text-gray-400">
                <div className="flex items-center">
                  <input type="checkbox" className="mr-2 opacity-50" disabled />
                  Market
                </div>
              </th>
              <th className="text-left py-4 px-6 font-bold uppercase text-xs text-gray-400">Type</th>
              <th className="text-left py-4 px-6 font-bold uppercase text-xs text-gray-400">Size</th>
              <th className="text-left py-4 px-6 font-bold uppercase text-xs text-gray-400">Trigger Price</th>
              <th className="text-left py-4 px-6 font-bold uppercase text-xs text-gray-400">Mark Price</th>
              <th className="text-left py-4 px-6 font-bold uppercase text-xs text-gray-400"></th>
              <th className="text-left py-4 px-6 font-bold uppercase text-xs text-gray-400"></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} className="py-12 px-6 text-center text-gray-400">
                No open positions
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-500/10">
            <th className="text-left py-4 px-6 font-bold uppercase text-xs text-gray-400">Market</th>
            <th className="text-left py-4 px-6 font-bold uppercase text-xs text-gray-400">Direction</th>
            <th className="text-right py-4 px-6 font-bold uppercase text-xs text-gray-400">Size</th>
            <th className="text-right py-4 px-6 font-bold uppercase text-xs text-gray-400">Collateral</th>
            <th className="text-right py-4 px-6 font-bold uppercase text-xs text-gray-400">Entry Price</th>
            <th className="text-right py-4 px-6 font-bold uppercase text-xs text-gray-400">Mark Price</th>
            <th className="text-right py-4 px-6 font-bold uppercase text-xs text-gray-400">Liq. Price</th>
            <th className="text-right py-4 px-6 font-bold uppercase text-xs text-gray-400">PnL</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <tr key={position.id} className="table-row">
              <td className="py-4 px-6 font-medium theme-text">{position.market}</td>
              <td className="py-4 px-6">
                <span className={cn('font-medium', position.direction === 'long' ? 'text-green-500' : 'text-red-500')}>
                  {position.direction.toUpperCase()}
                </span>
              </td>
              <td className="py-4 px-6 text-right mono theme-text">{formatCurrency(position.size)}</td>
              <td className="py-4 px-6 text-right mono theme-text">{formatCurrency(position.collateral)}</td>
              <td className="py-4 px-6 text-right mono theme-text">{formatCurrency(position.entryPrice)}</td>
              <td className="py-4 px-6 text-right mono theme-text">{formatCurrency(position.markPrice)}</td>
              <td className="py-4 px-6 text-right mono text-red-400">{formatCurrency(position.liquidationPrice)}</td>
              <td className="py-4 px-6 text-right">
                <span className={cn('font-medium mono', position.pnl >= 0 ? 'text-green-500' : 'text-red-500')}>
                  {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)} ({position.pnlPercent.toFixed(2)}%)
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrdersContent({ orders }: { orders: Order[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-500/10">
            <th className="text-left py-4 px-6 font-bold uppercase text-xs text-gray-400">
              <div className="flex items-center">
                <input type="checkbox" className="mr-2 opacity-50" disabled />
                Market
              </div>
            </th>
            <th className="text-left py-4 px-6 font-bold uppercase text-xs text-gray-400">Type</th>
            <th className="text-right py-4 px-6 font-bold uppercase text-xs text-gray-400">Size</th>
            <th className="text-right py-4 px-6 font-bold uppercase text-xs text-gray-400">Trigger Price</th>
            <th className="text-right py-4 px-6 font-bold uppercase text-xs text-gray-400">Mark Price</th>
            <th className="text-right py-4 px-6 font-bold uppercase text-xs text-gray-400"></th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-12 px-6 text-center text-gray-400">
                No open orders
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr key={order.id} className="table-row">
                <td className="py-4 px-6 font-medium theme-text">{order.market}</td>
                <td className="py-4 px-6 theme-text">{order.type}</td>
                <td className="py-4 px-6 text-right mono theme-text">{formatCurrency(order.size)}</td>
                <td className="py-4 px-6 text-right mono theme-text">{formatCurrency(order.triggerPrice)}</td>
                <td className="py-4 px-6 text-right mono theme-text">{formatCurrency(order.markPrice)}</td>
                <td className="py-4 px-6 text-right">
                  <button className="text-red-400 hover:text-red-300 text-xs uppercase font-medium">Cancel</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function TradesContent() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-500/10">
            <th className="text-left py-4 px-6 font-bold uppercase text-xs text-gray-400">Time</th>
            <th className="text-left py-4 px-6 font-bold uppercase text-xs text-gray-400">Market</th>
            <th className="text-left py-4 px-6 font-bold uppercase text-xs text-gray-400">Direction</th>
            <th className="text-right py-4 px-6 font-bold uppercase text-xs text-gray-400">Size</th>
            <th className="text-right py-4 px-6 font-bold uppercase text-xs text-gray-400">Price</th>
            <th className="text-right py-4 px-6 font-bold uppercase text-xs text-gray-400">PnL</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={6} className="py-12 px-6 text-center text-gray-400">
              No trade history
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ClaimsContent() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-500/10">
            <th className="text-left py-4 px-6 font-bold uppercase text-xs text-gray-400">Time</th>
            <th className="text-left py-4 px-6 font-bold uppercase text-xs text-gray-400">Market</th>
            <th className="text-right py-4 px-6 font-bold uppercase text-xs text-gray-400">Amount</th>
            <th className="text-right py-4 px-6 font-bold uppercase text-xs text-gray-400">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={4} className="py-12 px-6 text-center text-gray-400">
              No claims available
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
