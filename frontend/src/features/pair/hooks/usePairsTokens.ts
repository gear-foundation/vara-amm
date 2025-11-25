import type { HexString } from '@gear-js/api';
import { useAccount, useApi, useDeriveBalancesAll } from '@gear-js/react-hooks';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTokensWithPrices } from '@/features/token/hooks';
import { useVaraSymbol } from '@/hooks/use-vara-symbol';
import { usePairsQuery, VftProgram } from '@/lib/sails';
import { fetchTokenData } from '@/lib/utils/index';

import type { PairsArray, Token, PairsTokens, TokenMap, PairMap, PairByAddressMap, PairInfo } from '../types';

type UsePairsTokensResult = {
  pairsTokens: PairsTokens | undefined;
  refetchBalances: () => void;
  isFetching: boolean;
  error: Error | null;
};

const usePairsTokens = (): UsePairsTokensResult => {
  const { pairs } = usePairsQuery();
  const varaSymbol = useVaraSymbol();
  const { account } = useAccount();
  const { data: tokensResponse } = useTokensWithPrices();
  const { data: nativeBalance, refetch: refetchNativeBalance } = useDeriveBalancesAll({ address: account?.address });
  const { api } = useApi();

  const tokensFdvMap = useMemo(() => {
    const map = new Map<HexString, number>();

    tokensResponse?.allTokens.nodes.forEach((token) => {
      map.set(token.id as HexString, token.tokenPriceSnapshotsByTokenId?.nodes[0]?.fdv ?? 0);
    });

    return map;
  }, [tokensResponse]);

  const vftProgramsRef = useRef<Map<HexString, VftProgram>>(new Map());
  const [vftPrograms, setVftPrograms] = useState<{ address: HexString; program: VftProgram }[]>([]);

  const vftAddresses = useMemo(() => {
    if (!pairs) return [];
    const addresses = new Set<HexString>();
    pairs.forEach(([ftAddresses]) => {
      addresses.add(ftAddresses[0]);
      addresses.add(ftAddresses[1]);
    });
    return Array.from(addresses);
  }, [pairs]);

  useEffect(() => {
    const getVftPrograms = async () => {
      if (!api) return [];

      // check if token programs are active
      const tokenProgramsResults = await Promise.allSettled(
        vftAddresses.map((address) => api.programStorage.getProgram(address)),
      );
      const activeTokenProgramsFlags = tokenProgramsResults.map(({ status }) => status === 'fulfilled');
      const activeVftAddresses = vftAddresses.filter((_, index) => activeTokenProgramsFlags[index]);

      return activeVftAddresses.map((address) => {
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
    };

    void getVftPrograms().then((programs) => {
      setVftPrograms(programs);
    });
  }, [api, vftAddresses]);

  const {
    data: tokenMap,
    refetch: refetchTokensData,
    isFetching,
    error,
  } = useQuery<TokenMap, Error>({
    queryKey: ['pairsTokensData', vftAddresses, vftPrograms.length, account?.decodedAddress, nativeBalance],
    queryFn: async ({ client }) => {
      const cachedData: TokenMap | undefined = client.getQueryData([
        'pairsTokensData',
        vftAddresses,
        account?.decodedAddress,
        nativeBalance,
      ]);

      // if has cachedData - refetch only balances
      if (cachedData && account) {
        const tokenDataMap = new Map(cachedData) as TokenMap;
        const tokenBalancesPromises = vftPrograms.map(({ program }) => program.vft.balanceOf(account.decodedAddress));

        const tokenBalances = await Promise.all(tokenBalancesPromises);
        tokenBalances.forEach((balance, index) => {
          const token = tokenDataMap.get(vftAddresses[index]);
          if (!token) return;
          tokenDataMap.set(token.address, { ...token, balance });
        });
        return tokenDataMap;
      }

      if (!pairs || !api) {
        throw new Error('No pairs or api');
      }

      const tokenDataPromises = vftPrograms.map(({ address, program }) =>
        fetchTokenData(program, address, account?.decodedAddress, varaSymbol, nativeBalance?.transferable?.toBigInt()),
      );

      const tokenDataResults = await Promise.all(tokenDataPromises);
      const tokenDataMap = new Map<HexString, Token>();
      tokenDataResults.forEach((token) => {
        if (!token) return;
        tokenDataMap.set(token.address, token);
      });

      return tokenDataMap;
    },
    enabled: !!pairs && pairs.length > 0 && !!api,
    // keep previous data to avoid consumers remounting when data temporarily undefined
    placeholderData: (prev) => prev,
  });

  const { pairsTokens } = useMemo(() => {
    if (!pairs || !tokenMap) return { pairsTokens: undefined };

    const result: PairsArray = [];
    const pairMap: PairMap = new Map();
    const pairsByAddress: PairByAddressMap = new Map();

    for (const [ftAddresses, pairAddress] of pairs) {
      const pairTokens: Token[] = [];
      for (const [, address] of ftAddresses.entries()) {
        const token = tokenMap.get(address);
        if (!token) continue;
        pairTokens.push(token);
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
          tokens: tokenMap,
          pairs: pairMap,
          pairsByAddress,
          pairsArray,
          tokensFdvMap,
        }
      : undefined;

    return { pairsTokens: _pairsTokens };
  }, [pairs, tokenMap, tokensFdvMap]);

  const refetchBalances = useCallback(() => {
    void refetchTokensData();
    void refetchNativeBalance();
  }, [refetchTokensData, refetchNativeBalance]);

  return {
    pairsTokens,
    refetchBalances,
    isFetching,
    error,
  };
};

export { usePairsTokens };
