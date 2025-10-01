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
  // Ethereum
  WVARA: '/tokens/vara.png',
  ETH: '/tokens/eth.png',
  USDT: '/tokens/usdt.png',
  USDC: '/tokens/usdc.png',
};

export const VERIFIED_TOKENS = [
  '0xee354b7cb70e31b45928f5a767025d10338181bd9a97a1524061cf33489c6bb1', // WTVARA
  '0xfe5890ea569b6b86e9226dce1cf6e9a714cad0fc0ea5f06375f1767e9a7e4083', // WETH
  '0x54ec9739ae960b250864644b1f9b9190838183df4d53fd6aba40173867f440f2', // WUSDC
  '0x5031bfe111a3bb1c53cb24b84070f8d506ab07c73f6a7e46c72e0ad38be4422b', // WUSDT
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
