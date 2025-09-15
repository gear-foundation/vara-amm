import { HexString } from '@gear-js/api';
import { z } from 'zod';

import { PairsReservesMap } from './hooks';
import { TokenMap, PairsTokens } from './types';
import { parseUnits, calculatePriceImpact, getSelectedPair } from './utils';

const validateBalance = (tokenAddress: HexString, amount: string, tokens: TokenMap) => {
  const token0 = tokens.get(tokenAddress);
  if (!token0?.balance || !amount) return true;

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
    .refine((data) => validateBalance(data.token0Address as HexString, data.amount0, tokens), {
      message: 'Insufficient token 1 balance',
      path: ['amount0'],
    })
    .refine((data) => validateBalance(data.token1Address as HexString, data.amount1, tokens), {
      message: 'Insufficient token 2 balance',
      path: ['amount1'],
    });
};

const createSwapValidationSchema = (pairsTokens: PairsTokens, pairsReserves?: PairsReservesMap) => {
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
        message: 'Price Impact too high',
        path: ['fromAmount'],
      },
    );
};

export { createAddLiquidityValidationSchema, createSwapValidationSchema };
