import type { HexString } from '@gear-js/api';

export const ENV = {
  NODE_ADDRESS: import.meta.env.VITE_NODE_ADDRESS as string,
  EXPLORER_URL: import.meta.env.VITE_EXPLORER_URL as string,
  FACTORY_PROGRAM_ID: import.meta.env.VITE_FACTORY_PROGRAM_ID as HexString,
};

export const ROUTES = {
  HOME: '/',
  TRADE: '/trade',
  EXPLORE: '/explore',
  POOL: '/pool',
};

export const LOGO_URI_BY_SYMBOL: Record<string, string> = {
  // Vara Network
  VARA: '/tokens/vara.png',
  WTVARA: '/tokens/vara.png',
  WETH: '/tokens/eth.png',
  WUSDT: '/tokens/usdt.png',
  WUSDC: '/tokens/usdc.png',
  // Ethereum
  WVARA: '/tokens/vara.png',
  ETH: '/tokens/eth.png',
  USDT: '/tokens/usdt.png',
  USDC: '/tokens/usdc.png',
};

export const SECONDS_IN_MINUTE = 60;

export const SLIPPAGE = 0.05;

export const INPUT_PERCENTAGES = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: 'MAX', value: 1 },
];
