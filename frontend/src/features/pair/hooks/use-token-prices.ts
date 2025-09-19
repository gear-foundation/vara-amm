import { useMemo } from 'react';

import { useTokensWithPrices } from '@/features/token';
import { formatPrice } from '@/lib/utils';

import type { Token } from '../types';

const useTokenPrices = (_amount0?: string, _amount1?: string, token0?: Token, token1?: Token) => {
  const { data: tokenPrices, isLoading: isTokenPricesLoading } = useTokensWithPrices();

  const tokenPricesMap = useMemo(
    () =>
      new Map(
        tokenPrices?.allTokens.nodes.map((token) => [token.id, token.tokenPriceSnapshotsByTokenId?.nodes[0].priceUsd]),
      ),
    [tokenPrices],
  );

  if (!token0 || !token1 || !_amount0 || !_amount1) {
    return { prices: null, isTokenPricesLoading, isLowLiquidity: false };
  }

  const token0Price = tokenPricesMap.get(token0.address);
  const token1Price = tokenPricesMap.get(token1.address);
  const price0 = token0Price ? parseFloat(token0Price) : null;
  const price1 = token1Price ? parseFloat(token1Price) : null;
  const amount0 = parseFloat(_amount0);
  const amount1 = parseFloat(_amount1);

  const initialPrice = amount1 / amount0;

  const estimatedUsdPrice0 = price0 || (price1 ? price1 * initialPrice : null);
  const estimatedUsdPrice1 = price1 || (price0 ? price0 / initialPrice : null);

  const totalUsdLiquidity =
    estimatedUsdPrice0 && estimatedUsdPrice1 ? estimatedUsdPrice0 * amount0 + estimatedUsdPrice1 * amount1 : null;

  const prices = {
    initialPrice: initialPrice.toFixed(6),
    estimatedUsdPrice0: estimatedUsdPrice0 ? formatPrice(estimatedUsdPrice0) : null,
    estimatedUsdPrice1: estimatedUsdPrice1 ? formatPrice(estimatedUsdPrice1) : null,
    totalUsdLiquidity: totalUsdLiquidity ? formatPrice(totalUsdLiquidity) : null,
  };

  const isLowLiquidity = Boolean(totalUsdLiquidity && totalUsdLiquidity < 1000);

  return { prices, isTokenPricesLoading, isLowLiquidity };
};

export { useTokenPrices };
