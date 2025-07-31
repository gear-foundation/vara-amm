import { LOGO_URI_BY_SYMBOL } from '@/consts';
import { usePairsQuery } from '@/lib/sails';
import { useBalanceOfQuery, useDecimalsQuery, useNameQuery, useSymbolQuery } from '@/lib/sails/extended-vft/queries';

import { PairsTokens, Token } from '../types';

const usePairsTokens = (): PairsTokens | undefined => {
  const { pairs } = usePairsQuery();
  const pairAddress = pairs?.[0]?.[1];
  const ftAddresses = pairs?.[0]?.[0];

  const { symbol: symbol0 } = useSymbolQuery(ftAddresses?.[0]);
  const { symbol: symbol1 } = useSymbolQuery(ftAddresses?.[1]);

  const { name: name0 } = useNameQuery(ftAddresses?.[0]);
  const { name: name1 } = useNameQuery(ftAddresses?.[1]);

  const { decimals: decimals0 } = useDecimalsQuery(ftAddresses?.[0]);
  const { decimals: decimals1 } = useDecimalsQuery(ftAddresses?.[1]);

  const { balance: balance0 } = useBalanceOfQuery(ftAddresses?.[0]);
  const { balance: balance1 } = useBalanceOfQuery(ftAddresses?.[1]);

  const token0: Token | undefined =
    symbol0 && name0 && decimals0 && ftAddresses
      ? {
          symbol: symbol0,
          name: name0,
          decimals: decimals0,
          balance: balance0,
          address: ftAddresses[0],
          logoURI: LOGO_URI_BY_SYMBOL[symbol0],
          // TODO: get real network
          network: 'Vara Network',
        }
      : undefined;

  const token1: Token | undefined =
    symbol1 && name1 && decimals1 && ftAddresses
      ? {
          symbol: symbol1,
          name: name1,
          decimals: decimals1,
          balance: balance1,
          address: ftAddresses[1],
          logoURI: LOGO_URI_BY_SYMBOL[symbol1],
          // TODO: get real network
          network: 'Vara Network',
        }
      : undefined;

  const pairTokens = token0 && token1 && pairAddress ? { token0, token1, pairAddress } : undefined;
  console.log('🚀 ~ usePairsTokens ~ pairTokens:', pairTokens);

  // TODO: return array of all tokens
  return pairTokens ? [pairTokens] : undefined;
};

export { usePairsTokens };
