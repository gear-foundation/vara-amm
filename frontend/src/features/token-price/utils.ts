import { TOKEN_ID } from './api';

const getTokenId = (symbol: string) => {
  const lowerCaseSymbol = symbol?.toLowerCase();

  if (lowerCaseSymbol?.includes('vara')) return TOKEN_ID.VARA;
  if (lowerCaseSymbol?.includes('eth')) return TOKEN_ID.ETH;
  if (lowerCaseSymbol?.includes('usdc')) return TOKEN_ID.USDC;
  if (lowerCaseSymbol?.includes('usdt')) return TOKEN_ID.USDT;
  if (lowerCaseSymbol?.includes('btc')) return TOKEN_ID.BTC;

  throw new Error(`Token not found: ${symbol}`);
};

export { getTokenId };
