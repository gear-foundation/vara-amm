import { HexString } from '@gear-js/api';
import { useAccount, useAlert, useApi } from '@gear-js/react-hooks';
import { useState } from 'react';

import type { Token, TokenMap } from '@/features/pair/types';
import { VftProgram } from '@/lib/sails';
import { fetchTokenData } from '@/lib/utils/index';

type UseTokenImportParams = {
  onSelectToken: (token: Token) => void;
  tokens: TokenMap;
};

export const useTokenImport = ({ onSelectToken, tokens }: UseTokenImportParams) => {
  const [customToken, setCustomToken] = useState<Token | null>(null);
  const [customTokensMap, setCustomTokensMap] = useState<Map<HexString, Token>>(new Map());
  const [showImportModal, setShowImportModal] = useState(false);
  const alert = useAlert();
  const { api } = useApi();
  const { account } = useAccount();

  const validateTokenContract = async (address: HexString): Promise<Token | null> => {
    try {
      if (!api) return null;
      const vftProgram = new VftProgram(api, address);
      const token = await fetchTokenData(vftProgram, address, account?.decodedAddress);
      if (!token) return null;
      return token;
    } catch (_error) {
      return null;
    }
  };

  const handleAddressSearch = async (address: string) => {
    if (address.length === 66 && address.startsWith('0x')) {
      const isTokenExists = tokens.get(address as HexString)?.address.toLowerCase() === address.toLowerCase();
      if (isTokenExists) return;

      const token = await validateTokenContract(address as HexString);
      if (token) {
        setCustomToken(token);
        setShowImportModal(true);
      } else {
        const errorMessage = 'This address does not point to a recognized fungible token contract.';
        alert.error(errorMessage);
      }
    }
  };

  return {
    validateTokenContract,
    handleAddressSearch,
    customTokensMap,
    tokenImportModalProps: {
      customToken,
      isOpen: showImportModal,
      onClose: () => setShowImportModal(false),
      onAddNewToken: (token: Token) => {
        setCustomToken(token);
        setShowImportModal(false);
        onSelectToken(token);
        setCustomTokensMap((prev) => prev.set(token.address, token));
      },
    },
  };
};
