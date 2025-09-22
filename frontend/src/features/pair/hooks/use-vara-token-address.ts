import { useMemo } from 'react';

import { usePairsTokens } from './usePairsTokens';

const useVaraTokenAddress = () => {
  const tokenMap = usePairsTokens().pairsTokens?.tokens;
  const varaTokenAddress = useMemo(
    () => tokenMap && Array.from(tokenMap).find(([_, { isVaraNative }]) => isVaraNative)?.[0],
    [tokenMap],
  );

  return varaTokenAddress;
};

export { useVaraTokenAddress };
