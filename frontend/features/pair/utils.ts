import { formatBalance } from '@polkadot/util';
import { Network, PairsTokens, Token } from './types';

const getNetworks = (pairsTokens: PairsTokens): Network[] => {
  return [
    {
      id: 'vara',
      name: 'Vara Network',
      chainId: 1,
      logoURI: '/tokens/vara.png',
      tokens: pairsTokens.reduce<Token[]>((acc, pairToken) => {
        acc.push(pairToken.token0);
        acc.push(pairToken.token1);
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

export { getNetworks, getFormattedBalance };
