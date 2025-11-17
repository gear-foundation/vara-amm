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
  TVARA: '/tokens/vara.png',
  WTVARA: '/tokens/vara.png',
  WETH: '/tokens/eth.png',
  WUSDT: '/tokens/usdt.png',
  WUSDC: '/tokens/usdc.png',
  WBTC: '/tokens/wrapped-btc.svg',
  // Ethereum
  WVARA: '/tokens/vara.png',
  ETH: '/tokens/eth.png',
  USDT: '/tokens/usdt.png',
  USDC: '/tokens/usdc.png',
};

export const VERIFIED_TOKENS = [
  '0xd0f89cfd994c92bb743a5a69049609b796e2026e05318f7eef621a5e31df3d4b', // WTVARA
  '0xba764e2836b28806be10fe6f674d89d1e0c86898d25728f776588f03bddc6f58', // WETH
  '0x9f332e61589e0850dce6d8e6070ea5618de33d9f134a4a35d6d1164dc9002f48', // WUSDC
  '0x464511231a1afe9108a689ed3dbbb047ca308d6f5dfb86453e4df5612a2d668a', // WUSDT
  '0xc1ec06d99efcffd863f9c2ad2bc76f656aff861acf06f438046c64e5b41e3fd9', // WBTC
];

export const SECONDS_IN_MINUTE = 60;

export const SLIPPAGE = 0.05;
export const MIN_FIRST_LIQUIDITY_USD = 1000;
export const MIN_VISIBLE_TVL_USD = 10;

export const INPUT_PERCENTAGES = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: 'MAX', value: 1 },
];
