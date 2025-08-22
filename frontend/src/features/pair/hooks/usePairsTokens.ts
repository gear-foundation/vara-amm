import type { HexString } from '@gear-js/api';
import { useAccount, useApi } from '@gear-js/react-hooks';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';

import { LOGO_URI_BY_SYMBOL } from '@/consts';
import { usePairsQuery } from '@/lib/sails';
import { SailsProgram as VftProgram } from '@/lib/sails/extended-vft';

import type { PairsTokens, Token } from '../types';

const fetchTokenData = async (
  program: VftProgram,
  address: HexString,
  userAddress?: HexString,
): Promise<{
  symbol: string;
  name: string;
  decimals: number;
  balance?: bigint;
} | null> => {
  if (!program) return null;

  try {
    const [symbol, name, decimals, balance] = await Promise.all([
      program.vft.symbol(),
      program.vft.name(),
      program.vft.decimals(),
      userAddress ? program.vft.balanceOf(userAddress) : Promise.resolve(undefined),
    ]);

    return {
      symbol,
      name,
      decimals,
      balance,
    };
  } catch (error) {
    console.error(`Error fetching token data for ${address}:`, error);
    return null;
  }
};

type TokenData = {
  symbol: string;
  name: string;
  decimals: number;
  balance?: bigint;
} | null;

type TokenDataMap = Map<HexString, NonNullable<TokenData>>;

type UsePairsTokensResult = {
  pairsTokens: PairsTokens | undefined;
  refetchBalances: () => void;
  isFetching: boolean;
  error: Error | null;
};

const usePairsTokens = (): UsePairsTokensResult => {
  const { pairs } = usePairsQuery();
  const { account } = useAccount();
  const { api } = useApi();

  const vftProgramsRef = useRef<Map<HexString, VftProgram>>(new Map());

  const vftAddresses = useMemo(() => {
    if (!pairs) return [];
    const addresses = new Set<HexString>();
    pairs.forEach(([ftAddresses]) => {
      addresses.add(ftAddresses[0]);
      addresses.add(ftAddresses[1]);
    });
    return Array.from(addresses);
  }, [pairs]);

  const getVftPrograms = useCallback(() => {
    if (!api) return [];

    return vftAddresses.map((address) => {
      let program = vftProgramsRef.current.get(address);

      if (!program) {
        program = new VftProgram(api, address);
        vftProgramsRef.current.set(address, program);
      }

      return {
        address,
        program,
      };
    });
  }, [api, vftAddresses]);

  const {
    data: tokensData,
    refetch: refetchTokensData,
    isFetching,
    error,
  } = useQuery<TokenDataMap, Error>({
    queryKey: ['pairsTokensData', vftAddresses, account?.decodedAddress],
    queryFn: async ({ client }) => {
      const cachedData: TokenDataMap | undefined = client.getQueryData([
        'pairsTokensData',
        vftAddresses,
        account?.decodedAddress,
      ]);

      // if has cachedData - refetch only balances
      if (cachedData && account) {
        const tokenDataMap = new Map(cachedData);
        const tokenPrograms = getVftPrograms();
        const tokenBalancesPromises = tokenPrograms.map(({ program }) => program.vft.balanceOf(account.decodedAddress));

        const tokenBalances = await Promise.all(tokenBalancesPromises);
        tokenBalances.forEach((balance, index) => {
          const token = tokenDataMap.get(vftAddresses[index]);
          if (token && balance) {
            tokenDataMap.set(vftAddresses[index], {
              ...token,
              balance,
            });
          }
        });
        return tokenDataMap;
      }

      if (!pairs || !api) {
        throw new Error('No pairs or api');
      }

      const tokenPrograms = getVftPrograms();

      const tokenDataPromises = tokenPrograms.map(({ address, program }) =>
        fetchTokenData(program, address, account?.decodedAddress),
      );

      const tokenDataResults = await Promise.all(tokenDataPromises);

      const tokenDataMap = new Map<HexString, NonNullable<(typeof tokenDataResults)[0]>>();
      tokenDataResults.forEach((data, index) => {
        if (data) {
          tokenDataMap.set(vftAddresses[index], data);
        }
      });

      return tokenDataMap;
    },
    enabled: !!pairs && pairs.length > 0 && !!api,
  });

  const pairsTokens = useMemo(() => {
    if (!pairs || !tokensData) return undefined;

    const result: PairsTokens = [];

    for (const [ftAddresses, pairAddress] of pairs) {
      const tokenData0 = tokensData.get(ftAddresses[0]);
      const tokenData1 = tokensData.get(ftAddresses[1]);

      if (tokenData0 && tokenData1) {
        const token0: Token = {
          symbol: tokenData0.symbol,
          name: tokenData0.name,
          decimals: tokenData0.decimals,
          balance: tokenData0.balance,
          address: ftAddresses[0],
          logoURI: LOGO_URI_BY_SYMBOL[tokenData0.symbol],
          network: 'Vara Network',
        };

        const token1: Token = {
          symbol: tokenData1.symbol,
          name: tokenData1.name,
          decimals: tokenData1.decimals,
          balance: tokenData1.balance,
          address: ftAddresses[1],
          logoURI: LOGO_URI_BY_SYMBOL[tokenData1.symbol],
          network: 'Vara Network',
        };

        result.push({
          token0,
          token1,
          pairAddress,
        });
      }
    }

    return result.length > 0 ? result : undefined;
  }, [pairs, tokensData]);

  const refetchBalances = useCallback(() => {
    void refetchTokensData();
  }, [refetchTokensData]);

  return {
    pairsTokens,
    refetchBalances,
    isFetching,
    error,
  };
};

export { usePairsTokens };
