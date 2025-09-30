import { HexString } from '@gear-js/api';
import { z } from 'zod';

import { PairsReservesMap } from './hooks';
import { TokenMap, PairsTokens } from './types';
import { parseUnits, calculatePriceImpact, getSelectedPair } from './utils';

type SwapFormData = {
  fromAmount: string;
  toAmount: string;
  fromTokenAddress: string;
  toTokenAddress: string;
};

const validateLiquidity = (
  data: SwapFormData,
  pairsTokens: PairsTokens,
  pairsReserves: PairsReservesMap,
  lastInputTouch: 'from' | 'to',
) => {
  const { selectedPair, isPairReverse } =
    getSelectedPair(pairsTokens, data.fromTokenAddress as HexString, data.toTokenAddress as HexString) || {};

  if (!selectedPair || isPairReverse === undefined) return true;

  const reserves = pairsReserves.get(selectedPair.pairAddress) || [0n, 0n];

  const isToken0ToToken1 = !isPairReverse;
  const reserveOut = isToken0ToToken1 ? reserves[1] : reserves[0];

  const toToken = pairsTokens.tokens.get(data.toTokenAddress as HexString);
  const fromToken = pairsTokens.tokens.get(data.fromTokenAddress as HexString);

  if (!toToken || !fromToken) return true;
  const { fromAmount, toAmount } = data;

  try {
    if (lastInputTouch === 'from') {
      const desiredOutWei = parseUnits(toAmount || '0', toToken.decimals);
      if (desiredOutWei >= reserveOut && Number(fromAmount)) {
        return false;
      }
    } else {
      const desiredOutWei = parseUnits(toAmount || '0', toToken.decimals);
      if (desiredOutWei >= reserveOut && Number(toAmount)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
};

const validateBalance = (tokenAddress: HexString, amount: string, tokens: TokenMap) => {
  const token0 = tokens.get(tokenAddress);
  if (!amount) return true;
  if (!token0?.balance) return false;

  try {
    const amountWei = parseUnits(amount, token0.decimals);
    return amountWei <= token0.balance;
  } catch {
    return false;
  }
};

const validatePriceImpact = (
  fromTokenAddress: HexString,
  toTokenAddress: HexString,
  fromAmount: string,
  toAmount: string,
  pairsTokens: PairsTokens,
  pairsReserves?: PairsReservesMap,
) => {
  // Skip validation if no amounts or reserves
  if (!fromAmount || !toAmount || !pairsReserves) return true;

  const fromToken = pairsTokens.tokens.get(fromTokenAddress);
  const toToken = pairsTokens.tokens.get(toTokenAddress);

  if (!fromToken || !toToken) return true;

  try {
    const selectedPairResult = getSelectedPair(pairsTokens, fromTokenAddress, toTokenAddress);
    if (!selectedPairResult) return true;

    const { isPairReverse, selectedPair } = selectedPairResult;

    const fromAmountWei = parseUnits(fromAmount, fromToken.decimals);
    const toAmountWei = parseUnits(toAmount, toToken.decimals);

    if (fromAmountWei === 0n || toAmountWei === 0n) return true;

    const [reserve0, reserve1] = pairsReserves.get(selectedPair.pairAddress) || [0n, 0n];
    const reserveIn = isPairReverse ? reserve1 : reserve0;
    const reserveOut = isPairReverse ? reserve0 : reserve1;

    const priceImpact = calculatePriceImpact(
      fromAmountWei,
      toAmountWei,
      reserveIn,
      reserveOut,
      fromToken.decimals,
      toToken.decimals,
    );

    const MAX_PRICE_IMPACT_PERCENT = 5;
    const priceImpactPercent = priceImpact * 100;
    console.log('priceImpact:', priceImpactPercent.toFixed(2) + '%');
    return priceImpactPercent <= MAX_PRICE_IMPACT_PERCENT;
  } catch (error) {
    console.warn('Error validating price impact:', error);
    return false;
  }
};

const createAddLiquidityValidationSchema = (tokens: TokenMap) => {
  return z
    .object({
      token0Address: z.string().min(1, 'Please select first token'),
      token1Address: z.string().min(1, 'Please select second token'),
      amount0: z.string(),
      amount1: z.string(),
    })
    .refine((data) => data.token0Address !== data.token1Address, {
      message: 'Please select different tokens',
      path: ['token1Address'],
    })
    .refine(
      (data) => validateBalance(data.token0Address as HexString, data.amount0, tokens),
      (data) => ({
        message: `Insufficient ${tokens.get(data.token0Address as HexString)?.symbol} balance`,
        path: ['amount0'],
      }),
    )
    .refine(
      (data) => validateBalance(data.token1Address as HexString, data.amount1, tokens),
      (data) => ({
        message: `Insufficient ${tokens.get(data.token1Address as HexString)?.symbol} balance`,
        path: ['amount1'],
      }),
    );
};

const createSwapValidationSchema = (
  pairsTokens: PairsTokens,
  pairsReserves: PairsReservesMap | undefined,
  lastInputTouch: 'from' | 'to',
) => {
  return z
    .object({
      fromAmount: z.string(),
      toAmount: z.string(),
      fromTokenAddress: z.string().min(1, 'Please select token to swap from'),
      toTokenAddress: z.string().min(1, 'Please select token to swap to'),
    })
    .refine((data) => data.fromTokenAddress !== data.toTokenAddress, {
      message: 'Please select different tokens',
      path: ['toTokenAddress'],
    })
    .refine(
      (data) => {
        if (!pairsReserves || !pairsTokens) return true;
        return validateLiquidity(data, pairsTokens, pairsReserves, lastInputTouch);
      },
      {
        message: 'This trade cannot be executed due to insufficient liquidity',
        path: [lastInputTouch === 'from' ? 'fromAmount' : 'toAmount'],
      },
    )
    .refine((data) => validateBalance(data.fromTokenAddress as HexString, data.fromAmount, pairsTokens.tokens), {
      message: 'Insufficient balance',
      path: ['fromAmount'],
    })
    .refine(
      (data) => {
        if (!pairsTokens || !pairsReserves) return true;
        return validatePriceImpact(
          data.fromTokenAddress as HexString,
          data.toTokenAddress as HexString,
          data.fromAmount,
          data.toAmount,
          pairsTokens,
          pairsReserves,
        );
      },
      {
        message: 'Price impact too high',
        path: ['fromAmount'],
      },
    );
};

export { createAddLiquidityValidationSchema, createSwapValidationSchema };
export type { SwapFormData };
