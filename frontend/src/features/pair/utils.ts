import type { HexString } from '@gear-js/api';
import { formatBalance } from '@polkadot/util';

import type { Network, PairsTokens, SelectedPairResult, Token, TokenMap } from './types';

const getNetworks = (tokens: TokenMap, customTokensMap?: Map<HexString, Token>): Network[] => {
  const baseTokens = Array.from(tokens.values());
  const customTokens = customTokensMap ? Array.from(customTokensMap.values()) : [];

  return [
    {
      id: 'vara',
      name: 'Vara Network',
      chainId: 1,
      logoURI: '/tokens/vara.png',
      tokens: baseTokens.concat(customTokens),
    },
    // TODO: add other networks
    // {
    //   id: 'ethereum',
    //   name: 'Ethereum',
    //   chainId: 1,
    //   logoURI: '/tokens/eth.png',
    //   tokens: [],
    // },
  ];
};

const getFormattedBalance = (value: bigint, decimals: number, unit?: string) => {
  return `${formatBalance(value, {
    decimals,
    forceUnit: '-',
    withSiFull: false,
    withZero: false,
    withSi: false,
    withUnit: false,
  })}${unit ? ' ' + unit : ''}`;
};

// parseUnits from ethers.js
const parseUnits = (value: string, decimals: number): bigint => {
  if (!value || value === '0') return 0n;

  const [whole = '0', fraction = ''] = value.split('.');

  if (!/^\d+$/.test(whole)) {
    throw new Error(`Invalid number format: ${value}`);
  }

  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);

  const combined = whole + paddedFraction;

  return BigInt(combined);
};

const calculatePercentage = (amount: bigint, percentage: number): bigint => {
  const multiplier = BigInt(Math.floor(percentage * 10000));
  return (amount * multiplier) / 10000n;
};

const formatUnits = (value: bigint, decimals: number): string => {
  const divisor = 10n ** BigInt(decimals);
  const quotient = value / divisor;
  const remainder = value % divisor;

  if (remainder === 0n) {
    return quotient.toString();
  }

  const fractional = remainder.toString().padStart(decimals, '0');
  const trimmed = fractional.replace(/0+$/, '');

  return trimmed ? `${quotient}.${trimmed}` : quotient.toString();
};

// Formats with custom trimming rules:
// - If integer <= 0: keep fractional up to 3 last non-zero digit
// - If integer > 0: keep only 2 digits after the dot
const formatUnitsTrimmed = (value: bigint, decimals: number): string => {
  const formatted = formatUnits(value, decimals);
  const DISPLAY_DIGITS = 3;

  if (!formatted || formatted === '0') return '0';

  const parts = formatted.split('.');
  const integerPart = parts[0] ?? '0';
  const fractionalPart = parts[1] ?? '';

  try {
    const integerAsBigInt = BigInt(integerPart);

    if (integerAsBigInt === 0n) {
      if (!fractionalPart) return '0';
      const lastNonZeroIndex = [...fractionalPart].findIndex((ch) => ch !== '0');

      if (lastNonZeroIndex === -1) return '0';

      const trimmedFraction = fractionalPart.slice(0, lastNonZeroIndex + DISPLAY_DIGITS);
      return `0.${trimmedFraction}`;
    }

    // Integer part is non-zero: keep only 2 digits after the dot
    const twoDigits = fractionalPart.slice(0, 2);
    return `${integerPart}.${twoDigits}`;
  } catch {
    // Fallback to original formatted on unexpected input
    return formatted;
  }
};

const calculateProportionalAmount = (
  inputAmount: string,
  inputDecimals: number,
  reserve0: bigint,
  reserve1: bigint,
  outputDecimals: number,
  isPairReverse: boolean,
): string => {
  if (!inputAmount || inputAmount === '0' || reserve0 === 0n || reserve1 === 0n) {
    return '';
  }

  const inputReserve = isPairReverse ? reserve1 : reserve0;
  const outputReserve = isPairReverse ? reserve0 : reserve1;

  try {
    const inputAmountWei = parseUnits(inputAmount, inputDecimals);
    const outputAmountWei = (inputAmountWei * outputReserve) / inputReserve;
    return formatUnits(outputAmountWei, outputDecimals);
  } catch {
    return '';
  }
};

const getSelectedPair = (
  pairsTokens: PairsTokens,
  token0Address: HexString,
  token1Address: HexString,
): SelectedPairResult | null => {
  // Create sorted key for lookup
  const sortedKey =
    token0Address < token1Address ? `${token0Address}:${token1Address}` : `${token1Address}:${token0Address}`;

  const pairInfo = pairsTokens.pairs.get(sortedKey);
  if (!pairInfo) {
    return null;
  }

  const token0 = pairsTokens.tokens.get(token0Address);
  const token1 = pairsTokens.tokens.get(token1Address);

  if (!token0 || !token1) {
    return null;
  }

  // Determine if pair is reversed based on original order vs stored order
  const isPairReverse = token0Address === pairInfo.token1Address;

  return {
    selectedPair: {
      token0: isPairReverse ? token1 : token0,
      token1: isPairReverse ? token0 : token1,
      pairAddress: pairInfo.pairAddress,
    },
    isPairReverse,
    pairIndex: pairInfo.index,
  };
};

const integerSqrt = (value: bigint): bigint => {
  if (value < 0n) {
    throw new Error('Square root of negative number');
  }
  if (value < 2n) {
    return value;
  }

  let x = value;
  let y = (x + 1n) / 2n;

  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }

  return x;
};

