import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const TradePageSell = () => {
  return (
    <Card className="card">
      <CardHeader>
        <CardTitle className="text-lg font-bold uppercase theme-text">SELL CRYPTO</CardTitle>
        <p className="text-sm text-gray-400">Choose your preferred exchange to sell crypto for fiat</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          {/* Coinbase */}
          <button className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <div className="text-left">
                <div className="font-medium theme-text">Coinbase</div>
                <div className="text-xs text-gray-400">Instant cashout available</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
          </button>

          {/* BANXA */}
          <button className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <div className="text-left">
                <div className="font-medium theme-text">BANXA</div>
                <div className="text-xs text-gray-400">Bank transfer support</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
          </button>

          {/* Gate.io */}
          <button className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <div className="text-left">
                <div className="font-medium theme-text">Gate.io</div>
                <div className="text-xs text-gray-400">P2P trading available</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
          </button>

          {/* Crypto.com */}
          <button className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <div className="text-left">
                <div className="font-medium theme-text">Crypto.com</div>
                <div className="text-xs text-gray-400">Visa card cashout</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
          </button>

          {/* MEXC */}
          <button className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <div className="text-left">
                <div className="font-medium theme-text">MEXC</div>
                <div className="text-xs text-gray-400">Competitive rates</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
          </button>

          {/* BitMart */}
          <button className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <div className="text-left">
                <div className="font-medium theme-text">BitMart</div>
                <div className="text-xs text-gray-400">Multiple withdrawal options</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
          </button>
        </div>

        <div className="mt-6 p-4 bg-gray-500/10 border border-gray-500/20 rounded-lg">
          <div className="text-sm text-gray-400 mb-2">⚠️ Important</div>
          <div className="text-sm theme-text">
            Always verify withdrawal fees and processing times before selling. Some exchanges may require KYC
            verification.
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export { TradePageSell };
