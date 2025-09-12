import { HexString } from '@gear-js/api';
import { z } from 'zod';

import { TokenMap } from './types';
import { parseUnits } from './utils';

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

const createSwapValidationSchema = (tokens: TokenMap) => {
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
    .refine((data) => validateBalance(data.fromTokenAddress as HexString, data.fromAmount, tokens), {
      message: 'Insufficient balance',
      path: ['fromAmount'],
    });
};

export { createAddLiquidityValidationSchema, createSwapValidationSchema };
