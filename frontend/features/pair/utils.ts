import { GearApi } from '@gear-js/api';
import { ISubmittableResult } from '@polkadot/types/types';
import { formatBalance } from '@polkadot/util';

import { Network, PairsTokens, Token } from './types';

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
    pairAddress: selectedPair.pairAddress,
    isPairReverse,
    pairIndex,
  };
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
};
