import { GearApi } from '@gear-js/api';
import type { ISubmittableResult } from '@polkadot/types/types';
import { formatBalance } from '@polkadot/util';

import type { Network, PairsTokens, Token } from './types';

const getNetworks = (pairsTokens: PairsTokens): Network[] => {
  return [
    {
      id: 'vara',
      name: 'Vara Network',
      chainId: 1,
      logoURI: '/tokens/vara.png',
      tokens: pairsTokens.reduce<Token[]>((acc, { token0, token1 }) => {
        if (!acc.some(({ address }) => address === token0.address)) {
          acc.push(token0);
        }
        if (!acc.some(({ address }) => address === token1.address)) {
          acc.push(token1);
        }
        return acc;
      }, []),
    },
    // TODO: add other networks
    {
      id: 'ethereum',
      name: 'Ethereum',
      chainId: 1,
      logoURI: '/tokens/eth.png',
      tokens: [],
    },
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

const getSelectedPair = (pairsTokens: PairsTokens, token0: Token, token1: Token) => {
  const pairIndex = pairsTokens.findIndex(
    (pair) =>
      (pair.token0.address === token0.address && pair.token1.address === token1.address) ||
      (pair.token0.address === token1.address && pair.token1.address === token0.address),
  );
  if (pairIndex === -1) {
    return null;
  }

  const selectedPair = pairsTokens[pairIndex];
  const isPairReverse = token0.address === selectedPair?.token1.address;

  return {
    selectedPair,
    isPairReverse,
    pairIndex,
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

const handleStatus = (
  api: GearApi,
  { status, events }: ISubmittableResult,
  {
    onSuccess = () => {},
    onError = () => {},
    onFinally = () => {},
  }: {
    onSuccess?: () => void;
    onError?: (_error: string) => void;
    onFinally?: () => void;
  } = {},
) => {
  if (!status.isInBlock) return;
  if (!api) {
    throw new Error('API is not ready');
  }

  events
    .filter(({ event }) => event.section === 'system')
    .forEach(({ event }) => {
      const { method } = event;

      if (method === 'ExtrinsicSuccess' || method === 'ExtrinsicFailed') onFinally();

      if (method === 'ExtrinsicSuccess') return onSuccess();

      if (method === 'ExtrinsicFailed') {
        const { name, method: methodName, docs } = api.getExtrinsicFailedError(event);

        onError(`${name}.${methodName}: ${docs}`);
      }
    });
};

export {
  getNetworks,
  getFormattedBalance,
  parseUnits,
  calculatePercentage,
  formatUnits,
  calculateProportionalAmount,
  getSelectedPair,
  handleStatus,
  calculateLPTokens,
  calculatePoolShare,
  calculateExistingPoolShare,
};
