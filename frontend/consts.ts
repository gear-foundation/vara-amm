import { HexString } from '@gear-js/api';

export const ENV = {
  NODE_ADDRESS: process.env.NEXT_PUBLIC_NODE_ADDRESS as string,
  FACTORY_PROGRAM_ID: process.env.NEXT_PUBLIC_FACTORY_PROGRAM_ID as HexString,
  PAIR_PROGRAM_ID: process.env.NEXT_PUBLIC_PAIR_PROGRAM_ID as HexString,
};

export const ROUTES = {
  HOME: '/',
  TRADE: '/trade',
  EXPLORE: '/explore',
  POOL: '/pool',
};
