import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const TradePageBuy = () => {
  return (
    <Card className="card">
      <CardHeader>
        <CardTitle className="text-lg font-bold uppercase theme-text">BUY CRYPTO</CardTitle>
        <p className="text-sm text-gray-400">Choose your preferred provider to buy crypto with fiat</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          {/* Coinbase */}
          <a
            href="https://www.coinbase.com/advanced-trade/spot/VARA-USD"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <div className="text-left">
                <div className="font-medium theme-text">Coinbase</div>
                <div className="text-xs text-gray-400">Popular & trusted</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
          </a>

          {/* BANXA */}
          <a
            href="https://gear.banxa.com/?coinType=VARA"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <div className="text-left">
                <div className="font-medium theme-text">BANXA</div>
                <div className="text-xs text-gray-400">Fast onboarding</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
          </a>

          {/* Gate.io */}
          <a
            href="https://www.gate.io/trade/VARA_USDT"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <div className="text-left">
                <div className="font-medium theme-text">Gate.io</div>
                <div className="text-xs text-gray-400">Global exchange</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
          </a>

          {/* Crypto.com */}
          <a
            href="https://crypto.com/price/vara-network"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <div className="text-left">
                <div className="font-medium theme-text">Crypto.com</div>
                <div className="text-xs text-gray-400">Card & app integration</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
          </a>

          {/* MEXC */}
          <a
            href="https://www.mexc.com/price/VARA"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <div className="text-left">
                <div className="font-medium theme-text">MEXC</div>
                <div className="text-xs text-gray-400">Low fees</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
          </a>

          {/* BitMart */}
          <a
            href="https://www.bitmart.com/trade/?type=spot&symbol=VARA_USDT"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 rounded-lg border border-gray-500/20 hover:border-[#00FF85]/50 hover:bg-gray-500/5 transition-all group cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <div className="text-left">
                <div className="font-medium theme-text">BitMart</div>
                <div className="text-xs text-gray-400">Multiple payment methods</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 group-hover:text-[#00FF85]">→</div>
          </a>
        </div>

        <div className="mt-6 p-4 bg-gray-500/10 border border-gray-500/20 rounded-lg">
          <div className="text-sm text-gray-400 mb-2">💡 Pro Tip</div>
          <div className="text-sm theme-text">
            Compare fees and payment methods across providers to find the best option for your region.
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export { TradePageBuy };
