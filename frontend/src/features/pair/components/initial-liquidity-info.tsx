import { Token } from '@/types';

type InitialLiquidityInfoProps = {
  token0: Token;
  token1: Token;
  prices: {
    initialPrice: string | null;
    estimatedUsdPrice0: string | null;
    estimatedUsdPrice1: string | null;
    totalUsdLiquidity: string | null;
  } | null;
  isLowLiquidity: boolean;
};

const InitialLiquidityInfo = ({ token0, token1, prices, isLowLiquidity }: InitialLiquidityInfoProps) => {
  const { initialPrice, estimatedUsdPrice0, estimatedUsdPrice1, totalUsdLiquidity } = prices ?? {};

  return (
    <>
      {/* Price Information */}
      {estimatedUsdPrice0 && estimatedUsdPrice1 && (
        <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-4 space-y-2">
          <div className="text-sm theme-text">
            <strong>Initial price:</strong> 1 {token0.displaySymbol} = {initialPrice} {token1.displaySymbol}
          </div>
          <div className="text-sm text-gray-400">
            <strong>Estimated USD price:</strong>
            <br /> 1 {token0.displaySymbol} ≈ {estimatedUsdPrice0}, 1 {token1.displaySymbol} ≈{estimatedUsdPrice1}
          </div>

          <div className="text-sm text-gray-400">
            <strong>Estimated USD liquidity:</strong> {totalUsdLiquidity}
          </div>
        </div>
      )}
      {/* First Liquidity Provider Warning */}
      {
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <div className="text-yellow-400 mt-0.5">⚠️</div>
            <div className="text-sm text-yellow-400">
              <strong>The first liquidity provider defines the initial exchange rate.</strong>
              <br />
              This price will be used for all swaps in the pool. Make sure it reflects real market value to avoid
              losses.
            </div>
          </div>
        </div>
      }
      {/* Low Liquidity Warning */}
      {isLowLiquidity && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <div className="text-yellow-400 mt-0.5">⚠️</div>
            <div className="text-sm text-yellow-400">
              <strong>Initial liquidity is very low.</strong>
              <br />
              We recommend starting with at least $1,000 of total value to ensure healthy pool trading and fair pricing.
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export { InitialLiquidityInfo };
