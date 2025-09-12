import type { HexString } from '@gear-js/api';
import { useAccount, useApi, useDeriveBalancesAll } from '@gear-js/react-hooks';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';

import { LOGO_URI_BY_SYMBOL, VERIFIED_TOKENS } from '@/consts';
import { useVaraSymbol } from '@/hooks';
import { usePairsQuery } from '@/lib/sails';
import { SailsProgram as VftProgram } from '@/lib/sails/extended-vft';

import type { PairsArray, Token, PairsTokens, TokenMap, PairMap, PairByAddressMap, PairInfo } from '../types';

const fetchTokenData = async (program: VftProgram, address: HexString, userAddress?: HexString): Promise<TokenData> => {
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
      displaySymbol: symbol,
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
  displaySymbol: string;
  name: string;
  decimals: number;
  balance?: bigint;
  isVaraNative?: boolean;
  isVerified?: boolean;
} | null;

export type TokenDataMap = Map<HexString, NonNullable<TokenData>>;

type UsePairsTokensResult = {
  pairsTokens: PairsTokens | undefined;
  tokensData: TokenDataMap | undefined;
  refetchBalances: () => void;
  isFetching: boolean;
  error: Error | null;
};

const usePairsTokens = (): UsePairsTokensResult => {
  const { pairs } = usePairsQuery();
  const varaSymbol = useVaraSymbol();
  const { account } = useAccount();
  const { data: nativeBalance, refetch: refetchNativeBalance } = useDeriveBalancesAll({ address: account?.address });
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
    queryKey: ['pairsTokensData', vftAddresses, account?.decodedAddress, nativeBalance],
    queryFn: async ({ client }) => {
      const cachedData: TokenDataMap | undefined = client.getQueryData([
        'pairsTokensData',
        vftAddresses,
        account?.decodedAddress,
        nativeBalance,
      ]);

      const setTokenData = (tokenDataMap: TokenDataMap, index: number, token: TokenData) => {
        if (!token) return;
        const tokenAddress = vftAddresses[index];
        const isVaraNative = token.symbol.toLowerCase().includes('vara') && VERIFIED_TOKENS.includes(tokenAddress);
        tokenDataMap.set(tokenAddress, {
          ...token,
          balance: isVaraNative ? nativeBalance?.transferable?.toBigInt() : token.balance,
          isVaraNative,
          displaySymbol: isVaraNative && varaSymbol ? varaSymbol : token.symbol,
          isVerified: VERIFIED_TOKENS.includes(tokenAddress),
        });
      };

      // if has cachedData - refetch only balances
      if (cachedData && account) {
        const tokenDataMap = new Map(cachedData) as TokenDataMap;
        const tokenPrograms = getVftPrograms();
        const tokenBalancesPromises = tokenPrograms.map(({ program }) => program.vft.balanceOf(account.decodedAddress));

        const tokenBalances = await Promise.all(tokenBalancesPromises);
        tokenBalances.forEach((balance, index) => {
          const token = tokenDataMap.get(vftAddresses[index]);

          if (token) {
            setTokenData(tokenDataMap, index, { ...token, balance });
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
      tokenDataResults.forEach((data, index) => setTokenData(tokenDataMap, index, data));

      return tokenDataMap;
    },
    enabled: !!pairs && pairs.length > 0 && !!api,
  });

  const { pairsTokens } = useMemo(() => {
    if (!pairs || !tokensData) return { pairsTokens: undefined };

    const result: PairsArray = [];
    const tokens: TokenMap = new Map();
    const pairMap: PairMap = new Map();
    const pairsByAddress: PairByAddressMap = new Map();

    for (const [ftAddresses, pairAddress] of pairs) {
      const pairTokens: Token[] = [];
      for (const [, address] of ftAddresses.entries()) {
        const data = tokensData.get(address);
        if (!data) continue;

        const displaySymbol = data.isVaraNative && varaSymbol ? varaSymbol : data.symbol;
        const token: Token = {
          symbol: data.symbol,
          displaySymbol,
          name: data.name,
          decimals: data.decimals,
          balance: data.balance,
          address,
          logoURI: LOGO_URI_BY_SYMBOL[data.symbol],
          network: 'Vara Network',
          isVaraNative: data.isVaraNative,
          isVerified: data.isVerified,
        };
        pairTokens.push(token);
        tokens.set(address, token);
      }

      if (pairTokens.length === 2) {
        const [token0, token1] = pairTokens;
        const pairData = { token0, token1, pairAddress };
        result.push(pairData);

        // Create pair info for optimized data
        const pairInfo: PairInfo = {
          token0Address: token0.address,
          token1Address: token1.address,
          pairAddress,
          index: result.length - 1,
        };

        // Add to pairs map with sorted key for consistent lookup
        const sortedKey =
          token0.address < token1.address
            ? `${token0.address}:${token1.address}`
            : `${token1.address}:${token0.address}`;
        pairMap.set(sortedKey, pairInfo);

        // Add to pairs by address map
        pairsByAddress.set(pairAddress, pairInfo);
      }
    }

    const pairsArray = result.length > 0 ? result : undefined;
    const _pairsTokens = pairsArray
      ? {
          tokens,
          pairs: pairMap,
          pairsByAddress,
          pairsArray,
        }
      : undefined;

    return { pairsTokens: _pairsTokens };
  }, [pairs, tokensData, varaSymbol]);

  const refetchBalances = useCallback(() => {
    void refetchTokensData();
    void refetchNativeBalance();
  }, [refetchTokensData, refetchNativeBalance]);

  return {
    pairsTokens,
    tokensData,
    refetchBalances,
    isFetching,
    error,
  };
};

export { usePairsTokens };