const calculateLPTokens = (
  amount0: string,
  amount1: string,
  token0Decimals: number,
  token1Decimals: number,
  reserve0: bigint,
  reserve1: bigint,
  totalSupply: bigint,
  isPairReverse: boolean,
): bigint => {
  if (!amount0 || !amount1 || amount0 === '0' || amount1 === '0') {
    return 0n;
  }

  try {
    const amount0Wei = parseUnits(amount0, token0Decimals);
    const amount1Wei = parseUnits(amount1, token1Decimals);

    const amountA = isPairReverse ? amount1Wei : amount0Wei;
    const amountB = isPairReverse ? amount0Wei : amount1Wei;

    let liquidity: bigint;

    if (totalSupply === 0n) {
      const product = amountA * amountB;
      const sqrt = integerSqrt(product);
      const MINIMUM_LIQUIDITY = 1000n;

      if (sqrt < MINIMUM_LIQUIDITY) {
        return 0n;
      }

      liquidity = sqrt - MINIMUM_LIQUIDITY;
    } else {
      if (reserve0 === 0n || reserve1 === 0n) {
        return 0n;
      }

      const liquidityA = (amountA * totalSupply) / reserve0;
      const liquidityB = (amountB * totalSupply) / reserve1;

      liquidity = liquidityA < liquidityB ? liquidityA : liquidityB;
    }

    return liquidity;
  } catch {
    return 0n;
  }
};

const calculatePoolShare = (totalSupply: bigint, lpTokens: bigint): string => {
  try {
    if (lpTokens === 0n) {
      return '0.00';
    }

    const newTotalSupply = totalSupply + lpTokens;

    if (newTotalSupply === 0n) {
      return '0.00';
    }

    const sharePercentage = (lpTokens * 10000n) / newTotalSupply;

    return (Number(sharePercentage) / 100).toFixed(2);
  } catch {
    return '0.00';
  }
};

const calculateExistingPoolShare = (userLpBalance: bigint, totalSupply: bigint): string => {
  try {
    if (userLpBalance === 0n || totalSupply === 0n) {
      return '0.00';
    }

    const sharePercentage = (userLpBalance * 10000n) / totalSupply;

    return (Number(sharePercentage) / 100).toFixed(2);
  } catch {
    return '0.00';
  }
};

/**
 * Calculate price impact for a swap
 * Price impact shows how much the price changes due to the trade
 * Formula based on Uniswap V2:
 * - Current price = reserve_out / reserve_in
 * - New price = (reserve_out - amount_out) / (reserve_in + amount_in)
 * - Price impact = (current_price - new_price) / current_price
 * @returns Price impact as a fraction (0.0 - 1.0), formatted as string with 2 decimal places
 */
const calculatePriceImpact = (
  amountIn: bigint,
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  inputTokenDecimals: number,
  outputTokenDecimals: number,
): number => {
  try {
    if (reserveIn === 0n || reserveOut === 0n || amountIn === 0n || amountOut === 0n) {
      return 0;
    }

    // Convert to same decimal precision for accurate calculation
    // Use 18 decimals as common precision
    const PRECISION = 18;
    const PRECISION_MULTIPLIER = 10n ** BigInt(PRECISION);

    // Normalize reserves to same precision
    const normalizedReserveIn = reserveIn * 10n ** BigInt(PRECISION - inputTokenDecimals);
    const normalizedReserveOut = reserveOut * 10n ** BigInt(PRECISION - outputTokenDecimals);
    const normalizedAmountIn = amountIn * 10n ** BigInt(PRECISION - inputTokenDecimals);
    const normalizedAmountOut = amountOut * 10n ** BigInt(PRECISION - outputTokenDecimals);

    // Current price = reserve_out / reserve_in
    const currentPrice = (normalizedReserveOut * PRECISION_MULTIPLIER) / normalizedReserveIn;

    // New reserves after swap
    const newReserveIn = normalizedReserveIn + normalizedAmountIn;
    const newReserveOut = normalizedReserveOut - normalizedAmountOut;

    if (newReserveOut <= 0n || newReserveIn <= 0n) {
      return 1; // Maximum impact (100%) if trade would drain the pool
    }

    // New price = new_reserve_out / new_reserve_in
    const newPrice = (newReserveOut * PRECISION_MULTIPLIER) / newReserveIn;

    // Price impact = (current_price - new_price) / current_price
    const priceDifference = currentPrice - newPrice;

    if (currentPrice === 0n) {
      return 0;
    }

    // Calculate impact as fraction (0-1) with high precision
    const priceImpactBasisPoints =
      (priceDifference * 10000n * PRECISION_MULTIPLIER) / (currentPrice * PRECISION_MULTIPLIER);
    const priceImpactFraction = Number(priceImpactBasisPoints) / 10000;

    // Ensure positive impact (absolute value)
    const absoluteImpactFraction = Math.abs(priceImpactFraction);

    // Cap at 1.0 (100%) for display purposes
    const cappedImpactFraction = Math.min(absoluteImpactFraction, 1.0);

    return cappedImpactFraction;
  } catch (error) {
    console.warn('Error calculating price impact:', error);
    return 0;
  }
};

export {
  getNetworks,
  getFormattedBalance,
  parseUnits,
  calculatePercentage,
  formatUnits,
  formatUnitsTrimmed,
  calculateProportionalAmount,
  getSelectedPair,
  calculateLPTokens,
  calculatePoolShare,
  calculateExistingPoolShare,
  calculatePriceImpact,
};
